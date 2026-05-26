import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // 1. สร้างประกาศใหม่ (Create) + 🛡️ Defensive Code
  // ==========================================
  async create(dto: CreateAnnouncementDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1.1 บันทึกข้อมูลประกาศหลักลง com_announcements
      const announcement = await tx.comAnnouncement.create({
        data: {
          companyId: dto.companyId!,
          title: dto.title,
          content: dto.content,
          linkUrl: dto.linkUrl,
          type: dto.type || 'BANNER',
          position: dto.position || 'HOME_HERO',
          displayOrder: dto.displayOrder ?? 0,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          isActive: dto.isActive ?? true,
          targetShops: {
            connect: dto.shopIds?.map((id) => ({ id })) || [],
          },
        },
      });

      // 1.2 วนลูปผูกสื่อเข้ากับตารางกลาง com_announcement_media
      if (dto.media && dto.media.length > 0) {
        for (const item of dto.media) {
          
          // 🛡️ ป้องกัน ID ผีสิง: เช็กก่อนว่ามีไฟล์ในตาราง SysMedia จริงไหม
          const mediaExists = await tx.sysMedia.findUnique({
            where: { id: item.mediaId },
            select: { id: true }
          });

          if (mediaExists) {
            await tx.comAnnouncementMedia.create({
              data: {
                companyId: dto.companyId!,
                announcementId: announcement.id,
                mediaId: item.mediaId,
                mediaType: item.mediaType || 'BANNER_IMAGE',
              },
            });
          } else {
            console.warn(`⚠️ [Create Announcement] Media ID: ${item.mediaId} ไม่พบในระบบ ข้ามการผูกรูปภาพนี้`);
          }
        }
      }

      // ดึงข้อมูลความสัมพันธ์แบบครบถ้วนส่งกลับ
      return tx.comAnnouncement.findUnique({
        where: { id: announcement.id },
        include: { 
          targetShops: true, 
          media: { include: { media: true } } 
        },
      });
    });
  }

  // ==========================================
  // 2. ดึงประกาศทั้งหมด (Find All)
  // ==========================================
  async findAll(companyId: number, shopId?: number) {
    return this.prisma.comAnnouncement.findMany({
      where: {
        companyId,
        ...(shopId ? { targetShops: { some: { id: shopId } } } : {}),
      },
      include: { 
        targetShops: true, 
        media: { include: { media: true } } 
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  // ==========================================
  // 3. ดึงประกาศที่เปิดใช้งานสำหรับแสดงหน้าร้าน
  // ==========================================
  async findActive(companyId: number, shopId?: number, position?: string) {
    const now = new Date();
    return this.prisma.comAnnouncement.findMany({
      where: {
        companyId,
        isActive: true,
        ...(position ? { position } : {}),
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
        ],
        ...(shopId ? { targetShops: { some: { id: shopId } } } : {}),
      },
      include: { 
        media: { include: { media: true } } 
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  // ==========================================
  // 4. ดึงข้อมูลประกาศตาม ID (Find One)
  // ==========================================
  async findOne(id: number, companyId: number) {
    const announcement = await this.prisma.comAnnouncement.findUnique({
      where: { id },
      include: { 
        targetShops: true, 
        media: { include: { media: true } } 
      },
    });

    if (!announcement || announcement.companyId !== companyId) {
      throw new NotFoundException('ไม่พบข้อมูลประกาศที่คุณต้องการเข้าถึง');
    }
    return announcement;
  }

 // ==========================================
  // 5. อัปเดตข้อมูลประกาศ (Update) + 🛡️ Defensive Code
  // ==========================================
  async update(id: number, dto: UpdateAnnouncementDto, companyId: number) {
    await this.findOne(id, companyId);

    return this.prisma.$transaction(async (tx) => {
      const { shopIds, media, ...updateData } = dto;

      // 5.1 แก้ไขข้อมูลพื้นฐานบนตารางหลัก
      await tx.comAnnouncement.update({
        where: { id },
        data: {
          title: updateData.title,
          content: updateData.content,
          linkUrl: updateData.linkUrl,
          type: updateData.type,
          position: updateData.position,
          displayOrder: updateData.displayOrder,
          startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
          endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
          isActive: updateData.isActive,
          ...(shopIds !== undefined && {
            targetShops: {
              set: shopIds.map((shopId) => ({ id: shopId })),
            },
          }),
        },
      });

      // 5.2 บริหารจัดการอัปเดตไฟล์แนบ/รูปภาพ (ใช้วิธีล้างประวัติเก่าแล้วเขียนทับใหม่)
      if (media !== undefined) {
        await tx.comAnnouncementMedia.deleteMany({
          where: { announcementId: id },
        });

        if (media.length > 0) {
          for (const item of media) {
            
            // 🛡️ ป้องกัน ID ผีสิง: เช็กก่อนว่ามีไฟล์ในตาราง SysMedia จริงไหม
            const mediaExists = await tx.sysMedia.findUnique({
              where: { id: item.mediaId },
              select: { id: true }
            });

            if (mediaExists) {
              await tx.comAnnouncementMedia.create({
                data: {
                  companyId: companyId,
                  announcementId: id,
                  mediaId: item.mediaId,
                  mediaType: item.mediaType || 'BANNER_IMAGE',
                },
              });
            } else {
              console.warn(`⚠️ [Update Announcement] Media ID: ${item.mediaId} ไม่พบในระบบ ข้ามการผูกรูปภาพนี้`);
            }
          }
        }
      }

      // ดึงผลลัพธ์ข้อมูลล่าสุดกลับไปอัปเดตสถานะฝั่งหน้าบ้าน
      return tx.comAnnouncement.findUnique({
        where: { id },
        include: { 
          targetShops: true, 
          media: { include: { media: true } } 
        },
      });
    });
  }

  // ==========================================
  // 6. ลบประกาศ (Delete)
  // ==========================================
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);

    return this.prisma.$transaction(async (tx) => {
      // ข้อมูลบนตาราง com_announcement_media จะถูกลบทิ้งผ่านความสัมพันธ์ Cascade อัตโนมัติ
      await tx.comAnnouncement.delete({ where: { id } });
      return { message: 'ลบประกาศและล้างไฟล์เชื่อมโยงในระบบสำเร็จ' };
    });
  }
}