import { Module } from '@nestjs/common';
import { GeographyController } from './geography.controller';
import { GeographyService } from './geography.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // ปรับ Path ให้ตรงกับโฟลเดอร์ Prisma ของคุณกฤษฎา

@Module({
  imports: [PrismaModule], // นำเข้า PrismaModule เพื่อให้ Service เรียกใช้ Database ได้
  controllers: [GeographyController],
  providers: [GeographyService],
  exports: [GeographyService], // เผื่อโมดูลอื่น (เช่น CRM หรือ e-Commerce) อยากดึง Service นี้ไปใช้
})
export class GeographyModule {}