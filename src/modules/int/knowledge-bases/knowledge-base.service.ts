import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateKnowledgeDto } from './knowledge-base.dto';
import { KnowledgeSourceType } from '@prisma/client';
import { UploadService } from '../upload/upload.service';
import { FileParserService, ParseResult } from '../file-parser/file-parser.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    private fileParserService: FileParserService,
    private googleDriveService: GoogleDriveService
  ) {}

  private serialize(item: any) {
    if (!item) return null;
    return {
      ...item,
      fileSize: item.fileSize ? item.fileSize.toString() : '0',
    };
  }

  // ==========================================
  // 🛡️ 1. เช็คโควตาพื้นที่ (Storage)
  // ==========================================
  private async checkStorageQuota(companyId: number, incomingSizeBytes: number) {
    const quota = await this.prisma.intAiQuota.findUnique({ where: { companyId } });
    if (!quota) return; 

    if (quota.maxSingleFileSize && incomingSizeBytes > Number(quota.maxSingleFileSize)) {
      const maxMB = Number(quota.maxSingleFileSize) / 1024 / 1024;
      throw new BadRequestException(`ไฟล์ใหญ่เกินกำหนด (สูงสุด ${maxMB.toFixed(2)}MB)`);
    }

    const currentUsed = Number(quota.usedStorageBytes);
    const maxStorage = Number(quota.maxStorageBytes);
    
    if (currentUsed + incomingSizeBytes > maxStorage) {
      throw new ForbiddenException('พื้นที่จัดเก็บข้อมูลของคุณเต็มแล้ว');
    }
  }

  // ==========================================
  // 💸 2. ระบบคำนวณและตัดโควตา AI (Tokens/Pages)
  // ==========================================
  private async chargeAiQuota(tx: any, companyId: number, parseResult: ParseResult) {
    if (!parseResult.usedAi || !parseResult.aiModelCode) return;

    this.logger.log(`💰 กำลังคำนวณค่าใช้จ่าย AI สำหรับ ${parseResult.pagesProcessed} หน้า...`);

    const modelConfig = await tx.sysAiModelConfig.findFirst({
      where: {
        modelCode: parseResult.aiModelCode,
        OR: [{ companyId: companyId }, { companyId: null }]
      },
      orderBy: { companyId: 'desc' } 
    });

    const creditPer1k = modelConfig ? Number(modelConfig.creditPer1kTokens) : 1.5;
    const multiplier = modelConfig ? Number(modelConfig.markupMultiplier) : 1.0;
    const totalCost = Math.ceil(parseResult.pagesProcessed * creditPer1k * multiplier);

    const quota = await tx.intAiQuota.findUnique({ where: { companyId } });
    if (!quota) throw new BadRequestException('ไม่พบข้อมูลโควตา AI ของบริษัทนี้');

    const monthlyLimit = Number(quota.monthlyLimit);
    const usedThisMonth = Number(quota.usedThisMonth);
    const extraCredit = Number(quota.extraCredit);

    if (usedThisMonth + totalCost > monthlyLimit + extraCredit) {
      throw new ForbiddenException(`โควตาประมวลผล AI ของคุณไม่เพียงพอ (ต้องการ ${totalCost} Credits)`);
    }

    await tx.intAiQuota.update({
      where: { companyId },
      data: { usedThisMonth: { increment: totalCost } }
    });

    await tx.intAiUsageLog.create({
      data: {
        companyId,
        modelName: parseResult.aiModelCode,
        promptTokens: parseResult.pagesProcessed, 
        completionTokens: 0,
        totalTokens: totalCost,                   
        source: 'KNOWLEDGE_BASE_OCR'
      }
    });

    this.logger.log(`✅ ตัดโควตาสำเร็จ! หักไป ${totalCost} Credits`);
  }

  async findAll(companyId: number, search?: string) {
    const items = await this.prisma.intKnowledgeBase.findMany({
      where: {
        companyId,
        isActive: true,
        OR: search ? [
          { topic: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { fileName: { contains: search, mode: 'insensitive' } },
        ] : undefined,
      },
      orderBy: { updatedAt: 'desc' }, 
    });
    return items.map(item => this.serialize(item));
  }

  async createFromText(companyId: number, dto: CreateKnowledgeDto) {
    const contentSize = Buffer.byteLength(dto.content || '', 'utf8');
    await this.checkStorageQuota(companyId, contentSize);

    // 1. บันทึกข้อมูลหลักและโควตา (ให้อยู่ใน Transaction เหมือนเดิม)
    const kb = await this.prisma.$transaction(async (tx) => {
      const newKb = await tx.intKnowledgeBase.create({
        data: {
          companyId,
          topic: dto.topic || 'No Topic',
          content: dto.content || '',
          sourceType: KnowledgeSourceType.TEXT,
          fileSize: BigInt(contentSize),
        },
      });
      await tx.intAiQuota.update({
        where: { companyId },
        data: { usedStorageBytes: { increment: BigInt(contentSize) } }
      });
      
      return newKb; // ส่งข้อมูลออกมานอก Transaction ก่อน
    });

    // ==========================================================
    // 🚀 2. [NEW] สั่งทำ Vector ทันที (ให้ทำงานอยู่เบื้องหลัง)
    // ==========================================================
    if (kb.content) {
      this.generateEmbeddings(kb.id, kb.content).catch(e => {
        this.logger.error(`❌ TEXT Embedding Error: ${e.message}`);
      });
    }

    // 3. ส่งข้อมูลกลับให้ Frontend
    return this.serialize(kb);
  }

  // ==========================================
  // 🐢 3A. อัปโหลดและประมวลผลทันที (Sync)
  // ==========================================
 async createFromFile(companyId: number, file: Express.Multer.File, topic?: string) {
    if (!file) throw new BadRequestException('ไม่พบไฟล์');
    
    await this.checkStorageQuota(companyId, file.size);

    // 🚀 1. สร้างรหัส Hash เพื่อตรวจสอบเนื้อหาไฟล์ (คำนวณจาก Binary Content)
    const fileHash = this.fileParserService.generateHash(file.buffer);

    // 🚀 2. [ด่านที่ 1] เช็คเนื้อหาซ้ำ (Deduplication)
    // ตรวจสอบว่ามีไฟล์ที่มี "เนื้อหาด้านใน" เหมือนกันเป๊ะอยู่ในระบบแล้วหรือไม่ (ไม่ว่าจะชื่ออะไร)
    const duplicateContent = await this.prisma.intKnowledgeBase.findFirst({
      where: { 
        companyId, 
        fileHash: fileHash, 
        sourceType: KnowledgeSourceType.LOCAL 
      }
    });

    if (duplicateContent) {
      this.logger.log(`♻️ พบไฟล์ที่มีเนื้อหาเหมือนเดิมเป๊ะในระบบ (ID: ${duplicateContent.id}) ข้ามการประมวลผลใหม่เพื่อประหยัดโควตา AI`);
      return this.serialize(duplicateContent); 
    }

    // 🚀 3. [ด่านที่ 2] เช็คชื่อไฟล์ซ้ำ (Versioning)
    // กรณีผ่านด่านแรกมาได้ แปลว่าเนื้อหาไม่ซ้ำ แต่อาจจะเป็นการอัปโหลดไฟล์เวอร์ชันใหม่โดยใช้ชื่อเดิม
    const existingFile = await this.prisma.intKnowledgeBase.findFirst({
      where: { 
        companyId, 
        fileName: file.originalname, 
        sourceType: KnowledgeSourceType.LOCAL 
      }
    });

    // 🚀 4. สกัดข้อความ และดักจับ Error (เช่น ติดรหัสผ่าน หรือไฟล์ว่างเปล่า)
    let parseResult: ParseResult = { text: '', usedAi: false, pagesProcessed: 0 };
    try {
      parseResult = await this.fileParserService.extractText(file.buffer, file.mimetype, file.originalname);
      
      if (!parseResult.text || parseResult.text.trim() === '') {
        throw new Error('empty_content');
      }

    } catch (error: any) {
      this.logger.warn(`Parse error: ${error.message}`);
      const errMsg = (error.message || '').toLowerCase();
      
      if (errMsg.includes('password') || errMsg.includes('encrypt') || errMsg.includes('protected')) {
        throw new BadRequestException(`ไม่สามารถอ่านไฟล์ได้: ไฟล์ "${file.originalname}" ติดรหัสผ่านป้องกัน กรุณาปลดล็อคก่อนอัปโหลด`);
      }
      
      if (errMsg === 'empty_content') {
        throw new BadRequestException(`ไม่พบข้อความในไฟล์ "${file.originalname}" ไฟล์อาจเป็นรูปสแกนล้วนที่ระบบไม่สามารถอ่านได้`);
      }

      throw new BadRequestException(`เกิดข้อผิดพลาดในการอ่านไฟล์ "${file.originalname}": โปรดตรวจสอบความสมบูรณ์ของไฟล์`);
    }
    
    const finalContent = parseResult.text;
    const cloudUrl = await this.uploadService.saveToCloud(file, companyId, 'knowledge');

    const resultKb = await this.prisma.$transaction(async (tx) => {
      // หักโควตา AI กรณีมีการใช้ OCR หรือ AI ในการอ่านไฟล์
      if (parseResult.usedAi) {
        await this.chargeAiQuota(tx, companyId, parseResult);
      }

      if (existingFile) {
        // กรณีอัปเดตทับไฟล์เดิม (ชื่อเดิมแต่เนื้อหาเปลี่ยน) -> คำนวณส่วนต่างพื้นที่ Storage
        const sizeDiff = BigInt(file.size) - existingFile.fileSize; 
        const updated = await tx.intKnowledgeBase.update({
          where: { id: existingFile.id },
          data: {
            topic: topic || existingFile.topic,
            content: finalContent,
            url: cloudUrl, 
            fileSize: BigInt(file.size),
            fileHash: fileHash, 
            updatedAt: new Date() 
          }
        });

        await tx.intAiQuota.update({
          where: { companyId },
          data: { usedStorageBytes: { increment: sizeDiff } }
        });

        return updated;
      } else {
        // กรณีเป็นไฟล์ใหม่แกะกล่อง
        const kb = await tx.intKnowledgeBase.create({
          data: {
            companyId,
            topic: topic || file.originalname || 'No Topic',
            content: finalContent,
            sourceType: KnowledgeSourceType.LOCAL,
            fileName: file.originalname,
            url: cloudUrl,
            fileSize: BigInt(file.size),
            fileHash: fileHash, 
          },
        });

        await tx.intAiQuota.update({
          where: { companyId },
          data: { usedStorageBytes: { increment: BigInt(file.size) } }
        });

        return kb; 
      }
    });

    // 🚀 5. สั่งทำ Vector Embedding (Background Process) เพื่อใช้ในการค้นหา
    if (resultKb.content) {
      this.generateEmbeddings(resultKb.id, resultKb.content).catch(e => {
        this.logger.error(`❌ FILE Embedding Error: ${e.message}`);
      });
    }

    return this.serialize(resultKb);
  }

  // ==========================================
  // 🚀 3B. ไฟล์ - ส่งเข้าคิว (Async)
  // ==========================================
  async createFromFileQueue(companyId: number, file: Express.Multer.File, topic?: string) {
    if (!file) throw new BadRequestException('ไม่พบไฟล์');
    await this.checkStorageQuota(companyId, file.size);

    // 🚀 1. สร้าง Hash และเช็คไฟล์ซ้ำทันที
    const fileHash = this.fileParserService.generateHash(file.buffer);
    const existingFile = await this.prisma.intKnowledgeBase.findFirst({
    where: { 
              companyId, 
              fileHash: fileHash, // 🌟 เปลี่ยนมาเช็ค Hash แทน fileName
              sourceType: KnowledgeSourceType.LOCAL 
           }
    });

    if (existingFile && existingFile.fileHash === fileHash) {
      this.logger.log(`♻️ [Queue] ไฟล์ ${file.originalname} เนื้อหาเดิมเป๊ะ ข้ามการลงคิว`);
      return {
        message: 'ไฟล์นี้มีอยู่ในระบบแล้วและเนื้อหาเป็นปัจจุบันแล้ว',
        jobId: null,
        status: 'COMPLETED',
        fileName: file.originalname
      };
    }

    // (ถ้าเป็นไฟล์ใหม่ หรือมีการแก้ไข ให้ทำงานต่อ)
    let cloudUrl = '';
    try {
      cloudUrl = await this.uploadService.saveToCloud(file, companyId, 'knowledge-queue');
    } catch (error) {
      throw new InternalServerErrorException('อัปโหลดไฟล์ไม่สำเร็จ ไม่สามารถจัดคิวได้');
    }

    const job = await this.prisma.intAiBatchJob.create({
      data: {
        companyId: companyId,
        jobType: 'KNOWLEDGE_UPLOAD_OCR',
        status: 'PENDING',
        totalItems: 1,
        processedItems: 0,
        payload: {
          fileUrl: cloudUrl,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          topic: topic || file.originalname,
          fileHash: fileHash // 🚀 2. ส่ง Hash ไปให้ Worker ด้วย
        },
      }
    });

    this.logger.log(`🚀 นำไฟล์เข้าคิวสำเร็จ (Job ID: ${job.id})`);

    return {
      message: 'นำไฟล์เข้าสู่ระบบคิวเรียบร้อยแล้ว',
      jobId: job.id,
      status: job.status,
      fileName: file.originalname
    };
  }

  // ==========================================
  // 🐢 4A. Google Drive - ประมวลผลทันที (Sync)
  // ==========================================
  async createFromDrive(companyId: number, dto: CreateKnowledgeDto) {
    if (!dto.fileId || !dto.url) throw new BadRequestException('ข้อมูล Google Drive ไม่ครบถ้วน');

    let driveFile;
    try {
      driveFile = await this.googleDriveService.getFile(companyId, dto.fileId);
    } catch (error : any) {
      throw new BadRequestException(`ไม่สามารถดาวน์โหลดไฟล์จาก Drive ได้: ${error.message}`);
    }

    const fileSize = driveFile.buffer.length;
    await this.checkStorageQuota(companyId, fileSize);

    const safeFileName = dto.fileName || 'unknown_file';

    // ==========================================================
    // 🚀 [NEW] สกัดข้อความ และดักจับ Error (รหัสผ่าน / ไฟล์ว่างเปล่า)
    // ==========================================================
    let parseResult: ParseResult = { text: '', usedAi: false, pagesProcessed: 0 };
    try {
      parseResult = await this.fileParserService.extractText(driveFile.buffer, driveFile.mimetype, safeFileName);
      
      // ดักอีกชั้น: ถ้าสกัดแล้วเนื้อหาว่างเปล่าเลย อาจจะเป็น PDF สแกนมาเป็นรูปภาพ
      if (!parseResult.text || parseResult.text.trim() === '') {
        throw new Error('empty_content');
      }

    } catch (error: any) {
      this.logger.warn(`Drive Parse error: ${error.message}`);
      
      const errMsg = (error.message || '').toLowerCase();
      
      // ✅ เช็คว่า Error เกิดจากไฟล์ติดรหัสผ่านหรือไม่
      if (errMsg.includes('password') || errMsg.includes('encrypt') || errMsg.includes('protected')) {
        throw new BadRequestException(`ไม่สามารถอ่านไฟล์ได้: ไฟล์ "${safeFileName}" จาก Google Drive ติดรหัสผ่านป้องกัน (Encrypted) กรุณาปลดรหัสผ่านก่อนนำเข้าครับ`);
      }
      
      // ✅ เช็คว่าอ่านแล้วไม่เจอตัวหนังสือเลย
      if (errMsg === 'empty_content') {
        throw new BadRequestException(`ไม่พบข้อความในไฟล์ "${safeFileName}" ไฟล์อาจเป็นรูปภาพสแกนล้วนๆ ที่ไม่มีตัวอักษรให้ระบบอ่านได้ครับ`);
      }

      // ✅ ถ้าเป็น Error อื่นๆ
      throw new BadRequestException(`เกิดข้อผิดพลาดในการอ่านไฟล์ "${safeFileName}": โปรดตรวจสอบว่าไฟล์สมบูรณ์และไม่ได้ถูกล็อคไว้หรือไม่`);
    }

    // ถ้าผ่านมาถึงตรงนี้ได้ แปลว่ามีข้อความให้ใช้งานได้
    const finalContent = parseResult.text;

    // 1. นำผลลัพธ์ออกมาเก็บไว้ในตัวแปร resultKb
    const resultKb = await this.prisma.$transaction(async (tx) => {
      if (parseResult.usedAi) {
        await this.chargeAiQuota(tx, companyId, parseResult);
      }

      const existing = await tx.intKnowledgeBase.findFirst({
        where: { companyId, OR: [{ fileId: dto.fileId }, { url: dto.url }], sourceType: KnowledgeSourceType.GOOGLE_DRIVE }
      });

      if (existing) {
        const sizeDiff = BigInt(fileSize) - existing.fileSize;
        const updated = await tx.intKnowledgeBase.update({
          where: { id: existing.id },
          data: {
            topic: dto.topic || safeFileName || existing.topic,
            content: finalContent,
            fileName: safeFileName,
            fileSize: BigInt(fileSize),
            updatedAt: new Date()
          }
        });

        await tx.intAiQuota.update({
          where: { companyId },
          data: { usedStorageBytes: { increment: sizeDiff } }
        });

        return updated; // คืนค่า updated ออกไป
      } else {
        const kb = await tx.intKnowledgeBase.create({
          data: {
            companyId,
            topic: dto.topic || safeFileName || 'Google Drive File',
            content: finalContent,
            sourceType: KnowledgeSourceType.GOOGLE_DRIVE,
            fileName: safeFileName,
            fileId: dto.fileId,
            url: dto.url,
            fileSize: BigInt(fileSize),
          },
        });

        await tx.intAiQuota.update({
          where: { companyId },
          data: { usedStorageBytes: { increment: BigInt(fileSize) } }
        });

        return kb; // คืนค่า kb ออกไป
      }
    });

    // ==========================================================
    // 🚀 2. [NEW] สั่งทำ Vector ทันทีหลังจาก Database บันทึกเสร็จ (ทำงานเบื้องหลัง)
    // ==========================================================
    if (resultKb.content) {
      this.generateEmbeddings(resultKb.id, resultKb.content).catch(e => {
        this.logger.error(`❌ DRIVE FILE Embedding Error: ${e.message}`);
      });
    }

    // 3. ส่งข้อมูลกลับให้หน้าบ้าน
    return this.serialize(resultKb);
  }

  // ==========================================
  // 🚀 4B. Google Drive - ส่งเข้าคิว (Async)
  // ==========================================
  async createFromDriveQueue(companyId: number, dto: CreateKnowledgeDto) {
    if (!dto.fileId || !dto.url) throw new BadRequestException('ข้อมูล Google Drive ไม่ครบถ้วน');

    // 🌟 [FIX] เช็คก่อนว่ามีไฟล์นี้ในฐานข้อมูลหรือยัง
    const existing = await this.prisma.intKnowledgeBase.findFirst({
      where: { companyId, fileId: dto.fileId, sourceType: KnowledgeSourceType.GOOGLE_DRIVE }
    });

    if (existing) {
      return {
        message: 'ข้อมูลนี้มีอยู่ในระบบ Knowledge Base แล้ว ไม่จำเป็นต้องเข้าคิวซ้ำ',
        jobId: null,
        status: 'COMPLETED',
        fileName: dto.fileName
      };
    }

    const job = await this.prisma.intAiBatchJob.create({
      data: {
        companyId: companyId,
        jobType: 'KNOWLEDGE_DRIVE_OCR',
        status: 'PENDING',
        totalItems: 1,
        processedItems: 0,
        payload: {
          fileId: dto.fileId,
          url: dto.url,
          fileName: dto.fileName || 'Google Drive File',
          topic: dto.topic || dto.fileName || 'Google Drive File'
        },
      }
    });

    this.logger.log(`🚀 นำไฟล์ Google Drive เข้าคิวสำเร็จ (Job ID: ${job.id})`);

    return {
      message: 'นำข้อมูลจาก Google Drive เข้าสู่ระบบคิวเรียบร้อยแล้ว',
      jobId: job.id,
      status: job.status,
      fileName: dto.fileName
    };
  }

  // ==========================================
  // 🐢 5A. Web Site - ประมวลผลทันที (Sync)
  // ==========================================
  async createFromWeb(companyId: number, dto: CreateKnowledgeDto) {
    if (!dto.url) throw new BadRequestException('URL is required');

    this.logger.log(`🕷️ Scraping content from: ${dto.url}`);

    let content = '';
    let pageTitle = '';
    let size = 0;

    try {
      // ✅ 1. เพิ่ม Headers จำลองตัวเองเป็นเบราว์เซอร์
      const response = await axios.get(dto.url, {
        timeout: 10000, 
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1'
        }
      });
      
      const html = response.data;
      size = Buffer.byteLength(html, 'utf8'); 

      const $ = cheerio.load(html);
      
      $('script').remove();
      $('style').remove();
      $('noscript').remove();
      $('iframe').remove();
      $('header').remove(); 
      $('footer').remove(); 
      $('nav').remove();
      
      pageTitle = $('title').text().trim();
      content = $('body').text().replace(/\s+/g, ' ').trim(); 

    } catch (error: any) {
      // ✅ 2. ดักจับ Error วิเคราะห์ระบบป้องกัน และโยนข้อความที่อ่านเข้าใจง่ายกลับไปให้ Frontend
      if (error.response) {
        const status = error.response.status;
        const server = (error.response.headers['server'] || '').toLowerCase();
        const isCloudflare = server.includes('cloudflare');
        const isAkamai = server.includes('akamai');

        if (status === 403 || status === 503) {
           if (isCloudflare || isAkamai) {
              throw new BadRequestException(`ไม่สามารถดึงข้อมูลได้: เว็บไซต์มีระบบป้องกันการดึงข้อมูลอัตโนมัติ (${server}) กรุณาก๊อปปี้ข้อความมาสร้างเป็น Text แทนครับ`);
           } else {
              throw new BadRequestException(`ไม่สามารถดึงข้อมูลได้: เว็บไซต์ปฏิเสธการเข้าถึง (Error ${status}) อาจมีการบล็อก IP หรือป้องกัน Bot กรุณาก๊อปปี้ข้อความแทนครับ`);
           }
        }
      }

      this.logger.error(`Scrape Error: ${error.message}`);
      throw new BadRequestException(`ไม่สามารถดึงข้อมูลจากเว็บได้: ${error.message}`);
    }

    await this.checkStorageQuota(companyId, size);

    // 1. นำผลลัพธ์ออกมาเก็บไว้ในตัวแปร resultKb
    const resultKb = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.intKnowledgeBase.findFirst({
        where: { companyId, url: dto.url, sourceType: KnowledgeSourceType.WEBSITE }
      });

      if (existing) {
        const sizeDiff = BigInt(size) - existing.fileSize;
        const updated = await tx.intKnowledgeBase.update({
          where: { id: existing.id },
          data: {
            topic: dto.topic || pageTitle || existing.topic,
            content: content || `ไม่พบเนื้อหา: ${dto.url}`,
            fileSize: BigInt(size),
            updatedAt: new Date() 
          }
        });

        await tx.intAiQuota.update({
          where: { companyId },
          data: { usedStorageBytes: { increment: sizeDiff } }
        });

        return updated; // คืนค่า updated ออกไป
      } else {
        const kb = await tx.intKnowledgeBase.create({
          data: {
            companyId,
            topic: dto.topic || pageTitle || dto.url || 'No Topic',
            content: content || `ไม่พบเนื้อหาที่เป็นข้อความใน: ${dto.url}`,
            sourceType: KnowledgeSourceType.WEBSITE,
            url: dto.url,
            fileSize: BigInt(size),
          },
        });

        await tx.intAiQuota.update({
          where: { companyId },
          data: { usedStorageBytes: { increment: BigInt(size) } }
        });

        return kb; // คืนค่า kb ออกไป
      }
    });

    // ==========================================================
    // 🚀 2. [NEW] สั่งทำ Vector ทันทีหลังจาก Database บันทึกเสร็จ
    // ==========================================================
    if (resultKb.content && !resultKb.content.startsWith('ไม่พบเนื้อหา')) {
      this.generateEmbeddings(resultKb.id, resultKb.content).catch(e => {
        this.logger.error(`❌ WEB Embedding Error: ${e.message}`);
      });
    }

    // 3. ส่งข้อมูลกลับให้หน้าบ้าน
    return this.serialize(resultKb);
  }

  // ==========================================
  // 🚀 5B. Web Site - ส่งเข้าคิว (Async)
  // ==========================================
  async createFromWebQueue(companyId: number, dto: CreateKnowledgeDto) {
    if (!dto.url) throw new BadRequestException('URL is required');

    // 🌟 [FIX] เช็คก่อนว่ามี URL นี้ในฐานข้อมูลหรือยัง
    const existing = await this.prisma.intKnowledgeBase.findFirst({
      where: { companyId, url: dto.url, sourceType: KnowledgeSourceType.WEBSITE }
    });

    if (existing) {
      return {
        message: 'ข้อมูล URL นี้มีอยู่ในระบบ Knowledge Base แล้ว ไม่จำเป็นต้องเข้าคิวซ้ำ',
        jobId: null,
        status: 'COMPLETED',
        url: dto.url
      };
    }

    const job = await this.prisma.intAiBatchJob.create({
      data: {
        companyId: companyId,
        jobType: 'KNOWLEDGE_WEB_SCRAPE',
        status: 'PENDING',
        totalItems: 1,
        processedItems: 0,
        payload: {
          url: dto.url,
          topic: dto.topic || dto.url
        },
      }
    });

    this.logger.log(`🚀 นำ URL เว็บไซต์เข้าคิวสำเร็จ (Job ID: ${job.id})`);

    return {
      message: 'นำ URL เว็บไซต์เข้าสู่ระบบคิวเรียบร้อยแล้ว',
      jobId: job.id,
      status: job.status,
      url: dto.url
    };
  }

  async remove(id: number, companyId: number) {
    const kb = await this.prisma.intKnowledgeBase.findFirst({ where: { id, companyId } });
    if (!kb) throw new NotFoundException('ไม่พบข้อมูล');

    return this.prisma.$transaction(async (tx) => {
      if (kb.sourceType === KnowledgeSourceType.LOCAL && kb.url) {
        await this.uploadService.deleteFromCloud(kb.url);
      }

      if (kb.fileSize > BigInt(0)) {
        await tx.intAiQuota.update({
          where: { companyId },
          data: { usedStorageBytes: { decrement: kb.fileSize } }
        });
      }

      await tx.intKnowledgeBase.delete({ where: { id } });
      return { success: true };
    });
  }

  // =========================================================================
  // 🧠 [NEW CORE] ระบบ RAG Vector Embedding (หั่นไฟล์ & แปลงเป็นตัวเลข)
  // =========================================================================
  // =========================================================================
  // 🧠 [NEW CORE] ระบบ RAG Vector Embedding (หั่นไฟล์ & แปลงเป็นตัวเลข)
  // =========================================================================

  // ✅ 1. เพิ่มให้รับค่าว่าง (null/undefined) ได้
  public splitTextIntoChunks(text: string | null | undefined, chunkSize: number = 1000): string[] {
    if (!text) return []; // ถ้าไม่มีข้อความ ให้คืนค่าอาเรย์ว่างกลับไปเลย
    const lines = text.split('\n'); 
    const chunks: string[] = [];
    let currentChunk = '';

    for (const line of lines) {
      if ((currentChunk.length + line.length) > chunkSize) {
        if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
    return chunks;
  }

  // ✅ 2. เพิ่มให้รับค่าว่าง (null/undefined) ได้
  public async generateEmbeddings(knowledgeBaseId: number, extractedText: string | null | undefined) {
    if (!extractedText) {
      this.logger.warn(`⚠️ ไม่มีข้อความสำหรับ KB ID: ${knowledgeBaseId} ข้ามการสร้าง Vector`);
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY; 
    if (!apiKey) {
      this.logger.warn('⚠️ GEMINI_API_KEY is missing. Skip generating embeddings.');
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
    const embeddingModel = genAI.getGenerativeModel({ model: modelName });

    const chunks = this.splitTextIntoChunks(extractedText);
    this.logger.log(`🔪 Split KB ID ${knowledgeBaseId} into ${chunks.length} chunks.`);

    await this.prisma.intKnowledgeBaseChunk.deleteMany({
      where: { knowledgeBaseId }
    });

    for (const chunkText of chunks) {
      try {
        const result = await embeddingModel.embedContent(chunkText);
        let embeddingValues = result.embedding.values; 

        // ✂️ [NEW] ตัดให้เหลือ 768 มิติ 
        if (embeddingValues.length > 768) {
          embeddingValues = embeddingValues.slice(0, 768);
          const magnitude = Math.sqrt(embeddingValues.reduce((sum, val) => sum + val * val, 0));
          embeddingValues = embeddingValues.map(val => val / magnitude);
        }

        await this.prisma.$executeRawUnsafe(`
          INSERT INTO int_knowledge_base_chunks (id, "knowledgeBaseId", content, embedding)
          VALUES (gen_random_uuid(), $1, $2, $3::vector)
        `, knowledgeBaseId, chunkText, `[${embeddingValues.join(',')}]`);
        
      } catch (error: any) {
        this.logger.error(`❌ Failed to embed chunk: ${error.message}`);
      }
    }

    this.logger.log(`✅ Generated embeddings for KB ID: ${knowledgeBaseId}`);
  }
 
}