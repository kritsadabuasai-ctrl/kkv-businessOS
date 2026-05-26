import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TagsService } from '../../com/tags/tags.service';
import { AiRuntimeService } from '../ai-bots/ai-runtime.service'; 
import { AiProcessStatus, WorkflowStatus } from '@prisma/client';
import axios from 'axios'; 
import * as fs from 'fs';  
import * as crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai'; // ✅ Import Gemini

@Injectable()
export class AiTaggingService {
  private readonly logger = new Logger(AiTaggingService.name);

  constructor(
    private prisma: PrismaService,
    private tagsService: TagsService,
    private aiRuntime: AiRuntimeService, 
  ) {}

  private async getImageBuffer(url: string, source: string): Promise<Buffer> {
    try {
      if (source === 'LOCAL' && !url.startsWith('http')) {
        const path = `./uploads/${url.replace(/^\//, '')}`;
        return fs.readFileSync(path);
      } else {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
      }
    } catch (e: any) {
      this.logger.error(`Failed to load image: ${url}`, e.stack);
      throw new Error(`ไม่สามารถโหลดรูปภาพได้: ${e.message}`);
    }
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
    addedStorageBytes: number = 0 
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
          source: 'PRODUCT_IMAGE_TAG_INSTANT' // ✅ ระบุให้รู้ว่ามาจากการกดทำแบบ Instant
        }
      }),
      this.prisma.intAiQuota.update({
        where: { companyId },
        data: { 
          usedThisMonth: { increment: finalCost },
          usedStorageBytes: { increment: addedStorageBytes }
        }
      })
    ]);

    this.logger.log(`💰 หักโควตา AI (Instant) สำเร็จ: ใช้ Token ${finalCost} | พื้นที่ ${addedStorageBytes} Bytes`);
  }

  // ⚡ 1. ประมวลผลทันที (แบบไม่ต้องเข้าคิว)
  /*
  async tagImagesInstantly(companyId: number, imageIds: number[]) {
    const results: any[] = []; 

    for (const id of imageIds) {
      try {
        const img = await this.prisma.comProductImage.findFirst({
          where: { id, product: { companyId } },
        });

        if (!img) throw new Error('ไม่พบรูปภาพ');

        const imageBuffer = await this.getImageBuffer(img.url, img.source);
        let mimeType = 'image/jpeg';
        if (img.url.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        if (img.url.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

        // 💡 พื้นที่เป็น 0 เพราะรูปนี้อยู่ในระบบและถูกหักพื้นที่ไปตั้งแต่ตอนอัปโหลดแล้ว
        const addedStorageBytes = 0; 

        // --- 1. ดึง AI Bot (Prompt) จากฐานข้อมูล ---
        const aiBot = await this.prisma.intAiBot.findFirst({
          where: { code: 'PRODUCT_AUTO_TAG' },
          orderBy: { companyId: 'desc' } 
        });

        if (!aiBot) throw new Error('ไม่พบบอท PRODUCT_AUTO_TAG ในระบบ');

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('API Key missing');

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: aiBot.modelName || "gemini-1.5-flash" });

        // --- 2. ส่งรูปภาพ + Prompt ไปให้ Gemini Vision ---
        const imagePart = {
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: mimeType
          }
        };

        this.logger.log(`🤖 [Instant] Sending image to Gemini for Auto-Tagging...`);
        const result = await model.generateContent([aiBot.systemPrompt, imagePart]);
        const responseText = result.response.text();
        
        // ล้าง Markdown ```json ... ``` ออกก่อน Parse
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(jsonStr);

        const aiTags = aiData.tags || [];
        const usageTags = aiData.usageTags || [];
        const materialTags = aiData.materialTags || [];

        // รวบรวม Tags ทั้งหมด
        const allTagsToCreate = [...new Set([...aiTags, ...usageTags, ...materialTags])].filter(t => t.trim() !== '');

        // ใช้ฟังก์ชันเดิมของคุณกฤษฎาในการหาหรือสร้าง Tag
        const tagEntities = await this.tagsService.findOrCreateTags(allTagsToCreate);

        // --- 3. อัปเดตข้อมูลรูปภาพ (ผูก ComTag) ให้เสร็จก่อน ---
        await this.prisma.comProductImage.update({
          where: { id: img.id },
          data: {
            aiStatus: AiProcessStatus.COMPLETED,
            aiLastRunAt: new Date(),
            tags: {
              set: [], // เคลียร์ของเก่า (ตามโค้ดต้นฉบับของคุณ)
              connect: tagEntities.map(t => ({ id: t.id }))
            }
          }
        });
        this.logger.log(`✅ [Text] บันทึก Tags ลงฐานข้อมูลสำเร็จ`);

        // --- 4. ดึง Vector จาก AiRuntime ---
        this.logger.log(`👁️ กำลังให้ Vertex AI แปลงรูปเป็น Vector (1536 มิติ)...`);
        let vectorValues: number[] | null = null;
        try {
          vectorValues = await this.aiRuntime.generateImageEmbedding(imageBuffer); 
        } catch (vecErr) {
          this.logger.error(`❌ [Vector] แปลงรูปภาพล้มเหลว: ${vecErr.message}`);
        }

        // --- 5. อัปเดต Image Vector (แบบมี Fallback กัน Error) ---
        if (vectorValues && vectorValues.length === 1536) {
            const vectorString = `[${vectorValues.join(',')}]`;
            try {
                // ลองชื่อตารางแรก (snake_case)
                await this.prisma.$executeRawUnsafe(
                    `UPDATE com_product_images SET "imageVector" = $1::vector WHERE id = $2`,
                    vectorString, img.id
                );
                this.logger.log(`✅ [Vector] ฝัง Vector สำเร็จ (ตาราง com_product_images)`);
            } catch (dbErr) {
                this.logger.warn(`⚠️ [Vector] ไม่พบตาราง com_product_images ระบบกำลังลองชื่อตารางใหม่...`);
                try {
                    // ลองชื่อตารางแบบ PascalCase
                    await this.prisma.$executeRawUnsafe(
                        `UPDATE "ComProductImage" SET "imageVector" = $1::vector WHERE id = $2`,
                        vectorString, img.id
                    );
                    this.logger.log(`✅ [Vector] ฝัง Vector สำเร็จ (ตาราง "ComProductImage")`);
                } catch (fallbackErr) {
                    this.logger.error(`❌ [Vector] บันทึกลง DB ล้มเหลว (ตรวจสอบการติดตั้ง pgvector): ${fallbackErr.message}`);
                }
            }
        }

        // --- 6. หัก Quota (Token) ---
        const promptTokens = result.response.usageMetadata?.promptTokenCount || 0;
        const completionTokens = result.response.usageMetadata?.candidatesTokenCount || 0;
        
        await this.chargeAiQuotaForImage(
          companyId, 
          aiBot.id, 
          aiBot.modelName, 
          promptTokens, 
          completionTokens,
          addedStorageBytes
        );

        results.push({ id, status: 'SUCCESS', tags: allTagsToCreate });
      } catch (e) {
        this.logger.error(`❌ ภาพ ID ${id} ทำงานล้มเหลว:`, e.message);
        await this.prisma.comProductImage.update({
          where: { id },
          data: { aiStatus: AiProcessStatus.FAILED, aiError: e.message }
        });
        results.push({ id, status: 'FAILED', error: e.message });
      }
    }
    return results;
  }
  */

// ⚡ 1. ประมวลผลทันที (แบบไม่ต้องเข้าคิว)
  async tagImagesInstantly(companyId: number, imageIds: number[]) {
    const results: any[] = []; 

    for (const id of imageIds) {
      try {
        const img = await this.prisma.comProductImage.findFirst({
          where: { id, product: { companyId } },
        });

        if (!img) throw new Error('ไม่พบรูปภาพ');

        const imageBuffer = await this.getImageBuffer(img.url, img.source);
        
        // =======================================================
        // 🌟 1. เช็คภาพซ้ำในระบบ (Fingerprint)
        // =======================================================
        const checksum = crypto.createHash('md5').update(imageBuffer).digest('hex');
        const duplicateImg = await this.prisma.comProductImage.findFirst({
          where: { checksum: checksum, aiStatus: AiProcessStatus.COMPLETED },
          include: { tags: true }
        });

        if (duplicateImg) {
          await this.prisma.comProductImage.update({
            where: { id: img.id },
            data: {
              checksum: checksum,
              aiStatus: AiProcessStatus.COMPLETED,
              aiLastRunAt: new Date(),
              tags: {
                set: [], 
                connect: duplicateImg.tags.map(t => ({ id: t.id }))
              }
            }
          });
          
          // คัดลอก Vector
          try {
            const oldVector: any[] = await this.prisma.$queryRawUnsafe(
              `SELECT "imageVector"::text FROM "com_product_images" WHERE id = $1`, duplicateImg.id
            );
            if (oldVector[0]?.imageVector) {
              await this.prisma.$executeRawUnsafe(`UPDATE com_product_images SET "imageVector" = $1::vector WHERE id = $2`, oldVector[0].imageVector, img.id);
            }
          } catch (e) {
             try {
                const oldVector: any[] = await this.prisma.$queryRawUnsafe(
                  `SELECT "imageVector"::text FROM "ComProductImage" WHERE id = $1`, duplicateImg.id
                );
                if (oldVector[0]?.imageVector) {
                  await this.prisma.$executeRawUnsafe(`UPDATE "ComProductImage" SET "imageVector" = $1::vector WHERE id = $2`, oldVector[0].imageVector, img.id);
                }
             } catch (fallbackErr) {}
          }

          results.push({ id, status: 'REUSED', tags: duplicateImg.tags.map(t => t.name) });
          continue; 
        }

        // =======================================================
        // 🤖 2. เรียกใช้งาน Gemini 
        // =======================================================
        let mimeType = 'image/jpeg';
        if (img.url.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        if (img.url.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

        const aiBot = await this.prisma.intAiBot.findFirst({
          where: { code: 'PRODUCT_AUTO_TAG' },
          orderBy: { companyId: 'desc' } 
        });

        if (!aiBot) throw new Error('ไม่พบบอท PRODUCT_AUTO_TAG ในระบบ');

        const apiKey = process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey || '');
        const model = genAI.getGenerativeModel({ model: aiBot.modelName || "gemini-1.5-flash" });

        const imagePart = { inlineData: { data: imageBuffer.toString("base64"), mimeType: mimeType } };

        this.logger.log(`🤖 [Instant] Sending image to Gemini for Auto-Tagging...`);
        const result = await model.generateContent([aiBot.systemPrompt, imagePart]);
        const responseText = result.response.text();
        
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(jsonStr);

        // =======================================================
        // 🌟 3. จัดการ Tags (Sanitize & Split)
        // =======================================================
        const processTags = (tags: any): string[] => {
          if (!tags) return [];
          const rawList = Array.isArray(tags) ? tags : [String(tags)];
          return rawList
            .flatMap(t => String(t).split(',')) 
            .map(t => t.trim())                
            .filter(t => t.length > 0)         
            .filter((value, index, self) => self.indexOf(value) === index); 
        };

        const aiTags = processTags(aiData.tags);
        const usageTags = processTags(aiData.usageTags);
        const materialTags = processTags(aiData.materialTags);

        // รวมร่าง Tags ทั้งหมดเข้าด้วยกัน
        const allTagsToCreate = [...new Set([...aiTags, ...usageTags, ...materialTags])];

        // 🚩 [FIX] ประกาศตัวแปร tagEntities อย่างถูกต้อง และส่ง companyId เป็นพารามิเตอร์แรก
        const tagEntities = await this.tagsService.findOrCreateTags(companyId, allTagsToCreate);

        // 🚩 บันทึกลงตาราง ComProductImage โดยเรียกใช้ tagEntities แบบชัวร์ๆ
        await this.prisma.comProductImage.update({
          where: { id: img.id },
          data: {
            checksum: checksum,
            aiStatus: AiProcessStatus.COMPLETED,
            aiLastRunAt: new Date(),
            tags: {
              set: [], 
              connect: tagEntities.map(t => ({ id: t.id })) 
            }
          }
        });

        // =======================================================
        // 🧠 4. สร้าง Vector Embeddings ด้วย Vertex AI / AiRuntime
        // =======================================================
        try {
          this.logger.log(`👁️ กำลังฝัง Vector สำหรับ Smart Search...`);
          const vectorValues = await this.aiRuntime.generateImageEmbedding(imageBuffer); 
          if (vectorValues && vectorValues.length === 1536) {
            const vectorString = `[${vectorValues.join(',')}]`;
            try {
                await this.prisma.$executeRawUnsafe(`UPDATE com_product_images SET "imageVector" = $1::vector WHERE id = $2`, vectorString, img.id);
            } catch (dbErr) {
                await this.prisma.$executeRawUnsafe(`UPDATE "ComProductImage" SET "imageVector" = $1::vector WHERE id = $2`, vectorString, img.id);
            }
          }
        } catch (vecErr: any) {
          this.logger.warn(`⚠️ [Vector] สร้าง Vector ไม่สำเร็จ ข้ามไปก่อน: ${vecErr.message}`);
        }

        // =======================================================
        // 💰 5. หัก Quota AI
        // =======================================================
        const promptTokens = result.response.usageMetadata?.promptTokenCount || 0;
        const completionTokens = result.response.usageMetadata?.candidatesTokenCount || 0;
        
        await this.chargeAiQuotaForImage(
          companyId, 
          aiBot.id, 
          aiBot.modelName || "gemini-1.5-flash", 
          promptTokens, 
          completionTokens,
          0 // พื้นที่เป็น 0 เพราะหักไปแล้วตั้งแต่ตอน Upload
        );

        results.push({ id, status: 'SUCCESS', tags: allTagsToCreate });
      } catch (e: any) {
        this.logger.error(`❌ ภาพ ID ${id} ทำงานล้มเหลว:`, e.message);
        await this.prisma.comProductImage.update({
          where: { id },
          data: { aiStatus: AiProcessStatus.FAILED, aiError: e.message }
        });
        results.push({ id, status: 'FAILED', error: e.message });
      }
    }
    return results;
  }



  // 🕒 2. สร้าง Batch Job
  async createBatchJob(companyId: number, imageIds?: number[]) {
    let pendingImagesCount = 0;
    let payload = {};

    if (imageIds && imageIds.length > 0) {
      // 🎯 กรณีที่ 1: เลือกรูปมาเองจากหน้าเว็บ (รับ imageIds มา)
      pendingImagesCount = imageIds.length;
      
      // ล็อกสถานะรูปที่เลือกให้เป็น PENDING ทันที เพื่อให้รู้ว่าเข้าคิวแล้ว
      await this.prisma.comProductImage.updateMany({
        where: { id: { in: imageIds }, product: { companyId } },
        data: { aiStatus: AiProcessStatus.PENDING }
      });
      
      payload = { images: imageIds.map(id => ({ id })) };
    } else {
      // 🧹 กรณีที่ 2: ไม่ส่ง ID มา (กดปุ่ม กวาดงานที่ค้างอยู่ทั้งหมด)
      pendingImagesCount = await this.prisma.comProductImage.count({
        where: {
          product: { companyId },
          aiStatus: { in: [AiProcessStatus.PENDING, AiProcessStatus.FAILED] }
        }
      });
      if (pendingImagesCount === 0) return { message: 'ไม่มีรูปภาพที่รอประมวลผล' };
    }

    // สร้างคิวงานส่งให้ Worker จัดการต่อ
    return await this.prisma.intAiBatchJob.create({
      data: {
        companyId,
        jobType: 'PRODUCT_IMAGE_TAG',
        totalItems: pendingImagesCount,
        payload: payload,
        status: WorkflowStatus.PENDING,
      }
    });
  }

  // ⚙️ 3. ตัวรันคิว (Worker แบบเรียกผ่าน Service) 
  // *ข้อแนะนำ: ปัจจุบันย้ายไปรันที่ ai-batch-job.service.ts แล้ว ฟังก์ชันนี้อาจไม่จำเป็นต้องใช้แล้วครับ
  async processBatchJob(jobId: number) {
    const job = await this.prisma.intAiBatchJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    await this.prisma.intAiBatchJob.update({
      where: { id: jobId },
      data: { 
        status: WorkflowStatus.IN_PROGRESS, 
        startedAt: new Date() 
      }
    });

    const images = await this.prisma.comProductImage.findMany({
      where: {
        product: { companyId: job.companyId },
        aiStatus: { in: [AiProcessStatus.PENDING, AiProcessStatus.FAILED] }
      },
      take: 50
    });

    let successCount = 0;
    let failCount = 0;

    for (const img of images) {
      try {
        const imageBuffer = await this.getImageBuffer(img.url, img.source);
        
        // 🌟 เปลี่ยนให้เรียก tagImagesInstantly เพื่อ Reuse โค้ดแทนการเขียนลอจิกซ้ำ
        await this.tagImagesInstantly(job.companyId, [img.id]);

        successCount++;
        await new Promise(r => setTimeout(r, 800));
      } catch (e) {
        failCount++;
      }
    }

    await this.prisma.intAiBatchJob.update({
      where: { id: jobId },
      data: {
        status: WorkflowStatus.APPROVED, 
        completedAt: new Date(),
        processedItems: successCount,
        failedItems: failCount
      }
    });
  }
}