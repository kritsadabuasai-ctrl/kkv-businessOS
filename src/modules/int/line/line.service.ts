import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  // =========================================================
  // 🛠️ Core: ฟังก์ชันพื้นฐาน (ยิง LINE API)
  // =========================================================

  async pushMessage(channelToken: string, to: string, messages: any[], companyId: number, refType?: string, refId?: string) {
    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/push',
        { to, messages },
        { headers: { Authorization: `Bearer ${channelToken}`, 'Content-Type': 'application/json' } }
      );
      
      this.logger.log(`✅ LINE Push sent to ${to} (Company: ${companyId})`);
      await this.logMessage(companyId, 'LINE', to, JSON.stringify(messages), 'SUCCESS', refType, refId);

    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      this.logger.error(`❌ LINE Push Failed: ${errorMsg}`);
      await this.logMessage(companyId, 'LINE', to, JSON.stringify(messages), 'FAILED', refType, refId, errorMsg);
    }
  }

  async replyMessage(channelToken: string, replyToken: string, messages: any[], companyId: number) {
    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/reply',
        { replyToken, messages },
        { headers: { Authorization: `Bearer ${channelToken}`, 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      this.logger.error(`❌ LINE Reply Failed: ${errorMsg}`);
    }
  }

  // =========================================================
  // 📦 Business Logic: ส่งข้อความตามสถานะระบบ
  // =========================================================

  /**
   * ✅ Helper: หา LINE Config หลักของบริษัท (ที่มี Token พร้อมใช้)
   */
  private async getMainLineConfig(companyId: number) {
    // พยายามหาตัวที่เปิด AI ก่อน (ถือว่าเป็นตัวหลัก) หรือตัวที่มี Token
    return this.prisma.intLineConfig.findFirst({
      where: { 
        companyId,
        channelToken: { not: '' } // ต้องมี Token
      },
      orderBy: { isAiEnabled: 'desc' } // ให้ความสำคัญตัวที่เปิด AI ก่อน
    });
  }

  async sendOrderStatusUpdate(companyId: number, customerLineId: string, order: any) {
    const config = await this.getMainLineConfig(companyId);
    if (!config) return;

    const message = [
      {
        type: 'text',
        text: `📦 ออเดอร์ #${order.orderNo} สถานะ: ${order.status}\nขอบคุณที่ใช้บริการค่ะ`
      }
    ];

    await this.pushMessage(config.channelToken, customerLineId, message, companyId, 'ORDER', order.id.toString());
  }

  async sendAdminNewOrderNotification(companyId: number, order: any, adminLineId: string) {
    const config = await this.getMainLineConfig(companyId);
    if (!config) return;

    const message = [
      {
        type: 'text',
        text: `🔔 มีออเดอร์ใหม่! #${order.orderNo}\n💰 ยอดรวม: ${order.totalAmount} บาท\nดูรายละเอียดที่หลังบ้านได้เลยค่ะ`
      }
    ];

    await this.pushMessage(config.channelToken, adminLineId, message, companyId, 'ORDER_ADMIN', order.id.toString());
  }

  // =========================================================
  // 📝 Helper: Log
  // =========================================================

  private async logMessage(companyId: number, channel: string, recipient: string, content: string, status: string, refType?: string, refId?: string, errorMsg?: string) {
    try {
      await this.prisma.comMessageLog.create({
        data: { companyId, channel, recipient, content, status, refType, refId, errorMessage: errorMsg }
      });
    } catch (e) {
      this.logger.error("Failed to save ComMessageLog", e);
    }
  }
}