import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(private prisma: PrismaService) {}

  async askAiWithRbac(companyId: number, userRoleIds: number[], question: string) {
    // 1. 🤖 แปลงคำถาม (question) เป็น Vector (Embedding)
    const apiKey = process.env.GEMINI_API_KEY || '';
    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const questionEmbedding = await embeddingModel.embedContent(question);
    const vector = questionEmbedding.embedding.values;
    
    // (จำลอง) ตัดให้เหลือ 768 มิติตามที่คุณเขียนไว้ใน Knowledge Base
    const shortVector = vector.slice(0, 768); 

    // 2. 🔍 ค้นหา Chunk ที่ใกล้เคียงจากฐานข้อมูล (สมมติว่าใช้ pgvector)
    // ตรงนี้เราดึงมาเผื่อไว้ก่อนสัก 10 ก้อน
    /*
    const searchResults = await this.prisma.$queryRaw`
      SELECT id, "knowledgeBaseId", content 
      FROM int_knowledge_base_chunks
      ORDER BY embedding <-> ${shortVector}::vector LIMIT 10
    `;
    */
    const searchResults: any[] = []; // (ใส่ผลลัพธ์จาก Vector Search จริง)

    // 3. 🛡️ ตะแกรงร่อนสิทธิ์ (The RBAC Filter)
    const safeChunks: string[] = [];

    for (const chunk of searchResults) {
      // ไปดึงว่า Knowledge นี้ผูกกับไฟล์อะไร และใครมีสิทธิ์ดูบ้าง
      const kbInfo = await this.prisma.intKnowledgeBase.findUnique({
        where: { id: chunk.knowledgeBaseId },
        include: {
          docFile: {
            include: { accessRoles: true }
          }
        }
      });

      // ถ้าเป็นความรู้ทั่วไป (ไม่มีไฟล์ผูก) -> ให้ผ่านได้เลย
      if (!kbInfo?.docFile) {
        safeChunks.push(chunk.content);
        continue;
      }

      // ถ้าเป็นเอกสารความลับ -> เช็คสิทธิ์
      const allowedRoles = kbInfo.docFile.accessRoles.map(ar => ar.roleId);
      const hasPermission = userRoleIds.some(roleId => allowedRoles.includes(roleId));

      if (hasPermission) {
        safeChunks.push(chunk.content); // ✅ สิทธิ์ตรงกัน ให้ AI อ่านได้
      } else {
        this.logger.warn(`🚫 Data Leak Prevented: User tried to access KB #${chunk.knowledgeBaseId}`);
      }
    }

    // 4. 🧠 โยน safeChunks + question ให้ Gemini สรุปคำตอบ
    /*
    const chatModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `ตอบคำถามนี้: ${question} \n\nอ้างอิงจากข้อมูลเหล่านี้เท่านั้น: \n${safeChunks.join('\n')}`;
    const result = await chatModel.generateContent(prompt);
    return { answer: result.response.text() };
    */
    
    return { answer: "นี่คือคำตอบจำลองที่ผ่านการกรองสิทธิ์แล้วครับ" };
  }
}