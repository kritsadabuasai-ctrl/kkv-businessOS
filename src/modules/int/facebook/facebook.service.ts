import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);

  constructor(private prisma: PrismaService) {}

  // ==========================================
  // 💬 ฟังก์ชันยิงข้อความตอบกลับไปยัง Facebook Messenger
  // ==========================================
  async replyMessage(pageAccessToken: string, recipientId: string, messageText: string, companyId: number) {
    try {
      await axios.post(
        `https://graph.facebook.com/v19.0/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text: messageText },
          messaging_type: 'RESPONSE' // ระบุว่าเป็นการตอบกลับแชท
        },
        {
          params: { access_token: pageAccessToken } // ส่ง Token ไปใน Query Parameter
        }
      );
      this.logger.log(`✅ FB Reply sent to ${recipientId}`);
    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      this.logger.error(`❌ FB Reply Failed: ${errorMsg}`);
    }
  }
}