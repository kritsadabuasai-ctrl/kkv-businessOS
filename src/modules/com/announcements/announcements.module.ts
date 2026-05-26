// src/modules/com/announcements/announcements.module.ts

import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { StorageService } from '../../sys/storage/storage.service'; // ✅ เพิ่ม
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, StorageService], // ✅ เพิ่ม StorageService
})
export class AnnouncementsModule {}