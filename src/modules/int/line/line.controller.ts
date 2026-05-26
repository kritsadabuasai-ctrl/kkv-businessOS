import { Controller, Post, Body, Headers, HttpCode, Param, ParseIntPipe, Logger, Request, BadRequestException, SetMetadata, Inject, forwardRef } from '@nestjs/common';
import { LineService } from './line.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiRuntimeService } from '../ai-bots/ai-runtime.service';
import { ChatService } from '../../int/chat/chat.service';
import * as crypto from 'crypto';
import axios from 'axios'; 

export const Public = () => SetMetadata('isPublic', true);

@Controller('int/line')
export class LineController {
  private readonly logger = new Logger(LineController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lineService: LineService,
    private readonly aiRuntime: AiRuntimeService,
    // 🌟 เปลี่ยนบรรทัดนี้: ใส่ Inject และ forwardRef เข้าไป
    @Inject(forwardRef(() => ChatService)) 
    private readonly chatService: ChatService
  ) {}

  @Public() 
  @Post('webhook/:configId')
  @HttpCode(200)
  async handleWebhook(
    @Param('configId', ParseIntPipe) configId: number,
    @Body() body: any,
    @Headers('x-line-signature') signature: string,
    @Request() req: any
  ) {
    const config = await this.prisma.intLineConfig.findUnique({ 
      where: { id: configId } 
    });

    if (!config) {
      this.logger.warn(`⚠️ Webhook received for unknown configId: ${configId}`);
      return 'OK'; 
    }

    // ==========================================
    // 🛡️ [SECURITY] Verify LINE Signature 
    // ==========================================
    if (!signature) {
      this.logger.error(`❌ [Missing Signature] Config ID: ${configId}`);
      throw new BadRequestException('Missing signature');
    }

    const channelSecret = config.channelSecret;
    
    // 🌟 ดึงข้อมูลมาเช็ค ถ้า rawBody มีให้ใช้ ถ้าไม่มีให้ใช้แผนสำรอง
    const payload = req.rawBody ? req.rawBody : JSON.stringify(body);

    const hash = crypto
      .createHmac('sha256', channelSecret)
      .update(payload)
      .digest('base64');

    if (hash !== signature) {
      this.logger.error(`❌ [Invalid Signature] Config ID: ${configId} - Request might be forged!`);
      throw new BadRequestException('Invalid signature');
    }
    
    // ==========================================
    // 📩 Process Events (รับข้อความ/รูปภาพ)
    // ==========================================
    const events = body.events || [];
    
    await Promise.all(events.map(async (event) => {
      try {
        if (event.type === 'message') {
          let userText = '';
          let imageBase64: string | null = null;

          if (event.message.type === 'text') {
            userText = event.message.text;
            this.logger.log(`📩 Msg from ${event.source.userId}: "${userText}"`);
          } 
          else if (event.message.type === 'image') {
            this.logger.log(`📸 Image received from ${event.source.userId}, downloading from LINE...`);
            try {
              const response = await axios.get(
                `https://api-data.line.me/v2/bot/message/${event.message.id}/content`,
                {
                  headers: { Authorization: `Bearer ${config.channelToken}` },
                  responseType: 'arraybuffer'
                }
              );
              imageBase64 = Buffer.from(response.data).toString('base64');
              userText = "ลูกค้าส่งรูปภาพมาให้ ช่วยค้นหาสินค้าที่คล้ายกับรูปภาพนี้ พร้อมแจ้งราคาส่งและแนบลิงก์ Marketplace ให้ลูกค้าหน่อยครับ";
              this.logger.log(`✅ Image downloaded successfully!`);
            } catch (imgErr: any) {
              this.logger.error(`❌ Failed to download image from LINE: ${imgErr.message}`);
            }
          }

          // 🌟 1. บันทึกข้อความที่ลูกค้าพิมพ์ ลง Database (ให้แสดงในหน้า Omnichannel)
          if (userText || imageBase64) {
             await this.chatService.handleIncomingMessage(config.companyId, {
                channel: 'LINE',
                senderId: event.source.userId,
                senderName: 'ลูกค้า (LINE)', 
                senderType: 'CUSTOMER',
                messageType: event.message.type === 'image' ? 'IMAGE' : 'TEXT',
                content: event.message.type === 'image' ? '[ส่งรูปภาพ]' : userText
             });
          }

          if ((userText || imageBase64) && config.isAiEnabled && config.aiBotId) {
            
            const aiReply = await this.aiRuntime.chat(
              config.aiBotId, 
              userText, 
              config.companyId,
              imageBase64 
            );

            // 🌟 2. บันทึกสิ่งที่ AI ตอบ ลง Database (ให้แอดมินเห็นด้วย)
            await this.chatService.handleIncomingMessage(config.companyId, {
              channel: 'LINE',
              senderId: event.source.userId,
              senderName: 'AI Bot',
              senderType: 'AI',
              messageType: 'TEXT',
              content: aiReply
            });
            
            await this.lineService.replyMessage(
              config.channelToken, 
              event.replyToken, 
              [{ type: 'text', text: aiReply }],
              config.companyId
            );
          }
        }
      } catch (err: any) {
        this.logger.error(`❌ Error processing event: ${err.message}`);
      }
    }));

    return 'OK'; 
  }
}