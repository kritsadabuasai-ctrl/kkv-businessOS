import { Controller, Get, Post, Body, Query, HttpCode, Param, ParseIntPipe, Logger, SetMetadata, Inject, forwardRef } from '@nestjs/common';
import { InstagramService } from './instagram.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiRuntimeService } from '../ai-bots/ai-runtime.service';
import { ChatService } from '../../int/chat/chat.service';

export const Public = () => SetMetadata('isPublic', true);

@Controller('int/instagram') // 🌟 API Endpoint ตามที่คุณกฤษฎาต้องการ
export class InstagramController {
  private readonly logger = new Logger(InstagramController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instagramService: InstagramService,
    private readonly aiRuntime: AiRuntimeService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService
  ) {}

  // ==========================================
  // 🛡️ 1. สำหรับให้ Meta Verify Webhook (ใช้ GET)
  // ==========================================
  @Public()
  @Get('webhook/:configId')
  verifyWebhook(
    @Param('configId', ParseIntPipe) configId: number,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string
  ) {
    const VERIFY_TOKEN = 'kkv_ig_verify_1234'; // 🌟 รหัสสำหรับกรอกในหน้า Meta

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        this.logger.log(`✅ IG Webhook Verified for Config ID: ${configId}`);
        return challenge; 
      }
    }
    return 'Forbidden';
  }

  // ==========================================
  // 📩 2. สำหรับรับข้อความแชทจากลูกค้า (ใช้ POST)
  // ==========================================
  @Public()
  @Post('webhook/:configId')
  @HttpCode(200)
  async handleWebhook(
    @Param('configId', ParseIntPipe) configId: number,
    @Body() body: any
  ) {
    // 💡 แยกแยะว่าเป็นข้อความของ IG (ของ Facebook จะเป็น 'page')
    if (body.object === 'instagram') {
      
      // ⚠️ สมมติว่าคุณกฤษฎาสร้างตาราง IntInstagramConfig ไว้ใน Prisma แล้ว
      const config: any = await this.prisma['intInstagramConfig'].findUnique({
        where: { id: configId }
      });

      if (!config) return 'OK';

      for (const entry of body.entry) {
        const webhookEvent = entry.messaging[0];
        const senderIgsid = webhookEvent.sender.id; // ไอดีลูกค้าใน IG

        if (webhookEvent.message && webhookEvent.message.text) {
          const userText = webhookEvent.message.text;

          // 1. บันทึกข้อความลูกค้าลง Database
          await this.chatService.handleIncomingMessage(config.companyId, {
            channel: 'INSTAGRAM',
            senderId: senderIgsid,
            senderName: 'ลูกค้า (IG)',
            senderType: 'CUSTOMER',
            messageType: 'TEXT',
            content: userText
          });

          // 🤖 2. ให้ AI ตอบ
          if (config.isAiEnabled && config.aiBotId) {
            const aiReply = await this.aiRuntime.chat(config.aiBotId, userText, config.companyId);

            // 3. บันทึกคำตอบ AI
            await this.chatService.handleIncomingMessage(config.companyId, {
              channel: 'INSTAGRAM',
              senderId: senderIgsid,
              senderName: 'AI Bot',
              senderType: 'AI',
              messageType: 'TEXT',
              content: aiReply
            });

            // 4. ส่งข้อความกลับไปที่ Instagram
            await this.instagramService.replyMessage(
              config.accessToken, // 💡 ใช้ Page Access Token ตัวเดียวกับ Facebook ได้เลย!
              senderIgsid,
              aiReply,
              config.companyId
            );
          }
        }
      }
      return 'EVENT_RECEIVED';
    } 
    return 'NOT_FOUND';
  }
}