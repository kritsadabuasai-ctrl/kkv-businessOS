import { Controller, Get, Post, Body, Query, HttpCode, Logger, SetMetadata, Inject, forwardRef, HttpException, HttpStatus } from '@nestjs/common';
import { FacebookService } from './facebook.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiRuntimeService } from '../ai-bots/ai-runtime.service';
import { ChatService } from '../../int/chat/chat.service';

// อนุญาตให้ Facebook ยิงเข้ามาได้โดยไม่ต้องล็อกอินผ่านระบบของ KKV
export const Public = () => SetMetadata('isPublic', true);

@Controller('int/facebook')
export class FacebookController {
  private readonly logger = new Logger(FacebookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
    private readonly aiRuntime: AiRuntimeService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService
  ) {}

  // ==========================================
  // 🛡️ 1. สำหรับให้ Facebook Verify Webhook (ใช้ GET)
  // ==========================================
  @Public()
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string, 
    @Query('hub.challenge') challenge: string 
  ) {
    // 🟢 จุดตั้งค่ารหัสผ่าน (Webhook Verify Token)
    // ระบบจะหาจากไฟล์ .env ก่อน ถ้าไม่มีจะใช้รหัส 'kkv_secret_webhook_2026' แทน
    // คุณกฤษฎาสามารถแก้คำว่า 'kkv_secret_webhook_2026' เป็นรหัสที่ต้องการได้เลยครับ
    const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'kkv_secret_webhook_2026';

    if (mode && token) {
      if (mode === 'subscribe' && token === verifyToken) {
        this.logger.log('✅ Facebook Webhook Verified Successfully!');
        return challenge; // ต้องตอบกลับด้วย challenge ที่ Facebook ส่งมา
      } else {
        this.logger.error('❌ Facebook Webhook Verification Failed: Token mismatch');
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      }
    }
    
    return 'KKV Facebook Webhook is active';
  }

  // ==========================================
  // 📩 2. สำหรับรับข้อความแชทจากลูกค้า (ใช้ POST)
  // ==========================================
  @Public()
  @Post('webhook')
  @HttpCode(200) // ต้องตอบ 200 OK ให้ Facebook เสมอ ภายใน 20 วินาที
  async handleWebhook(@Body() body: any) {
    if (body.object === 'page') {
      
      for (const entry of body.entry) {
        const pageId = entry.id; 

        // 🔍 ค้นหาว่า Page ID นี้ผูกอยู่กับบริษัทไหนในระบบเรา
        const config = await this.prisma.intFacebookPage.findUnique({
          where: { pageId: pageId },
        });

        // ถ้าไม่มีเพจนี้ในระบบ ให้ข้ามไปเลย
        if (!config) {
          this.logger.warn(`ได้รับข้อความจาก Page ID: ${pageId} แต่ไม่ได้เชื่อมต่อในระบบ`);
          continue;
        }

        // วนลูปอ่านข้อความ (บางครั้ง Facebook ส่งมาหลายข้อความพร้อมกัน)
        for (const webhookEvent of entry.messaging) {
          const senderPsid = webhookEvent.sender.id;

          // ถ้าเป็นข้อความที่เรา (เพจ) ส่งเอง ให้ข้ามไป
          if (webhookEvent.message?.is_echo) {
              continue; 
          }

          // ถ้ามีข้อความ Text ส่งมา
          if (webhookEvent.message && webhookEvent.message.text) {
            const userText = webhookEvent.message.text;

            try {
              // 1. บันทึกข้อความลูกค้าลง Database Omnichannel
              await this.chatService.handleIncomingMessage(config.companyId, {
                channel: 'FACEBOOK',
                senderId: senderPsid,
                senderName: 'ลูกค้า (FB)', // อนาคตสามารถดึงชื่อจาก Graph API ได้
                senderType: 'CUSTOMER',
                messageType: 'TEXT',
                content: userText
              });

              // 🤖 2. ให้ AI ตอบ (ถ้าเพจนี้เปิดใช้งาน AI ไว้)
              if (config.isAiEnabled && config.aiBotId) {
                const aiReply = await this.aiRuntime.chat(
                  config.aiBotId,
                  userText,
                  config.companyId
                );

                if (aiReply) {
                  // บันทึกคำตอบ AI ลง Database
                  await this.chatService.handleIncomingMessage(config.companyId, {
                    channel: 'FACEBOOK',
                    senderId: config.pageId,
                    senderName: 'AI Assistant',
                    senderType: 'AI',
                    messageType: 'TEXT',
                    content: aiReply
                  });

                  // ส่งข้อความกลับไปที่ Facebook
                  await this.facebookService.replyMessage(
                    config.accessToken,
                    senderPsid,
                    aiReply,
                    config.companyId
                  );
                }
              }
            } catch (error) {
              this.logger.error(`Error processing message: ${error.message}`);
            }
          }
        }
      }
      return 'EVENT_RECEIVED';
    } else {
      throw new HttpException('Not Found', HttpStatus.NOT_FOUND);
    }
  }
}