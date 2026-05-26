import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MailService } from '../../int/mail/mail.service'; // ตรวจสอบ Path ของ MailService
import { PrismaService } from '../../../prisma/prisma.service'; // ต้องใช้ Prisma เพื่อดึงค่า Config
import { LandingRegistrationDto } from './landing-registration.dto';

@Injectable()
export class LandingRegistrationService {
  private readonly logger = new Logger(LandingRegistrationService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly prisma: PrismaService, // Inject PrismaService เข้ามาใช้งาน
  ) {}

  async registerInterest(dto: LandingRegistrationDto) {
    try {
      // =========================================================
      // 🛡️ ระบบดึงอีเมลผู้รับ (SysConfig -> Hardcode)
      // =========================================================
      let adminEmail = 'kritsada.b@kkvservice.com'; // ค่า Hardcode กรณีฉุกเฉิน

      try {
        // ดึงค่าจากตาราง cfgSystem โดยใช้ key 'CONTACT_EMAIL'
        const config = await this.prisma.cfgSystem.findUnique({
          where: { key: 'CONTACT_EMAIL' },
        });

        if (config && config.value) {
          adminEmail = config.value;
        }
      } catch (configError) {
        this.logger.warn(`[Landing] ไม่สามารถดึง CONTACT_EMAIL ได้ จะใช้ค่า Hardcode แทน`);
      }
      // =========================================================

      const emailHtml = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #4f46e5;">🚀 มีผู้สนใจลงทะเบียนใหม่ (Phase 1.5)</h2>
          <p>ระบบตรวจพบการลงทะเบียนความสนใจจากหน้า Landing Page โดยมีรายละเอียดดังนี้:</p>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <p><b>👤 ชื่อ-นามสกุล:</b> ${dto.firstName} ${dto.lastName}</p>
          <p><b>🏢 บริษัท:</b> ${dto.companyName} ${dto.jobTitle ? `(${dto.jobTitle})` : ''}</p>
          <p><b>📧 อีเมล:</b> <a href="mailto:${dto.email}">${dto.email}</a></p>
          <p><b>📞 เบอร์โทรศัพท์:</b> ${dto.phone}</p>
          <p><b>🏭 อุตสาหกรรม:</b> ${dto.industry || '-'}</p>
          <p><b>🔍 รู้จักเราผ่าน:</b> ${dto.knownFrom || '-'}</p>
          <p><b>📝 ปัญหาหรือความต้องการเพิ่มเติม:</b></p>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
            ${dto.message || 'ไม่ได้ระบุข้อมูลเพิ่มเติม'}
          </div>
          <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
            * อีเมลฉบับนี้ส่งโดยระบบอัตโนมัติไปยังผู้รับที่ตั้งค่าไว้ใน CONTACT_EMAIL (${adminEmail})
          </p>
        </div>
      `;

      await this.mailService.sendEmail({
        to: adminEmail,
        subject: `[Lead New] คุณ ${dto.firstName} สนใจระบบ Enterprise SaaS`,
        html: emailHtml,
      } as any);

      return { 
        success: true, 
        message: 'ส่งข้อมูลลงทะเบียนเรียบร้อยแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด' 
      };
    } catch (error : any) {
      this.logger.error(`[Landing] Error sending registration email: ${error.message}`);
      throw new BadRequestException('ระบบไม่สามารถส่งข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
    }
  }
}