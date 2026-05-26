import { Module, BadRequestException, forwardRef } from '@nestjs/common'; // 🌟 1. เพิ่ม forwardRef
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PrismaModule } from '../../../prisma/prisma.module'; 

// 🌟 2. Import StorageModule (ไม่ใช่ StorageService)
import { StorageModule } from '../../sys/storage/storage.module'; 

@Module({
  imports: [
    PrismaModule, 
    // 🌟 3. เรียกใช้ StorageModule ด้วย forwardRef ป้องกันการชนกัน
    forwardRef(() => StorageModule), 
    
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|txt)$/)) {
          return cb(new BadRequestException('Only image/doc/text files allowed!'), false);
        }
        cb(null, true);
      },
    }),
  ],
  controllers: [UploadController],
  // 🌟 4. ลบ StorageService ออกจาก providers ปล่อยให้มันดึงมาจาก StorageModule แทน
  providers: [UploadService], 
  exports: [UploadService],
})
export class UploadModule {}