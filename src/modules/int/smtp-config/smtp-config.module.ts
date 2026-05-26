import { Module } from '@nestjs/common';
import { SmtpConfigController } from './smtp-config.controller';
import { SmtpConfigService } from './smtp-config.service';
// ⚠️ สมมติว่าคุณกฤษฎามี PrismaModule อยู่ที่ path นี้นะครับ (ปรับให้ตรงกับโปรเจกต์ได้เลย)
import { PrismaModule } from '../../../prisma/prisma.module'; 

@Module({
  imports: [PrismaModule], // นำเข้า PrismaModule เพื่อให้ Service เรียกใช้ฐานข้อมูลได้
  controllers: [SmtpConfigController],
  providers: [SmtpConfigService],
  exports: [SmtpConfigService], // เปิด Export ไว้ เผื่อ Module อื่น (เช่น MailModule) ต้องการเรียกใช้
})
export class SmtpConfigModule {}