import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  // ==========================================
  // 💬 ฟังก์ชันยิงข้อความตอบกลับไปยัง Instagram DM
  // ==========================================
  async replyMessage(pageAccessToken: string, recipientId: string, messageText: string, companyId: number) {
    try {
      // 💡 ข้อสังเกต: IG ใช้ Endpoint เดียวกับ Facebook Messenger เลยครับ
      await axios.post(
        `https://graph.facebook.com/v19.0/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text: messageText },
          messaging_type: 'RESPONSE'
        },
        {
          params: { access_token: pageAccessToken } 
        }
      );
      this.logger.log(`✅ IG Reply sent to ${recipientId}`);
    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      this.logger.error(`❌ IG Reply Failed: ${errorMsg}`);
    }
  }
}