import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookPagesService } from './facebook-pages.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FacebookTasksService {
  constructor(private readonly fbService: FacebookPagesService, private readonly prisma: PrismaService) {}

  // รันทุกเที่ยงคืน เพื่อเช็คว่ามีเพจไหนใกล้หมดอายุบ้าง
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTokenRefresh() {
    console.log('⏳ เริ่มตรวจสอบการต่ออายุ Facebook Token...');
    
    // ค้นหาเพจที่ Token จะหมดอายุในอีก 7 วันข้างหน้า
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringPages = await this.prisma.intFacebookPage.findMany({
      where: {
        expiresAt: {
          lte: sevenDaysFromNow, // น้อยกว่าหรือเท่ากับอีก 7 วันข้างหน้า
        },
      },
    });

    for (const page of expiringPages) {
      await this.fbService.refreshPageToken(page.pageId);
    }
  }
}