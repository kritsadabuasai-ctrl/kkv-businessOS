import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAiBatchJobDto } from './ai-batch-job.dto';
import { WorkflowStatus, KnowledgeSourceType } from '@prisma/client';
import { FileParserService, ParseResult } from '../file-parser/file-parser.service';
import { UploadService } from '../upload/upload.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai'; // ✅ 1. Import Gemini

@Injectable()
export class AiBatchJobService {
  private readonly logger = new Logger(AiBatchJobService.name);

  constructor(
    private prisma: PrismaService,
    private fileParserService: FileParserService,
    private uploadService: UploadService,
    private googleDriveService: GoogleDriveService
  ) {}

  private async chargeAiQuota(tx: any, companyId: number, parseResult: ParseResult) {
    if (!parseResult.usedAi || !parseResult.aiModelCode) return;

    this.logger.log(`💰 กำลังคำนวณค่าใช้จ่าย AI สำหรับคิว: ${parseResult.pagesProcessed} หน้า...`);

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
    if (!quota) throw new BadRequestException('ไม่พบข้อมูลโควตา AI');

    const monthlyLimit = Number(quota.monthlyLimit);
    const usedThisMonth = Number(quota.usedThisMonth);
    const extraCredit = Number(quota.extraCredit);

    if (usedThisMonth + totalCost > monthlyLimit + extraCredit) {
      throw new Error(`โควตาประมวลผล AI ของคุณไม่เพียงพอ (ต้องการ ${totalCost} Credits)`);
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
        source: 'KNOWLEDGE_BASE_QUEUE'
      }
    });

    this.logger.log(`✅ ตัดโควตาคิวสำเร็จ หักไป ${totalCost} Credits`);
  }

  async processSingleItem(companyId: number, itemInfo: any, type: string) {
    this.logger.log(`Processing ${type} for company ${companyId}: ${itemInfo.topic || itemInfo.fileName || itemInfo.url}`);

    // ==========================================
    // 📁 1. กรณีอัปโหลดไฟล์ (Excel, PDF, etc.)
    // ==========================================
    if (type === 'KNOWLEDGE_UPLOAD_OCR') {
      let fileBuffer: Buffer;
      try {
        fileBuffer = await this.uploadService.downloadFromCloud(itemInfo.fileUrl); 
      } catch (e) {
        throw new Error('ไม่สามารถดาวน์โหลดไฟล์จาก Cloud เพื่อประมวลผลได้');
      }

      const safeMimeType = itemInfo.mimeType || 'application/octet-stream';
      const safeFileName = itemInfo.fileName || 'unknown_file';
      const fileHash = itemInfo.fileHash;

      // ✅ [NEW] ดักจับ Error รหัสผ่าน และ ไฟล์ว่างเปล่า สำหรับคิว
      let parseResult: ParseResult = { text: '', usedAi: false, pagesProcessed: 0 };
      try {
        parseResult = await this.fileParserService.extractText(fileBuffer, safeMimeType, safeFileName);
        
        if (!parseResult.text || parseResult.text.trim() === '') {
          throw new Error('empty_content');
        }
      } catch (error: any) {
        this.logger.warn(`[Batch Worker] Parse error: ${error.message}`);
        const errMsg = (error.message || '').toLowerCase();
        
        // 💡 หมายเหตุ: ใน Worker เราใช้ throw new Error() ธรรมดา 
        // ระบบคิวจะดักจับข้อความเหล่านี้ไปบันทึกลง errorSummary ใน Database ให้เอง
        if (errMsg.includes('password') || errMsg.includes('encrypt') || errMsg.includes('protected')) {
          throw new Error(`ไฟล์ "${safeFileName}" ติดรหัสผ่านป้องกัน (Encrypted) กรุณาปลดรหัสผ่านแล้วอัปโหลดใหม่`);
        }
        if (errMsg === 'empty_content') {
          throw new Error(`ไม่พบข้อความในไฟล์ "${safeFileName}" (อาจเป็นรูปภาพหรือไฟล์สแกนเปล่าๆ)`);
        }
        throw new Error(`อ่านไฟล์ "${safeFileName}" ไม่สำเร็จ: โปรดตรวจสอบความสมบูรณ์ของไฟล์`);
      }

      const finalContent = parseResult.text;
      this.logger.log(`📄 Extracted Content Length: ${finalContent.length} characters`);

      const newKb = await this.prisma.$transaction(async (tx) => {
        if (parseResult.usedAi) {
          await this.chargeAiQuota(tx, companyId, parseResult);
        }

        const existing = await tx.intKnowledgeBase.findFirst({
          where: { companyId, fileName: safeFileName, sourceType: KnowledgeSourceType.LOCAL }
        });

        if (existing) {
          return await tx.intKnowledgeBase.update({
            where: { id: existing.id },
            data: {
              topic: itemInfo.topic || safeFileName,
              content: finalContent,
              url: itemInfo.fileUrl,
              fileSize: BigInt(itemInfo.fileSize || 0),
              fileHash: fileHash,
              updatedAt: new Date()
            }
          });
        } else {
          return await tx.intKnowledgeBase.create({
            data: {
              companyId: companyId,
              topic: itemInfo.topic || safeFileName,
              content: finalContent,
              sourceType: KnowledgeSourceType.LOCAL,
              fileName: safeFileName,
              fileSize: BigInt(itemInfo.fileSize || 0),
              url: itemInfo.fileUrl,
              fileHash: fileHash,
              isActive: true,
            },
          });
        }
      });

      // =======================================================
      // 🌟 [NEW] สะพานเชื่อมกลับ: ผูก KB ID เข้ากับ Document File
      // =======================================================
      if (itemInfo.docFileId) {
        await this.prisma.docFile.update({
          where: { id: Number(itemInfo.docFileId) },
          data: { knowledgeBaseId: newKb.id }
        });
        this.logger.log(`🔗 ผูก KB ID ${newKb.id} เข้ากับ Document ID ${itemInfo.docFileId} สำเร็จ!`);
      }

      this.generateEmbeddings(newKb.id, newKb.content).catch(e => this.logger.error(e));
      return newKb;
    }

    // ==========================================
    // ☁️ 2. กรณี Google Drive
    // ==========================================
    if (type === 'KNOWLEDGE_DRIVE_OCR') {
      let driveFile;
      try {
        driveFile = await this.googleDriveService.getFile(companyId, itemInfo.fileId);
      } catch (e : any) {
        throw new Error(`ไม่สามารถดาวน์โหลดไฟล์จาก Google Drive ได้: ${e.message}`);
      }

      const safeMimeType = driveFile.mimetype || 'application/octet-stream';
      const safeFileName = itemInfo.fileName || 'unknown_file';

      // ✅ [NEW] ดักจับ Error รหัสผ่าน และ ไฟล์ว่างเปล่า สำหรับ Google Drive
      let parseResult: ParseResult = { text: '', usedAi: false, pagesProcessed: 0 };
      try {
        parseResult = await this.fileParserService.extractText(driveFile.buffer, safeMimeType, safeFileName);
        
        // ถ้าอ่านแล้วได้เนื้อหาว่างเปล่าเลย
        if (!parseResult.text || parseResult.text.trim() === '') {
          throw new Error('empty_content');
        }
      } catch (error: any) {
        this.logger.warn(`[Batch Worker - Drive] Parse error: ${error.message}`);
        const errMsg = (error.message || '').toLowerCase();
        
        // โยน Error ออกไปให้ Worker จัดการเปลี่ยนสถานะคิวเป็นล้มเหลว และโชว์หน้าเว็บ
        if (errMsg.includes('password') || errMsg.includes('encrypt') || errMsg.includes('protected')) {
          throw new Error(`ไฟล์ "${safeFileName}" จาก Google Drive ติดรหัสผ่านป้องกัน (Encrypted) กรุณาปลดรหัสผ่านก่อนนำเข้า`);
        }
        if (errMsg === 'empty_content') {
          throw new Error(`ไม่พบข้อความในไฟล์ "${safeFileName}" (อาจเป็นรูปภาพหรือไฟล์สแกนเปล่าๆ)`);
        }
        throw new Error(`อ่านไฟล์ "${safeFileName}" ไม่สำเร็จ: โปรดตรวจสอบความสมบูรณ์ของไฟล์`);
      }

      // ถ้าผ่านมาได้ แปลว่ามีข้อความ
      const finalContent = parseResult.text;

      const newKb = await this.prisma.$transaction(async (tx) => {
        if (parseResult.usedAi) {
          await this.chargeAiQuota(tx, companyId, parseResult);
        }

        const existing = await tx.intKnowledgeBase.findFirst({
          where: { companyId, fileId: itemInfo.fileId, sourceType: KnowledgeSourceType.GOOGLE_DRIVE }
        });

        if (existing) {
          return await tx.intKnowledgeBase.update({
            where: { id: existing.id },
            data: {
              content: finalContent,
              fileSize: BigInt(driveFile.buffer.length),
              updatedAt: new Date()
            }
          });
        } else {
          return await tx.intKnowledgeBase.create({
            data: {
              companyId: companyId,
              topic: itemInfo.topic || safeFileName,
              content: finalContent,
              sourceType: KnowledgeSourceType.GOOGLE_DRIVE,
              fileName: safeFileName,
              fileSize: BigInt(driveFile.buffer.length),
              url: itemInfo.url,
              fileId: itemInfo.fileId,
              isActive: true,
            },
          });
        }
      });

      // =======================================================
      // 🌟 [NEW] สะพานเชื่อมกลับ: ผูก KB ID เข้ากับ Document File (ถ้ามีส่งมา)
      // =======================================================
      if (itemInfo.docFileId) {
        await this.prisma.docFile.update({
          where: { id: Number(itemInfo.docFileId) },
          data: { knowledgeBaseId: newKb.id }
        });
        this.logger.log(`🔗 ผูก KB ID ${newKb.id} เข้ากับ Document ID ${itemInfo.docFileId} สำเร็จ (จาก Google Drive)!`);
      }

      this.generateEmbeddings(newKb.id, newKb.content).catch(e => this.logger.error(e));
      return newKb;
    }

    // ==========================================
    // 🕸️ 3. กรณี Web Scraping
    // ==========================================
    if (type === 'KNOWLEDGE_WEB_SCRAPE') {
      try {
        // ✅ เพิ่ม Headers จำลองตัวเองเป็น Google Chrome
        const response = await axios.get(itemInfo.url, { 
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
        const $ = cheerio.load(html);
        $('script, style, noscript, iframe, header, footer, nav').remove();
        const content = $('body').text().replace(/\s+/g, ' ').trim();
        const fileSize = Buffer.byteLength(html, 'utf8');

        const newKb = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.intKnowledgeBase.findFirst({
            where: { companyId, url: itemInfo.url, sourceType: KnowledgeSourceType.WEBSITE }
          });

          if (existing) {
            return await tx.intKnowledgeBase.update({
              where: { id: existing.id },
              data: {
                content: content || `ไม่พบเนื้อหา: ${itemInfo.url}`,
                fileSize: BigInt(fileSize),
                updatedAt: new Date()
              }
            });
          } else {
            return await tx.intKnowledgeBase.create({
              data: {
                companyId: companyId,
                topic: itemInfo.topic || itemInfo.url,
                content: content || `ไม่พบเนื้อหาที่เป็นข้อความใน: ${itemInfo.url}`,
                sourceType: KnowledgeSourceType.WEBSITE,
                url: itemInfo.url,
                fileSize: BigInt(fileSize),
                isActive: true,
              },
            });
          }
        });

        this.generateEmbeddings(newKb.id, newKb.content).catch(e => this.logger.error(e));
        return newKb;
      } catch (e: any) {
         // ✅ ดักจับ Error เพื่อวิเคราะห์ระบบป้องกัน Bot
         if (e.response) {
            const status = e.response.status;
            const server = (e.response.headers['server'] || '').toLowerCase();
            const isCloudflare = server.includes('cloudflare');
            const isAkamai = server.includes('akamai');

            // ถ้าเจอ 403 หรือ 503 และเป็น Server ยอดฮิตที่ใช้บล็อก Bot
            if (status === 403 || status === 503) {
               if (isCloudflare || isAkamai) {
                  throw new Error(`ไม่สามารถดูดข้อมูลได้: เว็บไซต์ ${itemInfo.url} มีระบบป้องกัน Bot ระดับสูง (${server}) กรุณาก๊อปปี้ข้อความมาสร้างเป็น Text แทนครับ`);
               } else {
                  throw new Error(`ไม่สามารถดูดข้อมูลได้: เว็บไซต์ปฏิเสธการเข้าถึง (Error ${status}) อาจมีการบล็อก IP หรือมีระบบป้องกันอัตโนมัติ กรุณาก๊อปปี้ข้อความมาสร้างเป็น Text แทนครับ`);
               }
            }
         }
         
         // Error อื่นๆ (เช่น Timeout, Network Error)
         throw new Error(`ไม่สามารถ Scrape Web ได้: ${e.message}`);
      }
    }

    throw new Error(`ไม่รู้จักประเภทงาน (Job Type): ${type}`);
  }

  // ==========================================
  // ⚙️ ฟังก์ชันจัดการคิวงาน (Queue Management)
  // ==========================================
  async createJob(companyId: number, dto: CreateAiBatchJobDto) {
    
    // 🌟 [NEW] ดักจับงาน AI Tag รูปภาพ: ล็อกสถานะรูปเป็น PENDING ทันที
    if (dto.jobType === 'PRODUCT_IMAGE_TAG' && dto.payload?.images) {
      const imageIds = dto.payload.images.map((img: any) => Number(img.id));
      if (imageIds.length > 0) {
        await this.prisma.comProductImage.updateMany({
          where: { id: { in: imageIds }, product: { companyId } },
          data: { aiStatus: 'PENDING' } // 🛑 เปลี่ยนจาก null เป็น PENDING ให้คนงานเห็น!
        });
        this.logger.log(`🔄 Locked ${imageIds.length} images to PENDING state for AI.`);
      }
    }

    return this.prisma.intAiBatchJob.create({
      data: {
        companyId,
        jobType: dto.jobType,
        totalItems: dto.totalItems,
        payload: dto.payload || {},
        status: WorkflowStatus.PENDING, 
        startedAt: new Date(),
      },
    });
  }

  async getCompanyJobs(companyId: number) {
    return this.prisma.intAiBatchJob.findMany({
      where: { companyId },
      orderBy: { startedAt: 'desc' }, 
      take: 50,
    });
  }

 async pickPendingJob() {
    // 🛑 แก้ไข SQL: ดึงเฉพาะงานที่ 'PENDING' เท่านั้น (ห้ามดึง APPROVED เด็ดขาด!)
    const jobs = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM "int_ai_batch_jobs"
      WHERE "status" = 'PENDING'
      ORDER BY "startedAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    
    if (jobs.length > 0) {
      const job = jobs[0];
      await this.prisma.intAiBatchJob.update({
        where: { id: job.id },
        data: { status: WorkflowStatus.IN_PROGRESS } // เปลี่ยนสถานะเป็นกำลังทำงาน
      });
      return job;
    }
    return null;
  }


  async updateProgress(jobId: number, successCount: number, failCount: number) {
    await this.prisma.intAiBatchJob.update({
      where: { id: jobId },
      data: { 
        // 🌟 เปลี่ยนมาใช้ตัวแปร Enum แทน String เพื่อให้ TypeScript ผ่าน
        status: WorkflowStatus.IN_PROGRESS,
        processedItems: { increment: successCount },
        failedItems: { increment: failCount },
        
      }
    });
  }

  async completeJob(jobId: number, summary?: string) {
    return this.prisma.intAiBatchJob.update({
      where: { id: jobId },
      data: { status: WorkflowStatus.APPROVED, completedAt: new Date(), errorSummary: summary },
    });
  }

  async failJob(jobId: number, errorMsg: string) {
    return this.prisma.intAiBatchJob.update({
      where: { id: jobId },
      data: { status: WorkflowStatus.REJECTED, completedAt: new Date(), errorSummary: errorMsg },
    });
  }

  async cancelJob(id: number, companyId: number) {
    const job = await this.prisma.intAiBatchJob.findFirst({ where: { id, companyId } });
    if (!job) throw new NotFoundException('ไม่พบข้อมูลคิวงาน');
    if (job.status === 'IN_PROGRESS') throw new BadRequestException('ไม่สามารถยกเลิกงานที่กำลังประมวลผลอยู่ได้');
    return this.prisma.intAiBatchJob.update({
      where: { id },
      data: { status: WorkflowStatus.REJECTED, errorSummary: 'ยกเลิกโดยผู้ใช้งาน', completedAt: new Date() }
    });
  }

  async retryJob(id: number, companyId: number) {
    const job = await this.prisma.intAiBatchJob.findFirst({ where: { id, companyId } });
    if (!job) throw new NotFoundException('ไม่พบข้อมูลคิวงาน');
    if (job.status === 'PENDING' || job.status === 'IN_PROGRESS') throw new BadRequestException('งานนี้อยู่ในคิวหรือกำลังทำงานอยู่แล้ว ไม่สามารถทำซ้ำได้');
    return this.prisma.intAiBatchJob.update({
      where: { id },
      data: { status: WorkflowStatus.PENDING, processedItems: 0, failedItems: 0, errorSummary: null, startedAt: new Date(), completedAt: null }
    });
  }

  async moveJobPriority(id: number, companyId: number, position: 'FRONT' | 'BACK') {
    const job = await this.prisma.intAiBatchJob.findFirst({ where: { id, companyId } });
    if (!job) throw new NotFoundException('ไม่พบข้อมูลคิวงาน');
    if (job.status !== 'PENDING') throw new BadRequestException('สามารถเลื่อนคิวได้เฉพาะงานที่รอดำเนินการ (Pending) เท่านั้น');
    let newStartedAt = new Date();
    if (position === 'FRONT') {
      const firstJob = await this.prisma.intAiBatchJob.findFirst({
        where: { companyId, status: 'PENDING' },
        orderBy: { startedAt: 'asc' }
      });
      if (firstJob) newStartedAt = new Date(firstJob.startedAt.getTime() - 1000);
    } 
    return this.prisma.intAiBatchJob.update({ where: { id }, data: { startedAt: newStartedAt } });
  }

  async deleteJob(id: number, companyId: number) {
    const job = await this.prisma.intAiBatchJob.findFirst({ where: { id, companyId } });
    if (!job) throw new NotFoundException('ไม่พบข้อมูลคิวงาน');
    if (job.status === 'IN_PROGRESS') throw new BadRequestException('ไม่สามารถลบงานที่กำลังประมวลผลอยู่ได้');
    await this.prisma.intAiBatchJob.delete({ where: { id } });
    return { success: true, message: 'ลบข้อมูลคิวงานสำเร็จ' };
  }

  // =========================================================================
  // 🧠 [NEW] ระบบ RAG Vector Embedding (หั่นไฟล์ & แปลงเป็นตัวเลขสำหรับ Worker)
  // =========================================================================

  private splitTextIntoChunks(text: string, chunkSize: number = 1000): string[] {
    if (!text) return [];
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


 

 // ==========================================
  // [NEW] ฟังก์ชันประมวลผลรูปภาพสินค้า + Auto Tags (แบบเข้าคิว)
  // ==========================================
 // ==========================================
  // [NEW] ฟังก์ชันประมวลผลรูปภาพสินค้า + Auto Tags (แบบเข้าคิว)
  // ==========================================
  async processProductImage(companyId: number, payload: any) {
    const productId = payload.productId;
    
    // ดึงรายการรูปภาพ
    const imagesToProcess = payload.images && Array.isArray(payload.images) 
      ? payload.images 
      : [payload];

    for (const imgItem of imagesToProcess) {
      const imageId = imgItem.id || imgItem.imageId; 

      if (!imageId) {
        this.logger.warn(`⚠️ ไม่พบ ID ของรูปภาพ ข้ามการทำงาน`);
        continue;
      }

      this.logger.log(`📸 Processing Product Image ID: ${imageId} ...`);

      try {
        // 🌟 1. เอา ID ไปดึงข้อมูลรูปภาพแบบเต็มจาก Database
        const dbImg = await this.prisma.comProductImage.findUnique({
          where: { id: Number(imageId) }
        });

        if (!dbImg) throw new Error('ไม่พบข้อมูลรูปภาพในฐานข้อมูล');

        const isGoogleDrive = dbImg.source === 'GOOGLE_DRIVE';
        let finalImageUrl = dbImg.url;
        let imageBuffer: Buffer;
        let mimeType = 'image/jpeg';
        let addedStorageBytes = 0; // ✅ ตัวแปรเก็บขนาดไฟล์ที่จะถูกหักโควตาพื้นที่

        // --- 2. จัดการรูปภาพ (ดึงเป็น Buffer เพื่อให้ AI ดู) ---
        if (isGoogleDrive) {
          const actualFileId = dbImg.fileId || finalImageUrl.split('/').pop() || finalImageUrl;
          const driveFile = await this.googleDriveService.getFile(companyId, actualFileId);
          imageBuffer = driveFile.buffer;
          mimeType = driveFile.mimetype || 'image/jpeg';
          
          // ระบบโยนไฟล์จาก Google Drive เข้ามาเก็บที่ Cloud ของเรา
          const uploadResult = await this.uploadService.saveToCloud(
            { 
              buffer: imageBuffer, 
              originalname: driveFile.name || dbImg.fileName || 'image.jpg', 
              mimetype: mimeType 
            } as any,
            companyId,
            'product-image'
          );
          finalImageUrl = uploadResult;
          
          // ❌ [เดิม] addedStorageBytes = imageBuffer.length; 
          // ✅ [แก้เป็น] ตั้งเป็น 0 เพราะ uploadService.saveToCloud น่าจะหักโควตาพื้นที่ไปแล้ว
          addedStorageBytes = 0;

        } else {
          // 💡 ดึงรูปรองรับทั้ง Local Folder และ HTTP URL
          if (dbImg.source === 'LOCAL' && finalImageUrl && !finalImageUrl.startsWith('http')) {
            const fs = require('fs');
            const path = `./uploads/${finalImageUrl.replace(/^\//, '')}`;
            imageBuffer = fs.readFileSync(path);
          } else {
            const axios = require('axios');
            const response = await axios.get(finalImageUrl, { responseType: 'arraybuffer' });
            imageBuffer = Buffer.from(response.data);
          }
        }

        if (finalImageUrl.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        if (finalImageUrl.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

        // =======================================================
        // 🌟 3. สร้าง Fingerprint (MD5) และตรวจสอบรูปซ้ำสำหรับระบบคิว
        // =======================================================
        const crypto = require('crypto');
        const checksum = crypto.createHash('md5').update(imageBuffer).digest('hex');

        const duplicateImg = await this.prisma.comProductImage.findFirst({
          where: {
            checksum: checksum,
            aiStatus: 'COMPLETED',
          },
          include: { tags: true }
        });

        if (duplicateImg) {
          this.logger.log(`♻️ [Batch Queue] พบรูปซ้ำ (Hash: ${checksum}) คัดลอก Tags & Vector อัตโนมัติ...`);
          
          // อัปเดตข้อมูลตัวปัจจุบันโดยใช้ข้อมูลจากตัวเก่า
          await this.prisma.comProductImage.update({
            where: { id: Number(imageId) },
            data: {
              url: finalImageUrl,
              checksum: checksum,
              aiStatus: 'COMPLETED',
              aiLastRunAt: new Date(),
              tags: {
                set: [],
                connect: duplicateImg.tags.map(t => ({ id: t.id }))
              }
            }
          });

          // คัดลอก Vector จากรูปเดิม
          try {
            const oldVector: any[] = await this.prisma.$queryRawUnsafe(
              `SELECT "imageVector"::text FROM "ComProductImage" WHERE id = $1`, 
              duplicateImg.id
            );
            const vectorStr = oldVector[0]?.imageVector;
            
            if (vectorStr) {
              try {
                await this.prisma.$executeRawUnsafe(`UPDATE com_product_images SET "imageVector" = $1::vector WHERE id = $2`, vectorStr, Number(imageId));
              } catch (dbErr) {
                await this.prisma.$executeRawUnsafe(`UPDATE "ComProductImage" SET "imageVector" = $1::vector WHERE id = $2`, vectorStr, Number(imageId));
              }
              this.logger.log(`✅ [Vector] คัดลอก Vector สำเร็จสำหรับคิว`);
            }
          } catch (e : any) {
             this.logger.warn(`⚠️ [Vector] ไม่สามารถคัดลอก Vector ได้: ${e.message}`);
          }

          continue; // 🚀 เสร็จแล้ว! กระโดดข้ามไปทำรูปถัดไปในคิวทันทีโดยไม่เรียก AI
        }
        // =======================================================

        // --- 4. ดึง AI Bot (Prompt) จากฐานข้อมูล ---
        const aiBot = await this.prisma.intAiBot.findFirst({
          where: { code: 'PRODUCT_AUTO_TAG' },
          orderBy: { companyId: 'desc' } 
        });

        if (!aiBot) throw new Error('ไม่พบบอท PRODUCT_AUTO_TAG ในระบบ');

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('API Key missing');

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: aiBot.modelName || "gemini-1.5-flash" });

        // --- 5. ส่งรูปภาพ + Prompt ไปให้ Gemini Vision ---
        const imagePart = {
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: mimeType
          }
        };

        this.logger.log(`🤖 Sending image to Gemini for Auto-Tagging...`);
        const result = await model.generateContent([aiBot.systemPrompt, imagePart]);
        const responseText = result.response.text();
        
        // ล้าง Markdown ```json ... ``` ออกก่อน Parse
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(jsonStr);

        const aiTags = aiData.tags || [];
        const usageTags = aiData.usageTags || [];
        const materialTags = aiData.materialTags || [];

        // ✅ รวบรวม Tags ทั้งหมด
        const allTagsToCreate = [...new Set([...aiTags, ...usageTags, ...materialTags])].filter(t => t.trim() !== '');

        // --- 6. 🛑 อัปเดตสถานะรูปภาพเดิม + ผูก ComTag ---
        const updatedImage = await this.prisma.comProductImage.update({
          where: { id: Number(imageId) },
          data: {
            url: finalImageUrl, 
            checksum: checksum, // 🌟 เพิ่มการบันทึก Hash ตรงนี้
            aiStatus: 'COMPLETED',
            aiLastRunAt: new Date(),
            tags: {
              // 🚩 แก้ไขตรงนี้: เปลี่ยนจาก tags.map เป็น allTagsToCreate.map
              connectOrCreate: allTagsToCreate.map(tag => ({
                where: { 
                  companyId_name: { 
                    companyId: companyId,
                    name: tag 
                  } 
                },
                create: { 
                  companyId: companyId,
                  name: tag 
                }
              }))
            }
          }
        });

       // --- 7. สร้าง Vector (1536 มิติ) สำหรับ Visual Search ---
        try {
          const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
          const textToEmbed = `สินค้า: ${aiTags.join(', ')} วัสดุ: ${materialTags.join(', ')} การใช้งาน: ${usageTags.join(', ')}`;
          const embedResult = await embedModel.embedContent(textToEmbed);
          let vectorValues = embedResult.embedding.values;

          // รองรับการบันทึก Vector ทั้งแบบ snake_case และ PascalCase
          try {
            await this.prisma.$executeRawUnsafe(`
              UPDATE com_product_images 
              SET "imageVector" = $1::vector 
              WHERE id = $2
            `, `[${vectorValues.join(',')}]`, updatedImage.id);
          } catch (dbErr) {
             await this.prisma.$executeRawUnsafe(`
              UPDATE "ComProductImage" 
              SET "imageVector" = $1::vector 
              WHERE id = $2
            `, `[${vectorValues.join(',')}]`, updatedImage.id);
          }
          
          this.logger.log(`✅ Vector Image Embeddings Saved for Image ID: ${imageId}`);
        } catch (vecErr : any) {
          this.logger.warn(`⚠️ Vector Generation Skipped: ${vecErr.message}`);
        }

        // --- 8. หัก Quota (ทั้ง Token AI และ Storage) ---
        const promptTokens = result.response.usageMetadata?.promptTokenCount || 0;
        const completionTokens = result.response.usageMetadata?.candidatesTokenCount || 0;
        
        await this.chargeAiQuotaForImage(
          companyId, 
          aiBot.id, 
          aiBot.modelName, 
          promptTokens, 
          completionTokens,
          addedStorageBytes // ✅ ส่งยอดไฟล์ภาพไปบันทึกลง Quota Storage ด้วย!
        );
      } catch (error: any) {
        this.logger.error(`❌ processProductImage Error for Image ID ${imageId}: ${error.message}`);
        await this.prisma.comProductImage.update({
          where: { id: Number(imageId) },
          data: { aiStatus: 'FAILED', aiError: error.message }
        });
        throw error;
      }
    } 
    return { success: true };
  }


  /**
   * 📊 ฟังก์ชันคำนวณประเมินค่าใช้จ่าย AI ก่อนเริ่มงานจริง
   * @param companyId ID ของบริษัท
   * @param imageCount จำนวนรูปภาพที่จะประมวลผล
   * @returns ข้อมูลการประเมินและสถานะโควตา
   */
  async preCalculateImageTagging(companyId: number, imageCount: number) {
    // 1. ตั้งค่ามาตรฐาน (Average tokens per image) 
    // ปกติ Gemini Vision รวม Prompt + Output จะอยู่ราวๆ 150-250 tokens ต่อรูป
    const AVG_TOKENS_PER_IMAGE = 200; 
    const estimatedTotalTokens = imageCount * AVG_TOKENS_PER_IMAGE;

    // 2. ดึงข้อมูลโควตาปัจจุบันจาก Database
    const quota = await this.prisma.intAiQuota.findUnique({
      where: { companyId }
    });

    if (!quota) {
      throw new BadRequestException('ไม่พบข้อมูลโควตาสำหรับบริษัทของคุณ');
    }

    // 3. คำนวณยอดคงเหลือ
    const monthlyLimit = Number(quota.monthlyLimit) || 0;
    const extraCredit = Number(quota.extraCredit) || 0;
    const usedThisMonth = Number(quota.usedThisMonth) || 0;
    
    const totalCap = monthlyLimit + extraCredit;
    const availableTokens = totalCap - usedThisMonth;

    // 4. ตรวจสอบว่าพอหรือไม่
    const isEnough = availableTokens >= estimatedTotalTokens;

    return {
      estimation: {
        imageCount,
        avgTokensPerImage: AVG_TOKENS_PER_IMAGE,
        estimatedTotalTokens,
      },
      quota: {
        availableTokens,
        usedThisMonth,
        totalLimit: totalCap,
      },
      isEnough,
      message: isEnough 
        ? 'โควตาเพียงพอสำหรับการประมวลผล' 
        : `โควตาไม่เพียงพอ ขาดอีกประมาณ ${estimatedTotalTokens - availableTokens} Tokens`
    };
  }

// ==========================================
  // [NEW] ฟังก์ชันจัดการเรื่องบิลลิ่ง (Token & Storage)
  // ==========================================
  private async chargeAiQuotaForImage(
    companyId: number, 
    botId: number, 
    modelName: string, 
    promptTokens: number, 
    completionTokens: number,
    addedStorageBytes: number = 0 // ✅ เพิ่มพารามิเตอร์สำหรับพื้นที่ Storage
  ) {
    const totalTokens = promptTokens + completionTokens;
    const baseCost = totalTokens > 0 ? totalTokens : 150; 

    // 1. ดึงเรทราคาจากตาราง SysAiModelConfig
    const modelConfig = await this.prisma.sysAiModelConfig.findFirst({
      where: {
        modelCode: modelName,
        OR: [{ companyId: companyId }, { companyId: null }]
      },
      orderBy: { companyId: 'desc' }
    });

    // 2. คำนวณยอด Token ที่ต้องหักจริง
    const multiplier = modelConfig ? Number(modelConfig.markupMultiplier) : 1.0;
    const finalCost = Math.ceil(baseCost * multiplier);

    // 3. อัปเดต Quota และสร้าง Log บิลลิ่ง
    await this.prisma.$transaction([
      this.prisma.intAiUsageLog.create({
        data: {
          companyId,
          aiBotId: botId,
          modelName: modelName,
          promptTokens: promptTokens,
          completionTokens: completionTokens,
          totalTokens: finalCost,
          source: 'PRODUCT_IMAGE_TAG'
        }
      }),
      this.prisma.intAiQuota.update({
        where: { companyId },
        data: { 
          usedThisMonth: { increment: finalCost }, // 📉 หัก Token AI
          usedStorageBytes: { increment: addedStorageBytes } // 💾 เพิ่มยอดการใช้พื้นที่ Storage
        }
      })
    ]);

    this.logger.log(`💰 หักโควตา AI สำเร็จ: ใช้ Token ${finalCost} | ใช้พื้นที่เพิ่ม ${addedStorageBytes} Bytes`);
  }


 

  private async generateEmbeddings(knowledgeBaseId: number, extractedText: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('⚠️ GEMINI_API_KEY is missing. Skip generating embeddings.');
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
    const embeddingModel = genAI.getGenerativeModel({ model: modelName });

    const chunks = this.splitTextIntoChunks(extractedText);
    this.logger.log(`🔪 [Batch Worker] Split KB ID ${knowledgeBaseId} into ${chunks.length} chunks.`);

    await this.prisma.intKnowledgeBaseChunk.deleteMany({
      where: { knowledgeBaseId }
    });

    for (const chunkText of chunks) {
      try {
        const result = await embeddingModel.embedContent(chunkText);
        let embeddingValues = result.embedding.values; 

        // ✂️ [NEW] ตัดให้เหลือ 768 มิติ และปรับสมดุล (Normalization) ก่อนยัดลง DB
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
        this.logger.error(`❌ [Batch Worker] Failed to embed chunk: ${error.message}`);
      }
    }
    this.logger.log(`✅ [Batch Worker] Generated embeddings for KB ID: ${knowledgeBaseId}`);
  }
}