import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { PrismaService } from '../../../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CloudConfigsService } from '../cloud-configs/cloud-configs.service';

@Injectable()
export class AiRuntimeService {
  private readonly logger = new Logger(AiRuntimeService.name);

  // 🌟 กำหนด Scope ขอสิทธิ์ระดับ Cloud Platform
  private googleAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  constructor(
    private prisma: PrismaService,
    private cloudConfigsService: CloudConfigsService,
  ) {}

  /**
   * ✅ ดึง API Key
   */
  private async getGenAIInstance(companyId: number, provider: string): Promise<GoogleGenerativeAI> {
    const envKey = process.env[`${provider}_API_KEY`] || process.env.GEMINI_API_KEY;

    if (envKey) {
      return new GoogleGenerativeAI(envKey);
    }

    const configs = await this.cloudConfigsService.findAll(companyId);
    const targetConfig = configs.find(c => c.provider === provider && c.isActive);

    if (targetConfig) {
      try {
        const data = JSON.parse(targetConfig.configData);
        if (data.apiKey) return new GoogleGenerativeAI(data.apiKey);
      } catch (e) {
        this.logger.error('Invalid API Key configuration in DB');
      }
    }

    throw new NotFoundException(`ไม่พบ API Key (กรุณาตั้งค่า GEMINI_API_KEY ใน Env)`);
  }

  /**
   * ✅ ตรวจสอบโควตา Token
   */
  private async checkQuota(companyId: number) {
    const quota = await this.prisma.intAiQuota.findUnique({ where: { companyId } });
    if (!quota) return;

    if (quota.monthlyLimit > BigInt(0) && quota.usedThisMonth >= quota.monthlyLimit) {
      throw new ForbiddenException('ขออภัย โควตา AI ของบริษัทคุณหมดแล้วในเดือนนี้');
    }
  }

  /**
   * ✅ 1. ฟังก์ชัน Chat (Internal Use)
   * 🌟 เพิ่มรองรับ parameter: userId, roleId
   */
  async chat(botId: number, message: string, companyId: number, imageBase64?: string | null, userId?: number, roleId?: number) {
    await this.checkQuota(companyId);
    
    const bot = await this.prisma.intAiBot.findFirst({
      where: { id: botId, companyId }
    });
    if (!bot) throw new NotFoundException('ไม่พบข้อมูลบอทในระบบ');

    return this.executeChat(bot, message, companyId, imageBase64, userId, roleId);
  }

  /**
   * ✅ 2. ฟังก์ชัน Chat By Code (Controller Use)
   * 🌟 เพิ่มรองรับ parameter: userId, roleId
   */
  async chatByCode(botCode: string, message: string, companyId: number, imageBase64?: string | null, userId?: number, roleId?: number) {
    await this.checkQuota(companyId);
    
    const bot = await this.prisma.intAiBot.findFirst({
      where: { code: botCode, companyId }
    });
    if (!bot) throw new NotFoundException(`ไม่พบ AI Bot รหัส: ${botCode}`);

    return this.executeChat(bot, message, companyId, imageBase64, userId, roleId);
  }

  /**
   * ✅ 3. ฟังก์ชันวิเคราะห์รูปภาพ (Image Tagging)
   */
  async generateTagsFromImage(imageBuffer: Buffer, companyId: number, mimeType: string = 'image/jpeg'): Promise<string[]> {
    await this.checkQuota(companyId);
    
    const genAI = await this.getGenAIInstance(companyId, 'GEMINI');
    const modelName = process.env.GEMINI_VISION_MODEL || "models/gemini-2.0-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = "วิเคราะห์รูปภาพสินค้านี้และสร้างคีย์เวิร์ดภาษาไทยที่เกี่ยวข้อง 5-10 คำ คั่นด้วยเครื่องหมายคอมมา (,)";
    const imageParts = [{ inlineData: { data: imageBuffer.toString("base64"), mimeType: mimeType } }];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    
    await this.recordUsage(
      companyId, 
      undefined, 
      modelName, 
      response.usageMetadata?.promptTokenCount || 0, 
      response.usageMetadata?.candidatesTokenCount || 0, 
      'IMAGE_TAGGING'
    );

    return response.text().split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }

  /**
   * ✅ 4. Logic การประมวลผล RAG & Vector Search
   * 🌟 เพิ่มรองรับ parameter: userId, roleId
   */
  private async executeChat(bot: any, message: string, companyId: number, imageBase64?: string | null, userId?: number, roleId?: number) {
    try {
      const genAI = await this.getGenAIInstance(companyId, bot.provider);
      let contextText = '';

      // =======================================================
      // 🛒 [NEW] ถ้ารับรูปภาพจาก LINE -> วิ่งไปค้นหาสินค้าในสต็อกให้ทันที!
      // =======================================================
      if (imageBase64) {
        try {
          const imageBuffer = Buffer.from(imageBase64, 'base64');
          const vectorValues = await this.generateImageEmbedding(imageBuffer);
          const vectorString = `[${vectorValues.join(',')}]`;

          // ลองค้นหาในตาราง
          let matchingRecords: any[] = [];
          try {
            matchingRecords = await this.prisma.$queryRawUnsafe<any[]>(`
              SELECT "productId", MAX(1 - ("imageVector" <=> $1::vector)) as similarity
              FROM com_product_images WHERE "imageVector" IS NOT NULL GROUP BY "productId" ORDER BY similarity DESC LIMIT 3;
            `, vectorString);
          } catch(e) {
             matchingRecords = await this.prisma.$queryRawUnsafe<any[]>(`
              SELECT "productId", MAX(1 - ("imageVector" <=> $1::vector)) as similarity
              FROM "ComProductImage" WHERE "imageVector" IS NOT NULL GROUP BY "productId" ORDER BY similarity DESC LIMIT 3;
            `, vectorString);
          }

          if (matchingRecords.length > 0) {
            const productIds = matchingRecords.map(r => r.productId);
            const products = await this.prisma.comProduct.findMany({
              where: { id: { in: productIds }, status: 'PUBLISHED' },
              include: { tierPrices: { include: { tiers: { orderBy: { minQty: 'asc' } } } } }
            });

            if (products.length > 0) {
              contextText += `\n[รายการสินค้าที่ร้านเรามีขาย (ดึงจากฐานข้อมูลตรงกับรูปภาพ)]: \n`;
              products.forEach(p => {
                contextText += `- รหัส: ${p.sku}, ชื่อ: ${p.name}, ราคาปลีก: ${p.price} บาท\n`;
                if (p.tierPrices.length > 0 && p.tierPrices[0].tiers.length > 0) {
                  contextText += `  > ราคาส่ง:\n`;
                  p.tierPrices[0].tiers.forEach(t => {
                    contextText += `    * ซื้อ ${t.minQty} ชิ้นขึ้นไป ราคา ${t.unitPrice} บาท\n`;
                  });
                }
                contextText += `  > 🔗 ลิงก์สั่งซื้อ: https://kkvservice.com/marketplace/product/${p.id}\n\n`;
              });
            }
          }
        } catch (imgSearchErr : any) {
          this.logger.error(`❌ Image Search in Chat Error: ${imgSearchErr.message}`);
        }
      }

      // =======================================================
      // 🧠 ค้นหาข้อมูลจาก Knowledge Base (ตรวจสอบสิทธิ์การเข้าถึง - Access Control)
      // =======================================================
      if (message) {
        
        // 🌟 1. ดึงข้อมูล KB ทั่วไป (เช่น ข้อมูลที่คีย์มือ หรือ Web Scraping ที่ไม่ได้ผูกกับเอกสาร DMS)
        // 💡 หมายเหตุ: หาก Prisma ของคุณแจ้งเตือน Error ตรง docFiles: { none: {} } ให้คอมเมนต์บรรทัด docFiles ทิ้ง
        // แล้วใช้ลอจิกกรองแบบอื่นแทน แต่โดยปกติโครงสร้าง 1-to-many จะใช้แบบนี้ได้ครับ
       let publicKbs: any[] = [];
        try {
          publicKbs = await this.prisma.intKnowledgeBase.findMany({
            where: { 
              companyId, 
              isActive: true,
              docFile: null // ค้นหาเฉพาะ KB ที่ไม่มีไฟล์ DMS มาผูก
            },
            select: { id: true }
          });
       } catch (e) {
           // Fallback กรณี Prisma Schema รันด้วย docFile: null ไม่ผ่าน (เช่นเป็น Array)
           publicKbs = await this.prisma.$queryRawUnsafe<any[]>(`
             SELECT id FROM int_knowledge_bases 
             WHERE "companyId" = $1 AND "isActive" = true 
             AND id NOT IN (SELECT "knowledgeBaseId" FROM doc_files WHERE "knowledgeBaseId" IS NOT NULL)
           `, companyId);
        }

        // 🌟 2. ดึงข้อมูล KB ที่เป็นเอกสาร DMS "เฉพาะ" ที่ผู้ใช้คนนี้มีสิทธิ์อ่าน
        let accessibleDocKbs: any[] = [];
        
        if (userId !== undefined && roleId !== undefined) {
           accessibleDocKbs = await this.prisma.docFile.findMany({
             where: {
               companyId,
               knowledgeBaseId: { not: null }, // ต้องเป็นไฟล์ที่ซิงค์เข้า AI แล้ว
               OR: [
                 { uploadedById: userId }, // 1) เป็นคนอัปโหลดเอง
                 { accessRoles: { some: { roleId: roleId, canView: true } } }, // 2) หรือมีสิทธิ์ระดับไฟล์
               ]
             },
             select: { knowledgeBaseId: true }
           });
        }

        // 🌟 3. รวม ID ของ Knowledge Base ทั้งหมดที่อนุญาตให้ค้นหาได้
        const allowedKbIds = [
          ...publicKbs.map(kb => kb.id),
          ...accessibleDocKbs.map(doc => doc.knowledgeBaseId)
        ].filter(id => id !== null && id !== undefined); // กรองค่าว่างออก

        // ถ้ามีฐานข้อมูลที่ค้นได้ ค่อยไปทำ Vector Search
        if (allowedKbIds.length > 0) {
          try {
            const modelName = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
            const embeddingModel = genAI.getGenerativeModel({ model: modelName });
            const queryEmbed = await embeddingModel.embedContent(message);
            let userVector = queryEmbed.embedding.values;

            if (userVector.length > 768) {
              userVector = userVector.slice(0, 768);
              const magnitude = Math.sqrt(userVector.reduce((sum, val) => sum + val * val, 0));
              userVector = userVector.map(val => val / magnitude);
            }

            // 🌟 4. ยิง Query ไปหาเฉพาะใน allowedKbIds ที่คัดมาแล้วเท่านั้น
            const searchResults = await this.prisma.$queryRawUnsafe<Array<{ content: string }>>(`
              SELECT content FROM int_knowledge_base_chunks 
              WHERE "knowledgeBaseId" IN (${allowedKbIds.join(',')})
              ORDER BY embedding <=> $1::vector LIMIT 5;
            `, `[${userVector.join(',')}]`);

            if (searchResults.length > 0) {
              contextText += `\n[ข้อมูลความรู้เพิ่มเติมของบริษัท (ดึงเฉพาะข้อมูลที่คุณมีสิทธิ์อ่าน)]:\n` + searchResults.map(r => r.content).join('\n\n---\n\n');
            }
          } catch (error: any) {
             this.logger.error(`❌ Vector Search Error: ${error.message}`);
          }
        }
      }

      // =======================================================
      // 💬 สร้าง System Instruction & ส่งคุยกับ Gemini
      // =======================================================
      const systemInstructionText = `
        คำแนะนำสำหรับบอท:
        - บุคลิกของคุณคือ: ${bot.systemPrompt || 'พนักงานที่สุภาพและเป็นมิตร'}
        - หากลูกค้าถามหาสินค้า และในข้อมูล [รายการสินค้าที่ร้านเรามีขาย] มีข้อมูลอยู่ ให้คุณแนะนำสินค้าเหล่านั้น พร้อมแจ้งราคาและส่ง [🔗 ลิงก์สั่งซื้อ] ให้ลูกค้าคลิกเสมอ
        - พยายามเชียร์ให้ลูกค้าซื้อราคาส่งถ้ามีเรทราคาบอกไว้
        - ตอบกลับด้วยข้อความที่อ่านง่าย (ใช้ Emoji ได้แต่อย่าเยอะเกินไป)
        
        ข้อมูลอ้างอิงสำหรับตอบคำถาม:
        ${contextText || 'ยังไม่มีข้อมูลอ้างอิงเพิ่มเติม'}
      `;

      const model = genAI.getGenerativeModel({ 
        model: bot.modelName || "models/gemini-2.0-flash",
        systemInstruction: systemInstructionText
      });

      const chatSession = model.startChat({
        history: [], 
        generationConfig: { temperature: bot.temperature || 0.7 }
      });

      // 🌟 ประกอบร่าง: ส่งทั้ง "ข้อความ" และ "รูปภาพ" ไปให้ AI ทีเดียว
      const parts: any[] = [];
      if (message) parts.push({ text: message });
      if (imageBase64) {
        parts.push({
          inlineData: {
            data: imageBase64,
            mimeType: 'image/jpeg'
          }
        });
      }

      const result = await chatSession.sendMessage(parts);
      const response = await result.response;
      const responseText = response.text();

      await this.recordUsage(
        companyId, 
        bot.id, 
        bot.modelName, 
        response.usageMetadata?.promptTokenCount || 0, 
        response.usageMetadata?.candidatesTokenCount || 0, 
        'CHAT_LINE'
      );

      return responseText;

    } catch (error: any) {
      this.logger.error(`AI Engine Error: ${error.message}`);
      throw new ForbiddenException(`AI Error: ${error.message}`);
    }
  }

  // =======================================================
  // 🤖 5. Get Bot Config By Code
  // =======================================================
  async getBotByCode(botCode: string) {
    const bot = await this.prisma.intAiBot.findFirst({
      where: { code: botCode }
    });
    
    // We don't throw an error here, but return null so the caller can handle it gracefully.
    return bot; 
  }

  // =======================================================
  // 🪙 6. Manually Deduct Tokens & Record Usage
  // =======================================================
  async deductTokens(companyId: number, totalTokens: number, botCode: string, source: string = 'PRODUCT_DESC_GEN') {
    // 1. Fetch the bot to get its ID and Model Name for logging purposes
    const bot = await this.getBotByCode(botCode);
    
    await this.recordUsage(
        companyId,
        bot ? bot.id : undefined,
        bot ? bot.modelName : 'unknown-model',
        0, // Prompt tokens (setting to 0 as we only have totalTokens)
        totalTokens, // Completion tokens
        source // E.g., 'PRODUCT_DESC_GEN'
    );
  }

  // =======================================================
  // 🖼️ 1. แปลงรูปภาพเป็น Vector (Image Embedding)
  // =======================================================
  async generateImageEmbedding(imageBuffer: Buffer): Promise<number[]> {
    try {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
      const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
      
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/multimodalembedding@001:predict`;
      const base64Image = imageBuffer.toString('base64');

      const response = await this.googleAuth.request<any>({
        url: url,
        method: 'POST',
        data: {
          instances: [{ image: { bytesBase64Encoded: base64Image } }]
        }
      });

      const embeddings = response.data.predictions[0].imageEmbedding; 

      if (embeddings.length === 1408) {
        return [...embeddings, ...new Array(128).fill(0)];
      }

      return embeddings;

    } catch (error) {
      this.logger.error('Failed to generate image embedding', error);
      throw new Error('ไม่สามารถแปลงรูปภาพเป็น Vector ได้');
    }
  }

  // =======================================================
  // 📝 2. แปลงข้อความเป็น Vector (Text Embedding)
  // =======================================================
 async generateTextEmbedding(text: string): Promise<number[]> {
    try {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
      const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
      
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/multimodalembedding@001:predict`;

      const response = await this.googleAuth.request<any>({
        url: url,
        method: 'POST',
        data: {
          instances: [{ text: text }]
        }
      });

      const embeddings = response.data.predictions[0].textEmbedding; 

      if (embeddings.length === 1408) {
        return [...embeddings, ...new Array(128).fill(0)];
      }

      return embeddings;

    } catch (error) {
      this.logger.error('Failed to generate text embedding', error);
      throw new Error('ไม่สามารถแปลงข้อความเป็น Vector ได้');
    }
  }

 private async recordUsage(companyId: number, botId: number | undefined, modelName: string, promptTokens: number, completionTokens: number, source: string) {
    const totalTokens = promptTokens + completionTokens;
    const baseCost = totalTokens > 0 ? totalTokens : 1;
    
    // 🌟 1. ดึงเรทราคาจากตาราง SysAiModelConfig แบบเดียวกับที่ทำในระบบอื่น
    const modelConfig = await this.prisma.sysAiModelConfig.findFirst({
      where: {
        modelCode: modelName,
        OR: [{ companyId: companyId }, { companyId: null }]
      },
      orderBy: { companyId: 'desc' }
    });

    // 🌟 2. คำนวณยอด Token ที่ต้องหักจริง (บวกกำไรแล้ว)
    const multiplier = modelConfig ? Number(modelConfig.markupMultiplier) : 1.0;
    const finalCost = Math.ceil(baseCost * multiplier);
    
    await this.prisma.$transaction([
      this.prisma.intAiUsageLog.create({
        data: {
          companyId,
          aiBotId: botId, 
          modelName,
          promptTokens: promptTokens,
          completionTokens: completionTokens,
          totalTokens: finalCost, // ✅ เก็บยอดที่คูณกำไรแล้วลง Log
          source
        }
      }),
      this.prisma.intAiQuota.update({
        where: { companyId },
        data: { usedThisMonth: { increment: BigInt(finalCost) } } // ✅ หักโควตาด้วยยอดที่คูณกำไรแล้ว
      })
    ]);
  }
}