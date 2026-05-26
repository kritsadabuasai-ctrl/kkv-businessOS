import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // 🟢 เพิ่ม HttpModule
import { TiktokShopsService } from './tiktok-shops.service';
import { TiktokShopsController } from './tiktok-shops.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { TiktokTasksService } from './tiktok-tasks.service';

@Module({
  imports: [
    PrismaModule, 
    HttpModule // 🟢 ต้องนำเข้าตรงนี้
  ],
  controllers: [TiktokShopsController],
  providers: [TiktokShopsService, TiktokTasksService], // 🟢 เพิ่ม TiktokTasksService เข้าไปใน providers
  exports: [TiktokShopsService], 
})
export class TiktokShopsModule {}