import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // 🟢 1. Import ตัวนี้เข้ามา
import { FacebookPagesService } from './facebook-pages.service';
import { FacebookPagesController } from './facebook-pages.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { FacebookTasksService } from './facebook-tasks.service';
// ลบ CloudConfigsModule ออกได้เลยเพราะใน Service เราไม่ได้ใช้แล้ว

@Module({
  imports: [
    PrismaModule,
    HttpModule // 🟢 2. ต้องใส่ HttpModule ไว้ใน imports เสมอ
  ],
  controllers: [FacebookPagesController],
  providers: [FacebookPagesService, FacebookTasksService],
  exports: [FacebookPagesService],
})
export class FacebookPagesModule {}