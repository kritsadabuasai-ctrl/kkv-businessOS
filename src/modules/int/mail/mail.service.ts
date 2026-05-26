import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../../prisma/prisma.service';
import { decryptData } from '../../../utils/encryption.util';

interface SendMailParams {
  to: string;
  companyId?: number;             
  shopId?: number | null;         
  templateCode?: string;          
  variables?: Record<string, any>; 
  subject?: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private prisma: PrismaService) {}

  async sendEmail(params: SendMailParams): Promise<boolean> {
    try {
      // 1. หาการตั้งค่า SMTP (หาจาก DB ก่อน)
      const dbConfig = await this.resolveSmtpConfig(params.companyId, params.shopId);
      
      // 🌟 สร้างตัวแปรมารับค่าที่การันตี Type ว่าไม่เป็น null แน่นอน (แก้ TS Error)
      let finalHost = '';
      let finalPort = 587;
      let finalIsSecure = false;
      let finalUsername = '';
      let finalPassword = '';
      let finalSenderName = '';
      let finalSenderEmail = '';

      if (dbConfig) {
        // ✅ กรณีเจอใน Database
        finalHost = dbConfig.host;
        finalPort = dbConfig.port;
        finalIsSecure = dbConfig.isSecure || false;
        finalUsername = dbConfig.username;
        // ดัก Error กรณี password เป็น null หรือ undefined
        finalPassword = dbConfig.password ? (decryptData(dbConfig.password) || '') : '';
        finalSenderName = dbConfig.senderName;
        finalSenderEmail = dbConfig.senderEmail;
      } else {
        // 🌟 FALLBACK: กรณีไม่เจอใน DB ให้ใช้ Cloud Run (Environment Variables)
        if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
          throw new Error('ไม่พบการตั้งค่า SMTP ใน Database และไม่มีใน Cloud Run');
        }
        
        // ใส่ || '' เพื่อยืนยันกับ TypeScript ว่าจะเป็น string แน่นอน
        finalHost = process.env.MAIL_HOST || 'smtp.gmail.com';
        finalPort = Number(process.env.MAIL_PORT) || 587;
        finalIsSecure = process.env.MAIL_SECURE === 'true';
        finalUsername = process.env.MAIL_USER || '';
        finalPassword = process.env.MAIL_PASS || ''; 
        finalSenderName = process.env.MAIL_FROM_NAME || 'KKV System';
        finalSenderEmail = process.env.MAIL_USER || '';
        
        this.logger.log(`⚠️ ไม่พบ SMTP ใน DB กำลังสลับไปใช้อีเมลส่วนกลาง: ${finalUsername}`);
      }

      if (!finalPassword) {
        throw new Error('รหัสผ่าน SMTP ไม่ถูกต้องหรือถอดรหัสไม่ได้');
      }

      // 3. เตรียมเนื้อหาอีเมล (รองรับทั้งแบบ Template และแบบ HTML สด)
      let finalHtml = params.html || '';
      let finalSubject = params.subject || 'ไม่มีหัวข้อ';

      if (params.templateCode) {
        const template = await this.resolveTemplate(params.companyId, params.shopId || null, params.templateCode);
        if (!template) throw new Error(`ไม่พบ Template รหัส: ${params.templateCode}`);
        
        finalHtml = template.content;
        finalSubject = template.subject || 'ไม่มีหัวข้อ';
        
        if (params.variables) {
          for (const [key, value] of Object.entries(params.variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            finalHtml = finalHtml.replace(regex, String(value));
            finalSubject = finalSubject.replace(regex, String(value));
          }
        }
      }

      // 4. สร้างตัวส่งอีเมล (Transporter)
      const transporter = nodemailer.createTransport({
        host: finalHost,
        port: finalPort,
        secure: finalIsSecure,
        auth: {
          user: finalUsername,
          pass: finalPassword,
        },
      });

      // 5. ส่งอีเมล!
      const info = await transporter.sendMail({
        from: `"${finalSenderName}" <${finalSenderEmail}>`,
        to: params.to,
        subject: finalSubject,
        html: finalHtml,
      });

      this.logger.log(`✅ ส่งอีเมลสำเร็จถึง ${params.to} (Message ID: ${info.messageId})`);
      return true;

    } catch (error) {
      this.logger.error(`❌ ส่งอีเมลล้มเหลว: ${error.message}`);
      throw new InternalServerErrorException('ไม่สามารถส่งอีเมลได้ในขณะนี้');
    }
  }

  private async resolveSmtpConfig(companyId?: number, shopId?: number | null) {
    if (shopId) {
      const shopConfig = await this.prisma.intSmtpConfig.findFirst({ where: { shopId, isActive: true } });
      if (shopConfig) return shopConfig;
    }
    if (companyId) {
      const companyConfig = await this.prisma.intSmtpConfig.findFirst({ where: { companyId, shopId: null, isActive: true } });
      if (companyConfig) return companyConfig;
    }
    // ระดับ HQ
    return await this.prisma.intSmtpConfig.findFirst({ where: { companyId: null, shopId: null, isActive: true } });
  }

  private async resolveTemplate(companyId?: number, shopId?: number | null, code?: string) {
    if (!code) return null;
    if (shopId) {
      const shopTpl = await this.prisma.comTemplate.findFirst({ where: { shopId, code, channel: 'EMAIL' } });
      if (shopTpl) return shopTpl;
    }
    if (companyId) {
      const companyTpl = await this.prisma.comTemplate.findFirst({ where: { companyId, shopId: null, code, channel: 'EMAIL' } });
      if (companyTpl) return companyTpl;
    }
    return await this.prisma.comTemplate.findFirst({ 
        where: { code, channel: 'EMAIL' },
        orderBy: { id: 'asc' } 
    });
  }
}