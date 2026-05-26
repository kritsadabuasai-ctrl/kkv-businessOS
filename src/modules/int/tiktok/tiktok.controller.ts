import { Controller, Post, Body, HttpCode, Param, ParseIntPipe, Logger, SetMetadata, Inject, forwardRef } from '@nestjs/common';
import { TiktokService } from './tiktok.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiRuntimeService } from '../ai-bots/ai-runtime.service';
import { ChatService } from '../../int/chat/chat.service';

export const Public = () => SetMetadata('isPublic', true);

@Controller('int/tiktok')
export class TiktokController {
  private readonly logger = new Logger(TiktokController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tiktokService: TiktokService,
    private readonly aiRuntime: AiRuntimeService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService
  ) {}

  // ==========================================
  // 📩 Webhook รับข้อความจาก TikTok Shop
  // ==========================================
  @Public()
  @Post('webhook/:configId')
  @HttpCode(200)
  async handleWebhook(
    @Param('configId', ParseIntPipe) configId: number,
    @Body() body: any
  ) {
    // 💡 TikTok มักจะส่งประเภท Event มาในตัวแปร type
    if (body.type === 1) { // สมมติว่า 1 คือ Event Message
      // 1. หาข้อมูลร้าน TikTok จากฐานข้อมูล (⚠️ คุณกฤษฎาต้องสร้างตาราง IntTiktokConfig มารองรับด้วยนะครับ)
      const config: any = await this.prisma['intTiktokConfig'].findUnique({
        where: { id: configId }
      });

      if (!config) return { code: 0, message: 'success' };

      const conversationId = body.data.conversation_id;
      const senderId = body.data.sender.id;
      const userText = body.data.content;

      // 2. บันทึกข้อความลูกค้าลง Database Omnichannel
      await this.chatService.handleIncomingMessage(config.companyId, {
        channel: 'TIKTOK',
        senderId: conversationId, // ของ TikTok มักใช้ Conversation ID เป็นตัวอ้างอิงห้องแชท
        senderName: 'ลูกค้า (TikTok)',
        senderType: 'CUSTOMER',
        messageType: 'TEXT',
        content: userText
      });

      // 🤖 3. ให้ AI ตอบ
      if (config.isAiEnabled && config.aiBotId) {
        const aiReply = await this.aiRuntime.chat(
          config.aiBotId,
          userText,
          config.companyId
        );

        // 4. บันทึกคำตอบ AI ลง Database
        await this.chatService.handleIncomingMessage(config.companyId, {
          channel: 'TIKTOK',
          senderId: conversationId,
          senderName: 'AI Bot',
          senderType: 'AI',
          messageType: 'TEXT',
          content: aiReply
        });

        // 5. ส่งข้อความกลับไปที่ TikTok
        await this.tiktokService.replyMessage(
          config.appKey,
          config.accessToken,
          conversationId,
          aiReply,
          config.shopId,
          config.companyId
        );
      }
    }
    
    // ตอบกลับ TikTok ว่ารับข้อความสำเร็จ (TikTok บังคับให้ตอบเป็น JSON)
    return { code: 0, message: 'success' };
  }
}