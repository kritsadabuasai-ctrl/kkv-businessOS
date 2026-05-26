import { Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as crypto from 'crypto'; 
import * as vision from '@google-cloud/vision';
import { PDFDocument } from 'pdf-lib'; 
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CloudConfigsService } from '../cloud-configs/cloud-configs.service';

export interface ParseResult {
  text: string;
  usedAi: boolean;         
  aiProvider?: string;     
  aiModelCode?: string;    
  pagesProcessed: number;  
}

// ✅ ลบ Require ด้านบนสุดทิ้งไปแล้ว เพื่อหนีปัญหา Bundler ของ NestJS

@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);
  private readonly visionClient = new vision.ImageAnnotatorClient();

  generateHash(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  async extractText(fileBuffer: Buffer, mimeType: string, fileName: string): Promise<ParseResult> {
    let text = '';
    let usedAi = false;
    let aiModelCode: string | undefined = undefined; 
    let pagesProcessed = 1;

    try {
      // =========================================================
      // 📄 1. พยายามสกัดข้อความด้วยวิธีปกติ (Standard Parsing)
      // =========================================================
      if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        try {
          // ใช้ eval เพื่อหนีปัญหา Webpack ของ NestJS
          const pdfLib = eval('require')('pdf-parse');
          const parsePdf = typeof pdfLib === 'function' ? pdfLib : (pdfLib.default || pdfLib.pdfParse);
          
          if (parsePdf && typeof parsePdf === 'function') {
            const data = await parsePdf(fileBuffer);
            text = data.text;
            pagesProcessed = data.numpages || 1;
          } else {
            this.logger.warn('⚠️ โหลดฟังก์ชัน pdf-parse ไม่สำเร็จ จะสลับไปใช้ AI อัตโนมัติ');
            text = ''; // ปล่อยว่างไว้เพื่อให้ไหลไปเข้าเงื่อนไข AI ด้านล่าง
          }
        } catch (pdfError: any) {
          const errMsg = (pdfError.message || '').toLowerCase();
          
          // 🚨 ข้อยกเว้น: ถ้าไฟล์ติดรหัสผ่าน (Password) ต้องหยุดเลย เพราะ AI ก็อ่านไฟล์ติดรหัสไม่ได้
          if (errMsg.includes('password') || errMsg.includes('encrypt') || errMsg.includes('protected')) {
            throw pdfError; // โยน Error ออกไปให้ผู้ใช้รู้
          }
          
          // 💡 แต่ถ้าพังด้วยเรื่องอื่น (หาไลบรารีไม่เจอ, ฟอนต์เพี้ยน) ให้แกล้งทำเป็นมองไม่เห็นข้อความ
          this.logger.warn(`⚠️ อ่าน PDF แบบปกติไม่สำเร็จ (${errMsg}) กำลังสลับไปใช้ AI...`);
          text = ''; // กำหนดค่าว่าง เพื่อให้วิ่งไปหา Gemini ด้านล่าง
        }

      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.toLowerCase().endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        text = result.value;
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        fileName.toLowerCase().endsWith('.xlsx') ||
        mimeType === 'text/csv' ||
        fileName.toLowerCase().endsWith('.csv')
      ) {
        console.log('====================================');
        console.log('🟢 กำลังอ่านไฟล์ EXCEL/CSV:', fileName);

        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        let fullText = '';
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          fullText += XLSX.utils.sheet_to_csv(sheet) + '\n\n';
        });
        text = fullText;

        console.log('🟢 อ่านข้อความได้ทั้งหมด:', text.length, 'ตัวอักษร');
        console.log('====================================');

      } else if (mimeType.startsWith('text/')) {
        text = fileBuffer.toString('utf8');
      }

      // =========================================================
      // 🧠 2. ถ้าวิธีปกติไม่ได้ผล (ข้อความน้อยเกินไป) -> ใช้ AI (Gemini)
      // =========================================================
      if (!text || text.trim().length < 50) {
        this.logger.log(`⚠️ เนื้อหาน้อยเกินไปในไฟล์ ${fileName} กำลังสลับไปใช้ AI OCR...`);
        usedAi = true;
        aiModelCode = process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash';
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
           this.logger.warn("GEMINI_API_KEY is not configured for AI OCR");
           return { text: text ? text.trim() : '', usedAi: false, pagesProcessed };
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: aiModelCode });

        const prompt = "ดึงข้อความทั้งหมดจากไฟล์นี้ออกมาให้ถูกต้องและครบถ้วนที่สุด จัดเรียงให้อ่านง่าย ห้ามแต่งเติมข้อความเอง";
        
        const filePart = {
          inlineData: {
            data: fileBuffer.toString("base64"),
            mimeType: mimeType || 'application/octet-stream',
          },
        };

        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        text = response.text();
      }

      return {
        text: text ? text.trim() : '',
        usedAi,
        aiModelCode: aiModelCode,
        pagesProcessed,
      };

    } catch (error: any) {
      this.logger.error(`❌ Error parsing file ${fileName}:`, error.message);
      
      // ✅ 3. [สำคัญมาก] โยน Error ออกไปเพื่อให้ระบบแจ้งเตือนหน้าบ้านได้
      throw error; 
    }
  }

  private cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\r\n/g, '\n').replace(/\n\s*\n/g, '\n').trim();
  }
}