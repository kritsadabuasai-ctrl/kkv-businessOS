import { Module } from '@nestjs/common';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ Import ส่วนกลาง

@Module({
  imports: [PrismaModule], // ✅ ใส่ตรงนี้
  controllers: [PositionController],
  providers: [PositionService],
  exports: [PositionService], // เผื่อ Workflow เรียกใช้เช็คตำแหน่ง
})
export class PositionModule {}