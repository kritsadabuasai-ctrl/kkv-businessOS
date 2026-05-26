import { Module } from '@nestjs/common';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';
// 🚩 อย่าลืม import PrismaModule (ปรับ Path ให้ตรงกับโครงสร้างโปรเจกต์ของคุณกฤษฎานะครับ)
import { PrismaModule } from '../../../prisma/prisma.module'; 

@Module({
  imports: [PrismaModule], // จำต้องเอา Prisma ใส่เข้ามาเพื่อให้ Service เรียกใช้ Database ได้
  controllers: [RosterController],
  providers: [RosterService],
  exports: [RosterService], // เปิดไว้เผื่ออนาคต Module อื่นอยากมาดึงข้อมูลตารางกะไปใช้
})
export class RosterModule {}