import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpsertSmtpConfigDto } from './smtp-config.dto';
// ⚠️ อย่าลืมสร้างไฟล์นี้และปรับ Path ให้ตรงกับโปรเจกต์ของคุณกฤษฎานะครับ
import { encryptData } from '../../../utils/encryption.util'; 

@Injectable()
export class SmtpConfigService {
  constructor(private prisma: PrismaService) {}

  // ============================================================================
  // 1. ดึงข้อมูลการตั้งค่า SMTP (รองรับทั้งระดับ Shop และ Company)
  // ============================================================================
  async getConfig(companyId: number | null, shopId: number | null = null) {
    const config = await this.prisma.intSmtpConfig.findFirst({
      where: { companyId, shopId }
    });
    
    // 🛡️ Security: ป้องกันไม่ให้ส่งรหัสผ่านที่เข้ารหัสแล้ว (หรือรหัสจริง) กลับไปที่หน้าบ้าน
    // ให้แสดงเป็นดอกจันแทน เพื่อให้หน้าบ้านรู้ว่า "มีรหัสผ่านตั้งไว้แล้วนะ"
    if (config) {
      config.password = '********'; 
    }
    
    return config;
  }

  // ============================================================================
  // 2. สร้างหรืออัปเดตการตั้งค่า (Upsert)
  // ============================================================================
  async upsertConfig(companyId: number | null, dto: UpsertSmtpConfigDto) {
    // 🔍 ค้นหาว่ามีการตั้งค่าของระดับนี้ (Company + Shop) อยู่แล้วหรือไม่
    const existing = await this.prisma.intSmtpConfig.findFirst({
      where: { companyId, shopId: dto.shopId || null }
    });

    if (existing) {
      // 📝 กรณีที่มีข้อมูลอยู่แล้ว (อัปเดต)
      // เช็คว่าหน้าบ้านส่งรหัสผ่านใหม่มาไหม? ถ้าส่งค่าว่าง หรือส่ง '********' มา แปลว่าลูกค้าไม่อยากเปลี่ยนรหัสผ่าน
      const finalPassword = (!dto.password || dto.password === '********') 
        ? existing.password 
        : encryptData(dto.password);

      return this.prisma.intSmtpConfig.update({
        where: { id: existing.id },
        data: {
          ...dto,
          password: finalPassword // ใช้รหัสผ่านที่ตัดสินใจแล้ว (รหัสเดิม หรือ รหัสใหม่ที่เข้ารหัสแล้ว)
        }
      });
      
    } else {
      // ✨ กรณีที่ยังไม่มีข้อมูล (สร้างใหม่ครั้งแรก)
      
      // 🛡️ ดักจับ Error: ถ้าเป็นการสร้างใหม่ ต้องบังคับให้ระบุรหัสผ่านเสมอ
      if (!dto.password || dto.password === '********') {
        throw new BadRequestException('กรุณาระบุรหัสผ่าน (Password) สำหรับการตั้งค่า SMTP ใหม่');
      }

      // 💡 แยกตัวแปร password ออกมาจาก dto เพื่อแก้ปัญหา TypeScript Error 
      // และเพื่อให้มั่นใจว่า password ไม่ใช่ undefined แน่นอน
      const { password, ...restDto } = dto;

      return this.prisma.intSmtpConfig.create({
        data: {
          companyId,
          ...restDto,
          password: encryptData(password), // 🔒 เข้ารหัส 2 ทางก่อนบันทึกลง Database
        }
      });
    }
  }
}