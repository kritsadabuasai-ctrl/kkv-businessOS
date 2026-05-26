import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { StorageService } from '../../sys/storage/storage.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService 
  ) {}

  /**
   * 📢 1. ส่งการแจ้งเตือนรายบุคคล (Internal Call)
   */
 async create(companyId: number, dto: CreateNotificationDto) {
    const notification = await this.prisma.sysNotification.create({
      data: {
        companyId, 
        recipientMemberId: dto.recipientMemberId,
        recipientUserId: dto.recipientUserId,
        type: dto.type as NotificationType,
        title: dto.title,
        message: dto.message,
        iconUrl: dto.iconUrl,
        actionUrl: dto.actionUrl,
        announcementId: dto.announcementId,
      },
    });

    // 🌟 3. ผูกรูปภาพเข้ากับการแจ้งเตือน (กรณีส่งแบบรายบุคคล ผูกกับ ID ได้เลย)
    if (dto.iconUrl) {
      await this.storageService.linkMedia(companyId, dto.iconUrl, 'notification', Number(notification.id));
    }

    return { ...notification, id: notification.id.toString() };
  }

  /**
   * 📢📢 2. ส่งการแจ้งเตือนหา "กลุ่มสมาชิก" (Broadcast)
   */
 async broadcastToMembers(companyId: number, dto: Partial<CreateNotificationDto>) {
    const whereCondition: any = { companyId, isActive: true };

    if (dto.type === 'PROMOTION' || dto.type === 'REWARD') {
      whereCondition.isMarketingConsent = true; 
    }

    const members = await this.prisma.crmMember.findMany({
      where: whereCondition,
      select: { id: true }
    });

    if (members.length === 0) return { success: true, count: 0 };

    const notificationsData = members.map(member => ({
      companyId, 
      recipientMemberId: member.id,
      recipientUserId: null,
      type: (dto.type || 'SYSTEM') as NotificationType,
      title: dto.title || 'ประกาศ',
      message: dto.message || '',
      iconUrl: dto.iconUrl, // 👈 ใช้รูปร่วมกัน 100 คน
      actionUrl: dto.actionUrl,
      announcementId: dto.announcementId,
      isRead: false
    }));

    const result = await this.prisma.sysNotification.createMany({
      data: notificationsData
    });

    // 🌟 4. ป้องกันรูปถูกลบ! เราจะผูกรูปนี้ไว้กับ ID พิเศษ (เช่น 0) 
    // เพื่อบอกสมุดบัญชีว่า "นี่คือรูปรวมของ Broadcast ห้ามลบนะ!"
    if (dto.iconUrl) {
      await this.storageService.linkMedia(companyId, dto.iconUrl, 'notification_broadcast', 0);
    }

    return { success: true, count: result.count };
  }

  /**
   * 📥 3. ดึงรายการแจ้งเตือน
   */
  async findAll(companyId: number, recipient: { memberId?: number; userId?: number }, page = 1, limit = 20) {
    // ✅ Filter companyId เสมอ
    const whereCondition: any = { companyId };

    if (recipient.memberId) whereCondition.recipientMemberId = recipient.memberId;
    if (recipient.userId) whereCondition.recipientUserId = recipient.userId;

    // แปลง page/limit เป็น number เสมอเพื่อความชัวร์
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;

    const notifications = await this.prisma.sysNotification.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

    const unreadCount = await this.prisma.sysNotification.count({
      where: { ...whereCondition, isRead: false },
    });

    return {
      data: notifications.map(n => ({ ...n, id: n.id.toString() })),
      meta: { unreadCount, page: pageNum, limit: limitNum }
    };
  }

  /**
   * ✅ 4. อ่านแจ้งเตือน (Mark as Read)
   */
  async markAsRead(companyId: number, id: string) {
    const bigIntId = BigInt(id);
    
    // ✅ เช็ค companyId ก่อน update ป้องกันการมั่ว ID ข้ามบริษัท
    const notification = await this.prisma.sysNotification.findFirst({ 
      where: { id: bigIntId, companyId } 
    });
    
    if (!notification) throw new NotFoundException('Notification not found');

    const updated = await this.prisma.sysNotification.update({
      where: { id: bigIntId },
      data: { isRead: true, readAt: new Date() }
    });
    return { ...updated, id: updated.id.toString() };
  }

  /**
   * ✅✅ 5. อ่านทั้งหมด
   */
  async markAllAsRead(companyId: number, recipient: { memberId?: number; userId?: number }) {
    const whereCondition: any = { companyId, isRead: false };
    
    if (recipient.memberId) whereCondition.recipientMemberId = recipient.memberId;
    if (recipient.userId) whereCondition.recipientUserId = recipient.userId;

    await this.prisma.sysNotification.updateMany({
      where: whereCondition,
      data: { isRead: true, readAt: new Date() }
    });
    return { success: true };
  }

  /**
   * 🗑️ 6. ลบประวัติการ Broadcast และคืนโควตาพื้นที่
   * (เรียกใช้เมื่อแอดมินกดลบประกาศบรอดแคสต์จากหน้าประวัติ)
   */
  async deleteBroadcast(companyId: number, iconUrl: string) {
    if (!iconUrl) {
      throw new NotFoundException('ไม่พบ URL ของรูปภาพที่ต้องการลบ');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. ค้นหาว่ามีแจ้งเตือนไหนบ้างที่ใช้รูปนี้ (เพื่อดูว่ามีข้อมูลให้ลบจริงไหม)
      const count = await tx.sysNotification.count({
        where: { companyId, iconUrl }
      });

      if (count > 0) {
        // 2. ลบข้อมูลแจ้งเตือนทั้งหมดที่ผูกกับรูปนี้ (เคลียร์ขยะในหน้ากระดิ่งของ User)
        await tx.sysNotification.deleteMany({
          where: { companyId, iconUrl }
        });
      }

      // 🌟 3. เรียกใช้ StorageService เพื่อ "คืนโควตาพื้นที่" และลบประวัติใน SysMedia
      await this.storageService.restoreQuota(companyId, iconUrl);

      return { 
        success: true, 
        message: `ลบประวัติการส่งและคืนพื้นที่โควตาสำเร็จ (เคลียร์แจ้งเตือนไป ${count} รายการ)` 
      };
    });
  }
}