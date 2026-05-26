import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateReturnItemDto } from './dto/update-return-item.dto';

@Injectable()
export class ReturnItemsService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 📝 1. บันทึกผลตรวจสภาพ (Inspection)
  // =========================================================
  async update(itemId: number, companyId: number, dto: UpdateReturnItemDto) {
    const item = await this.prisma.comReturnItem.findFirst({
      where: { id: itemId, returnRequest: { companyId } },
      include: { returnRequest: true }
    });

    if (!item) throw new NotFoundException('ไม่พบรายการคืนสินค้า');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.comReturnItem.update({
        where: { id: itemId },
        data: {
          condition: dto.condition,
          qty: dto.qty,
          targetProductId: dto.targetProductId
        }
      });

      // 📦 ถ้าสถานะเป็น RECEIVED (หรือตาม Logic ที่คุณต้องการ) ให้คืนสต็อก
      // สมมติว่ามีการส่ง Status มาใน DTO หรือเช็คจากหัวใบเคลม
      // if (item.returnRequest.status === 'RECEIVED') {
      //   await tx.comProduct.update({
      //     where: { id: item.orderItem.productId },
      //     data: { stockQty: { increment: updated.qty } }
      //   });
      //   // อย่าลืมบันทึก ComStockLog ประเภท RETURN_IN ด้วยนะครับ
      // }

      return updated;
    });
  }

  // =========================================================
  // ❌ 2. ลบรายการ (กรณีลูกค้าแจ้งเกิน หรือไม่ได้ส่งมาจริง)
  // =========================================================
  async remove(itemId: number, companyId: number) {
    const item = await this.prisma.comReturnItem.findFirst({
      where: { 
        id: itemId, 
        returnRequest: { companyId } 
      }
    });

    if (!item) throw new NotFoundException('Return Item not found');

    return this.prisma.comReturnItem.delete({
      where: { id: itemId }
    });
  }
}