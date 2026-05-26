import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';

@Injectable()
export class RewardsService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 🎁 1. สร้างของรางวัลใหม่ พร้อมผูกรูปเข้าคลังไฟล์ DMS + 🛡️ Defensive Code
  // =========================================================
  async create(dto: CreateRewardDto) {
    
    // 🌟 [Defensive Code] ตรวจสอบว่ารูปภาพของรางวัลมีอยู่จริงในตาราง SysMedia
    let finalMediaId = dto.mediaId;
    if (finalMediaId) {
      const mediaExists = await this.prisma.sysMedia.findUnique({
        where: { id: finalMediaId },
        select: { id: true }
      });
      if (!mediaExists) {
        console.warn(`⚠️ [Create Reward] Media ID: ${finalMediaId} หาไม่เจอในระบบ ข้ามการผูกรูปภาพของรางวัลนี้`);
        finalMediaId = undefined; // หรือ null เพื่อข้ามการผูก Foreign Key
      }
    }

    return this.prisma.crmReward.create({
      data: {
        companyId: dto.companyId,
        shopId: dto.shopId, 
        name: dto.name,
        description: dto.description,
        mediaId: finalMediaId, // 🚩 ใช้ ID ที่ผ่านการกรองแล้ว
        pointCost: dto.pointCost,
        type: dto.type,
        discountTemplateId: dto.discountTemplateId,
        productId: dto.productId,
        stockQty: dto.stockQty,
        isActive: dto.isActive,
      },
      include: {
        media: true // ดึงรายละเอียดออบเจกต์รูปกลับไปด้วยเพื่อให้หน้าบ้านดึง .url ไปใช้งานได้ทันที
      }
    });
  }

  // =========================================================
  // 🔍 2. ดึงรายการของรางวัลทั้งหมด (แสดงผลควบคู่รูปภาพ DMS)
  // =========================================================
  async findAll(companyId: number, shopId?: number) {
    const whereClause: any = { companyId };
    
    if (shopId) {
      whereClause.OR = [
        { shopId: shopId },  // รางวัลเฉพาะสาขา
        { shopId: null }     // รางวัลส่วนกลาง
      ];
    }

    return this.prisma.crmReward.findMany({
      where: whereClause,
      include: {
        shop: { select: { shopName: true } }, 
        media: true // 🚩 ดึงข้อมูลและ URL สื่อภาพจากตาราง SysMedia ไปยังฝ่าย UI หน้าบ้าน
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // =========================================================
  // 🔍 3. เรียกดูของรางวัลรายการเดี่ยว
  // =========================================================
  async findOne(id: number) {
    const reward = await this.prisma.crmReward.findUnique({
      where: { id },
      include: { 
        shop: { select: { shopName: true } },
        media: true // 🚩 ดึงรายละเอียดรูปภาพประกอบผ่านความสัมพันธ์ของระบบ DMS
      }
    });
    if (!reward) throw new NotFoundException('ไม่พบของรางวัล');
    return reward;
  }

 // =========================================================
  // 📝 4. แก้ไขข้อมูลของรางวัล + 🛡️ Defensive Code
  // =========================================================
  async update(id: number, dto: UpdateRewardDto) {
    await this.findOne(id);

    // 🌟 [Defensive Code] ตรวจสอบรูปภาพก่อนอัปเดต
    let finalMediaId = dto.mediaId;
    if (finalMediaId) {
      const mediaExists = await this.prisma.sysMedia.findUnique({
        where: { id: finalMediaId },
        select: { id: true }
      });
      if (!mediaExists) {
        console.warn(`⚠️ [Update Reward] Media ID: ${finalMediaId} หาไม่เจอในระบบ ข้ามการผูกรูปภาพของรางวัลนี้`);
        finalMediaId = undefined; 
      }
    }

    return this.prisma.crmReward.update({
      where: { id },
      data: {
        shopId: dto.shopId, 
        name: dto.name,
        description: dto.description,
        // 🚩 ถ้าเป็น undefined Prisma จะข้ามการอัปเดตฟิลด์นี้ (ยึดรูปเดิม) 
        // 🚩 แต่ถ้าตั้งใจลบรูป หน้าบ้านอาจจะต้องส่ง null แทน ซึ่งคุณสามารถปรับแก้ตรงนี้ได้ตาม Logic หน้าบ้านครับ
        ...(finalMediaId !== undefined && { mediaId: finalMediaId }),
        pointCost: dto.pointCost,
        type: dto.type,
        discountTemplateId: dto.discountTemplateId,
        productId: dto.productId,
        stockQty: dto.stockQty,
        isActive: dto.isActive,
      },
      include: {
        media: true
      }
    });
  }

  // =========================================================
  // ❌ 5. ลบของรางวัลออกจากระบบ
  // =========================================================
  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.crmReward.delete({
      where: { id },
    });
  }
}