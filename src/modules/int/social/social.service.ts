// src/modules/int/social/social.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import axios from 'axios';
import { BroadcastDto } from './dto/broadcast.dto';
import { NotificationsService } from '../../sys/notifications/notifications.service';
import { StorageService } from '../../sys/storage/storage.service'; // 🌟 1. นำเข้า StorageService

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationsService,
    private storageService: StorageService // 🌟 2. Inject StorageService
  ) {}

  async broadcast(companyId: number, dto: BroadcastDto) {
    const { message, link, coverImageUrl, channels, targetPageIds } = dto;
    const results: any[] = [];

    // =========================================================
    // 📢 1. LINE OA Broadcast
    // =========================================================
    if (channels.includes('LINE' as any)) {
      const lineConfig = await this.prisma.intLineConfig.findFirst({ 
        where: { companyId } 
      });

      if (!lineConfig?.channelToken) {
        results.push({ channel: 'LINE', status: 'failed', error: 'ไม่พบ Token ของ LINE OA' });
      } else {
        try {
          let linePayload: any = {};
          
          if (coverImageUrl) {
             linePayload = {
              messages: [{
                type: "flex",
                altText: message,
                contents: {
                  type: "bubble",
                  hero: { type: "image", url: coverImageUrl, size: "full", aspectMode: "cover" },
                  body: {
                    type: "box", layout: "vertical",
                    contents: [
                      { type: "text", text: message, weight: "bold", wrap: true },
                      ...(link ? [{ type: "button", action: { type: "uri", label: "ดูรายละเอียด", uri: link }, margin: "md", style: "primary", color: "#4F46E5" }] : [])
                    ]
                  }
                }
              }]
            };
          } else {
             linePayload = {
              messages: [{ type: "text", text: `${message}\n${link || ''}`.trim() }]
            };
          }

          await axios.post('https://api.line.me/v2/bot/message/broadcast', linePayload, {
            headers: { Authorization: `Bearer ${lineConfig.channelToken}` }
          });
          results.push({ channel: 'LINE', status: 'success' });
        } catch (error: any) {
          this.logger.error(`LINE Broadcast Failed: ${error.message}`);
          results.push({ channel: 'LINE', status: 'failed', error: error.response?.data || error.message });
        }
      }
    }

    // =========================================================
    // 📢 2. Facebook Post
    // =========================================================
    if (channels.includes('FACEBOOK' as any)) {
      const pagesToPost = await this.prisma.intFacebookPage.findMany({
        where: { 
            companyId,
            ...(targetPageIds && targetPageIds.length > 0 ? { id: { in: targetPageIds } } : {})
        }
      });

      for (const page of pagesToPost) {
        try {
          if (coverImageUrl) {
            await axios.post(`https://graph.facebook.com/v19.0/${page.pageId}/photos`, {
              url: coverImageUrl,
              message: `${message}\n\n${link ? 'ดูรายละเอียดเพิ่มเติม: ' + link : ''}`,
              access_token: page.accessToken
            });
          } else {
            await axios.post(`https://graph.facebook.com/v19.0/${page.pageId}/feed`, {
              message: `${message}\n\n${link ? link : ''}`,
              access_token: page.accessToken
            });
          }
          
          results.push({ channel: 'FACEBOOK', page: page.pageName, status: 'success' });
        } catch (error: any) {
          this.logger.error(`Facebook Post Failed: ${error.message}`);
          results.push({ channel: 'FACEBOOK', page: page.pageName, status: 'failed', error: error.response?.data || error.message });
        }
      }
    }

    // =========================================================
    // 🔔 3. In-App Notification
    // =========================================================
    if (channels.includes('IN_APP' as any)) {
      try {
        const result = await this.notificationService.broadcastToMembers(companyId, {
            type: 'PROMOTION',
            title: 'ข่าวประชาสัมพันธ์',
            message: message,
            actionUrl: link,
            iconUrl: coverImageUrl
        });

        results.push({ channel: 'IN_APP', status: 'success', count: result.count });
      } catch (error: any) {
        this.logger.error(`In-App Broadcast Failed: ${error.message}`);
        results.push({ channel: 'IN_APP', status: 'failed', error: error.message });
      }
    }

    // =========================================================
    // 🌟 4. ผูกรูปภาพ (Link Media) ป้องกันไฟล์ขยะ
    // =========================================================
    if (coverImageUrl) {
      // แจ้งบัญชีว่ารูปนี้ถูกนำไปส่ง Social (ใส่ refId = 0 เพื่อบอกว่าเป็นรูปกลางสำหรับบรอดแคสต์)
      await this.storageService.linkMedia(companyId, coverImageUrl, 'social_broadcast', 0);
    }

    return results;
  }

  // =========================================================
  // 🗑️ 5. ลบรูปภาพที่ส่ง Social และคืนโควตา
  // =========================================================
  async deleteBroadcastImage(companyId: number, imageUrl: string) {
    if (!imageUrl) return { success: false, message: 'ไม่มีรูปให้ลบ' };
    
    // เรียกคืนพื้นที่ให้บริษัท
    await this.storageService.restoreQuota(companyId, imageUrl);
    return { success: true, message: 'คืนพื้นที่โควตารูปภาพที่ใช้สำหรับส่ง Social สำเร็จ' };
  }

  // =========================================================
  // 🧪 6. ทดสอบส่ง Broadcast หาตัวเอง (In-App)
  // =========================================================
  async testBroadcast(companyId: number, adminUserId: number, dto: BroadcastDto) {
    const { message, link, coverImageUrl } = dto;

    // จำลองการสร้าง Notification โดยยัดไส้ title และ type ให้เหมือนของจริง
    const result = await this.notificationService.create(companyId, {
        type: 'PROMOTION',
        title: '[TEST] ข่าวประชาสัมพันธ์',
        message: message,
        actionUrl: link,
        iconUrl: coverImageUrl,
        recipientUserId: adminUserId, // 🌟 ส่งเข้ากระดิ่ง Admin
        recipientMemberId: undefined, // ไม่ส่งหาลูกค้า
    } as any);

    return { success: true, message: 'ส่งทดสอบเข้ากระดิ่งสำเร็จ', data: result };
  }

  
}