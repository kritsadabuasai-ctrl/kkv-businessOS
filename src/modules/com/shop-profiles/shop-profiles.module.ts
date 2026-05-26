// src/modules/com/shop-profiles/shop-profiles.module.ts
import { Module } from '@nestjs/common';
import { ShopProfilesService } from './shop-profiles.service';
import { ShopProfilesController } from './shop-profiles.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { StorageService } from '../../sys/storage/storage.service'; // 🌟 1. Import StorageService

@Module({
  imports: [PrismaModule], // 🌟 2. เอา UploadModule ออกได้เลยครับ (ไม่จำเป็นต้องใช้แล้ว)
  controllers: [ShopProfilesController],
  providers: [ShopProfilesService, StorageService], // 🌟 3. เพิ่ม StorageService
  exports: [ShopProfilesService], 
})
export class ShopProfilesModule {}