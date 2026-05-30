import { Module, forwardRef } from '@nestjs/common'; 
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PrismaModule } from '../../../prisma/prisma.module'; 

import { StorageModule } from '../../sys/storage/storage.module'; 

// 🌟 1. Import MasterModule เพื่อเอามาใช้เช็กข้อมูล Database ใน Controller
import { MasterModule } from '../../cfg/master/master.module'; // 👈 เช็ก Path ตรงนี้ให้ตรงกับของคุณนะครับ

@Module({
  imports: [
    PrismaModule, 
    forwardRef(() => StorageModule), 
    
    // 🌟 2. นำ MasterModule มาใส่ใน imports
    MasterModule,
    
    MulterModule.register({
      // 🌟 3. เหลือแค่จำกัดขนาดไฟล์ ไม่ต้องมี fileFilter แล้ว (หนีปัญหางูกินหาง)
      limits: { fileSize: 50 * 1024 * 1024 }, 
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService], 
  exports: [UploadService],
})
export class UploadModule {}