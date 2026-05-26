import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { LineService } from '../line/line.service'; // 👈 1. Import LineService

@Injectable()
export class MessageQueueWorker {
  private readonly logger = new Logger(MessageQueueWorker.name);

  // 👈 2. Inject LineService เข้ามาใน Constructor
  constructor(
    private prisma: PrismaService,
    private lineService: LineService 
  ) {}

  @Cron(CronExpression.EVERY_MINUTE) 
  async processQueue() {
    this.logger.debug('🕵️‍♂️ Checking for scheduled messages...');

    const pendingMessages = await this.prisma.intMessageQueue.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        scheduledTime: { lte: new Date() },
        retryCount: { lt: 3 }
      },
      take: 50,
    });

    if (pendingMessages.length === 0) return;

    this.logger.log(`📦 Found ${pendingMessages.length} messages to process.`);

    const messageIds = pendingMessages.map(m => m.id);
    await this.prisma.intMessageQueue.updateMany({
      where: { id: { in: messageIds } },
      data: { status: 'PROCESSING' }
    });

    for (const msg of pendingMessages) {
      try {
        this.logger.log(`🚀 Sending [${msg.channel}] to ${msg.recipient}...`);
        
        // --------------------------------------------------------
        // 🔥 โค้ดส่งข้อความของจริง เริ่มตรงนี้ 🔥
        // --------------------------------------------------------
        if (msg.channel === 'LINE') {
          // 1. ดึง Token ของบริษัทนั้นๆ ออกมาจาก Database
          const lineConfig = await this.prisma.intLineConfig.findFirst({
            where: { companyId: msg.companyId, channelToken: { not: '' } }
          });

          if (!lineConfig) {
            throw new Error('ไม่พบการตั้งค่า LINE Token สำหรับบริษัทนี้');
          }

          // 2. จัดรูปแบบข้อความตามที่ LINE API ต้องการ
          const lineMessages = [{ type: 'text', text: msg.content }];

          // 3. สั่งยิง!
          await this.lineService.pushMessage(
            lineConfig.channelToken, 
            msg.recipient, 
            lineMessages, 
            msg.companyId, 
            msg.refType || undefined, 
            msg.refId || undefined
          );
        } else {
            // (เผื่ออนาคตทำระบบ SMS หรือ Email)
            this.logger.warn(`Channel ${msg.channel} is not implemented yet.`);
        }
        // --------------------------------------------------------

        await this.prisma.intMessageQueue.update({
          where: { id: msg.id },
          data: { status: 'SENT', sentAt: new Date(), errorMessage: null }
        });
        this.logger.log(`✅ Message ${msg.id} sent successfully.`);

      } catch (error: any) {
        this.logger.error(`❌ Failed to send message ${msg.id}: ${error.message}`);
        
        const nextRetryCount = msg.retryCount + 1;
        const newStatus = nextRetryCount >= msg.maxRetries ? 'CANCELLED' : 'FAILED';

        await this.prisma.intMessageQueue.update({
          where: { id: msg.id },
          data: { status: newStatus, retryCount: nextRetryCount, errorMessage: error.message || 'Unknown error' }
        });
      }
    }
  }
}