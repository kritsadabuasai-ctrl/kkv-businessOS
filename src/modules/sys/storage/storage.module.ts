import { Module, forwardRef } from '@nestjs/common';
import { StorageService } from './storage.service';
import { PrismaModule } from '../../../prisma/prisma.module';
// 🌟 Import UploadModule เข้ามา
import { UploadModule } from '../../int/upload/upload.module'; 

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UploadModule) // 🌟 ใช้ forwardRef คู่กันเพื่อป้องกัน Circular Dependency
  ], 
  providers: [StorageService],
  exports: [StorageService], 
})
export class StorageModule {}