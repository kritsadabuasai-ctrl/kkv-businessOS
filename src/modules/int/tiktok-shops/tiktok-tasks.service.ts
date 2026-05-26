import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service'; // ตรวจสอบ Path ให้ตรงกับโปรเจกต์ [cite: 154]
import { TiktokShopsService } from './tiktok-shops.service';

@Injectable()
export class TiktokTasksService {
  private readonly logger = new Logger(TiktokTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tiktokService: TiktokShopsService,
  ) {}

  /**
   * 🕒 ระบบตรวจสอบและต่ออายุ Token อัตโนมัติ
   * รันทุกเที่ยงคืน (หรือปรับเป็น EVERY_HOUR ถ้าต้องการความถี่สูงขึ้น)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTiktokTokenRefresh() {
    this.logger.log('⏳ เริ่มตรวจสอบการต่ออายุ TikTok Shop Access Token...');

    try {
      // 1. ค้นหาร้านค้าที่ Access Token จะหมดอายุในอีก 24 ชั่วโมงข้างหน้า
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const expiringShops = await this.prisma.intTiktokShop.findMany({
        where: {
          accessTokenExpiresAt: {
            lte: tomorrow, // น้อยกว่าหรือเท่ากับพรุ่งนี้
          },
          refreshTokenExpiresAt: {
            gt: new Date(), // Refresh Token ต้องยังไม่หมดอายุ (ถ้าหมดต้อง Connect ใหม่เท่านั้น)
          },
        },
      });

      if (expiringShops.length === 0) {
        this.logger.log('✅ ไม่พบร้านค้าที่ต้องต่ออายุ Token ในขณะนี้');
        return;
      }

      this.logger.log(`พบ ${expiringShops.length} ร้านค้าที่กำลังจะหมดอายุ กำลังเริ่มดำเนินการ...`);

      // 2. วนลูปเพื่อสั่ง Refresh ทีละร้าน
      for (const shop of expiringShops) {
        try {
          // เรียกใช้ฟังก์ชัน refreshTiktokToken (ที่คุณต้องเพิ่มใน tiktok-shops.service.ts)
          // ในกรณีที่คุณยังใช้ชื่อฟังก์ชันอื่น ให้เปลี่ยนชื่อเรียกให้ตรงกันครับ
          await this.tiktokService.update(shop.id, shop.companyId, {
            // โลจิกภายในจะถูกจัดการโดย Service ของคุณ
          });
          
          this.logger.log(`Successfully refreshed token for shop: ${shop.shopName} (ID: ${shop.shopId})`);
        } catch (error) {
          this.logger.error(`❌ ไม่สามารถต่ออายุให้ร้าน ${shop.shopName} ได้: ${error.message}`);
        }
      }

      this.logger.log('✨ เสร็จสิ้นกระบวนการตรวจสอบ TikTok Token');
    } catch (error) {
      this.logger.error('💥 เกิดข้อผิดพลาดร้ายแรงในระบบ TikTok Cron Job:', error.message);
    }
  }
}