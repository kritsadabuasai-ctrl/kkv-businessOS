import { Module } from '@nestjs/common';
import { CloudConfigsService } from './cloud-configs.service';
import { CloudConfigsController } from './cloud-configs.controller';
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ นำเข้า PrismaModule เพื่อใช้งานฐานข้อมูล

@Module({
  imports: [PrismaModule], // ✅
  controllers: [CloudConfigsController],
  providers: [CloudConfigsService],
  exports: [CloudConfigsService], // ✅ Export เพื่อให้ Module อื่นๆ เช่น AI Bot สามารถดึงค่า Config ไปใช้ได้
})
export class CloudConfigsModule {}