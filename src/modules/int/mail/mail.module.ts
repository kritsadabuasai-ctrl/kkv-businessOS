import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
// ⚠️ ปรับ Path ของ PrismaModule ให้ตรงกับโครงสร้างโปรเจกต์ของคุณกฤษฎานะครับ
import { PrismaModule } from '../../../prisma/prisma.module'; 

@Module({
  imports: [PrismaModule], // นำเข้า PrismaModule เพื่อให้ MailService ค้นหา Config และ Template จาก DB ได้
  providers: [MailService],
  exports: [MailService],  // 🌟 สำคัญมาก: ต้อง Export ไว้เพื่อให้ Module อื่นๆ เรียกใช้ MailService ได้
})
export class MailModule {}