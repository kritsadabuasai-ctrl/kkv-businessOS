import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class TiktokService {
  private readonly logger = new Logger(TiktokService.name);

  constructor(private prisma: PrismaService) {}

  // ==========================================
  // 💬 ฟังก์ชันยิงข้อความตอบกลับไปยัง TikTok Shop
  // ==========================================
  async replyMessage(appKey: string, accessToken: string, conversationId: string, messageText: string, shopId: string, companyId: number) {
    try {
      // ⚠️ หมายเหตุ: URL และ Payload อ้างอิงตามมาตรฐาน TikTok Shop Open API
      await axios.post(
        `https://open-api.tiktokglobalshop.com/api/customer_service/conversations/${conversationId}/messages`,
        {
          message_type: 'TEXT',
          content: messageText
        },
        {
          headers: { 
            'x-tts-access-token': accessToken,
            'Content-Type': 'application/json'
          },
          params: { app_key: appKey, shop_cipher: shopId } // ต้องแนบ app_key และรหัสร้านค้า
        }
      );
      this.logger.log(`✅ TikTok Reply sent to conversation: ${conversationId}`);
    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      this.logger.error(`❌ TikTok Reply Failed: ${errorMsg}`);
    }
  }
}