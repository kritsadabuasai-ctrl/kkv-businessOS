import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; 
import { CreatePointAdjustmentDto } from './dto/create-point-adjustment.dto';

@Injectable()
export class PointLogsService {
  constructor(private prisma: PrismaService) {}

  // 1. เพิ่ม/ลดแต้มด้วยมือ (Manual Adjustment)
  async createAdjustment(companyId: number, userId: number, dto: CreatePointAdjustmentDto) {
    // 🌟 ดัก Error เพื่อให้ชัวร์ว่ามีการส่ง shopId มาด้วย (เพราะตอนนี้แต้มแยกตามร้านแล้ว)
    // หมายเหตุ: บอสต้องเพิ่ม shopId?: number ใน CreatePointAdjustmentDto ด้วยนะครับ
    if (!dto.shopId) {
      throw new BadRequestException('กรุณาระบุรหัสสาขา (shopId) ที่ต้องการปรับแต้ม');
    }

    const validShopId: number = dto.shopId;

    return this.prisma.$transaction(async (tx) => {
      // 🌟 เปลี่ยนมาดึงข้อมูลจาก CrmMemberShop แทน CrmMember
      const shopMember = await tx.crmMemberShop.findUnique({
        where: { 
          memberId_shopId: {
            memberId: dto.memberId,
            shopId: validShopId
          }
        }
      });

      if (!shopMember) {
        throw new NotFoundException('ไม่พบสมาชิกลูกค้าในสาขานี้');
      }

      // คำนวณแต้มใหม่
      const newBalance = shopMember.pointBalance + dto.amount;

      // ป้องกันแต้มติดลบ
      if (newBalance < 0) {
        throw new BadRequestException(`แต้มไม่เพียงพอ (คงเหลือ: ${shopMember.pointBalance})`);
      }

      // 🌟 อัปเดตแต้มกลับไปที่ตาราง CrmMemberShop
      await tx.crmMemberShop.update({
        where: { id: shopMember.id },
        data: { pointBalance: newBalance }
      });

      // บันทึก Log
      const log = await tx.crmPointLog.create({
        data: {
          companyId,
          memberId: dto.memberId,
          amount: dto.amount,
          balanceAfter: newBalance,
          action: dto.amount > 0 ? 'MANUAL_ADD' : 'MANUAL_DEDUCT',
          note: dto.note
        }
      });

      return {
        ...log,
        id: log.id.toString() 
      };
    });
  }

  // 2. ดูประวัติแต้มทั้งหมดของสาขา (Admin ดู)
  async findAll(companyId: number, action?: string) {
    const whereClause: any = { companyId };
    if (action) {
      whereClause.action = action;
    }

    return this.prisma.crmPointLog.findMany({
      where: whereClause,
      include: {
        member: {
          select: { firstName: true, lastName: true, memberCode: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // 3. ดูประวัติแต้มเฉพาะของลูกค้าคนใดคนหนึ่ง (ลูกค้าดูเอง หรือ Admin ดูประวัติรายคน)
  async findByMember(companyId: number, memberId: number) {
    return this.prisma.crmPointLog.findMany({
      where: { companyId, memberId },
      orderBy: { createdAt: 'desc' }
    });
  }
}