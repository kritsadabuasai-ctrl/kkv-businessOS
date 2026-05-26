import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRedemptionDto } from './dto/create-redemption.dto';

@Injectable()
export class RedemptionsService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 🎁 1. ลูกค้ากดแลกของรางวัล (หักแต้มสาขา + ตัดสต็อก + ผูก Workflow อนุมัติ)
  // =========================================================
  async create(dto: CreateRedemptionDto, userId?: number) {
    // 🌟 1. ดักจับ Error เบื้องต้นก่อน
    if (!dto.shopId) {
      throw new BadRequestException('กรุณาระบุรหัสสาขา (shopId) ที่ต้องการแลกของรางวัล');
    }

    const validShopId: number = dto.shopId;

    return this.prisma.$transaction(async (tx) => {
      // 2. เช็คว่ามีของรางวัลไหม และสต็อกพอไหม
      const reward = await tx.crmReward.findUnique({ where: { id: dto.rewardId } });
      if (!reward) throw new NotFoundException('ไม่พบของรางวัล');
      if (reward.stockQty !== null && reward.stockQty <= 0) {
        throw new BadRequestException('ของรางวัลหมดแล้ว');
      }

      // 3. เช็คแต้มลูกค้าจากสมาชิกร้าน (สอดคล้องตามระบบแยกแต้มรายสาขา)
      const shopMember = await tx.crmMemberShop.findUnique({
        where: {
          memberId_shopId: { 
            memberId: dto.memberId, 
            shopId: validShopId 
          }
        }
      });

      if (!shopMember) {
        throw new NotFoundException('ไม่พบข้อมูลสมาชิกร้านค้านี้');
      }

      if (shopMember.pointBalance < reward.pointCost) {
        throw new BadRequestException('คะแนนสะสมของสาขานี้ไม่เพียงพอ');
      }

      // คำนวณแต้มคงเหลือเพื่อเอาไปบันทึกลง Log
      const newBalance = shopMember.pointBalance - reward.pointCost;

      // 4. หักแต้มลูกค้าที่ตาราง CrmMemberShop
      await tx.crmMemberShop.update({
        where: { id: shopMember.id },
        data: { pointBalance: newBalance },
      });

      // 5. บันทึกประวัติ Point Log แบบติดลบ
      await tx.crmPointLog.create({
        data: {
          companyId: dto.companyId,
          memberId: dto.memberId,
          amount: -reward.pointCost,     // ยอดแต้มที่ใช้ไป (ติดลบ)
          balanceAfter: newBalance,      // แต้มคงเหลือล่าสุด
          action: 'REDEEM_REWARD',       
          note: `แลกของรางวัล: ${reward.name}`, 
        },
      });

      // 6. ตัดสต็อกของรางวัล (ถ้ามีการจำกัดสิทธิ์)
      if (reward.stockQty !== null) {
        await tx.crmReward.update({
          where: { id: reward.id },
          data: { stockQty: { decrement: 1 } },
        });
      }

      // เจนรหัสตั๋วการแลกของรางวัลล่วงหน้า
      const generatedCode = `RD-${Date.now()}`;

      // 🌟 7. [WORKFLOW INTEGRATION] ค้นหาสายอนุมัติที่ผูกไว้กับโมดูลแลกของรางวัล
      const moduleMapping = await tx.wfModuleMapping.findFirst({
        where: { 
          companyId: dto.companyId, 
          moduleCode: 'CRM_REDEEM', // รหัสโมดูลสำหรับการอนุมัติแลกของรางวัล
          isActive: true 
        },
      });

      let wfRequestId: number | null = null;

      if (moduleMapping) {
        // 🛡️ ด่านตรวจล็อกล็อกซ้ำ (ป้องกันงูกินหางระดับข้อมูล): เช็กก่อนสร้างคำร้อง
        const existingWf = await tx.wfRequest.findFirst({
          where: { businessId: generatedCode, businessType: 'CRM_REDEMPTION', companyId: dto.companyId }
        });

        if (!existingWf) {
          // สร้างคำร้องขออนุมัติขึ้นตารางกลาง (ใช้ tx ตรงๆ ป้องกันการวน Import Module)
          const wfRequest = await tx.wfRequest.create({
            data: {
              companyId: dto.companyId,
              workflowId: moduleMapping.workflowId, 
              requesterId: userId || dto.memberId, // ไอดีผู้กดส่งคำร้อง (ถ้าไม่มีใช้ memberId แทน)
              businessId: generatedCode,
              businessType: 'CRM_REDEMPTION', 
              topic: `คำขอแลกของรางวัล ${generatedCode} - ${reward.name} (ใช้ ${reward.pointCost} แต้ม)`,
              status: 'PENDING', 
            }
          });
          wfRequestId = wfRequest.id;
        }
      }

      // 🌟 8. สร้างบันทึกประวัติการแลกรางวัล (พร้อมผูกคีย์ Workflow ถ้ามี)
      return tx.crmRedemption.create({
        data: {
          companyId: dto.companyId,
          shopId: validShopId,
          memberId: dto.memberId,
          rewardId: dto.rewardId,
          pointUsed: reward.pointCost, 
          redeemCode: generatedCode,   
          // หากระบบมีสายงานอนุมัติ ให้ตั้งเป็น PENDING ไว้ก่อนเพื่อรอการตรวจทาน หากไม่มีให้ COMPLETED ทันที
          status: moduleMapping ? 'PENDING' : 'COMPLETED',
          wfRequestId: wfRequestId // บันทึกไอดีอ้างอิง Workflow Request
        },
        include: {
          reward: { include: { media: true } }, 
          member: true,
          shop: true,
          wfRequest: true // ดึงสถานะสายงานกลับไปให้หน้าบ้านเช็กได้ทันที
        }
      });
    });
  }

  // =========================================================
  // 🔍 2. เรียกดูประวัติการแลกรางวัลทั้งหมด (Filter ตามสาขาได้)
  // =========================================================
  async findAll(companyId: number, shopId?: number) {
    const whereClause: any = { companyId };
    
    if (shopId) {
      whereClause.shopId = shopId;
    }

    return this.prisma.crmRedemption.findMany({
      where: whereClause,
      include: {
        member: {
          select: { memberCode: true, firstName: true, lastName: true, phone: true },
        },
        reward: {
          select: { name: true, type: true, media: true },
        },
        shop: { select: { shopName: true } },
        wfRequest: { include: { currentNode: true } } // แนบโหนดที่ติดค้างอยู่ไปโชว์ในตารางแอดมิน
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // =========================================================
  // 🔍 3. ดูรายละเอียดการแลกรางวัลรายการเดี่ยว
  // =========================================================
  async findOne(id: number) {
    const redemption = await this.prisma.crmRedemption.findUnique({
      where: { id },
      include: {
        member: true,
        reward: { include: { media: true } }, 
        shop: true,
        wfRequest: { include: { currentNode: true } }
      },
    });
    if (!redemption) throw new NotFoundException('ไม่พบข้อมูลการแลกรางวัล');
    return redemption;
  }

  // =========================================================
  // 📝 4. แอดมิน/ระบบ อัปเดตสถานะการแลกของรางวัล
  // =========================================================
  async updateStatus(id: number, status: string) {
    await this.findOne(id);
    return this.prisma.crmRedemption.update({
      where: { id },
      data: { status },
    });
  }

  // =========================================================
  // ❌ 5. ลบประวัติการแลกรางวัล
  // =========================================================
  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.crmRedemption.delete({
      where: { id },
    });
  }
}