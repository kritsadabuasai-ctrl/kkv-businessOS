// src/modules/int/social/social.module.ts
import { Module } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { StorageService } from '../../sys/storage/storage.service'; // 🌟 1. นำเข้า StorageService

import { LineModule } from '../line/line.module'; 
import { LineConfigsModule } from '../line-configs/line-configs.module';
import { FacebookPagesModule } from '../facebook-pages/facebook-pages.module';
import { FacebookModule } from '../facebook/facebook.module';
import { InstagramConfigsModule } from '../instagram-configs/instagram-configs.module';
import { TiktokModule } from '../tiktok/tiktok.module'
import { InstagramModule } from '../instagram/instagram.module';
import { TiktokShopsModule } from '../tiktok-shops/tiktok-shops.module';
import { NotificationsModule } from '../../sys/notifications/notifications.module'; 

@Module({
  imports: [
    PrismaModule, 
    LineModule,
    LineConfigsModule,
    FacebookPagesModule,
    FacebookModule,
    InstagramConfigsModule,
    TiktokModule,
    TiktokShopsModule,
    InstagramModule,
    NotificationsModule, 
  ],
  controllers: [SocialController],
  providers: [SocialService, StorageService], // 🌟 2. เพิ่ม StorageService เข้ามาให้บริการ
  exports: [
    SocialService,
    LineModule,
    LineConfigsModule,
    FacebookPagesModule,
    FacebookModule,
    InstagramConfigsModule,
    InstagramModule,
    TiktokModule,
    TiktokShopsModule
  ],
})
export class SocialModule {}