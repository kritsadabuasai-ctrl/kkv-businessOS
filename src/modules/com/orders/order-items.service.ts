import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OrderItemsService {
  constructor(private prisma: PrismaService) {}

  async findWaitingForPo(companyId: number) {
    return this.prisma.comOrderItem.findMany({
      where: {
        itemStatus: 'WAITING_PO',
        order: { 
            companyId: companyId,
            status: { not: 'CANCELLED' },
            paymentStatus: { in: ['DEPOSIT_PAID', 'FULLY_PAID'] }
        }
      },
      include: {
        product: { select: { sku: true, name: true, defaultSupplier: true } },
        order: { select: { orderNo: true, createdAt: true } },
        returnedItems: true 
      },
      orderBy: { order: { createdAt: 'asc' } }
    });
  }

  async updateItemStatus(itemId: number, status: string, companyId: number) {
    const item = await this.prisma.comOrderItem.findFirst({
        where: { id: itemId, order: { companyId } }
    });
    if (!item) throw new NotFoundException('ไม่พบรายการสินค้า');

    return this.prisma.comOrderItem.update({
      where: { id: itemId },
      data: { itemStatus: status }
    });
  }

  async cancelItem(itemId: number, companyId: number, note: string) {
    const item = await this.prisma.comOrderItem.findFirst({
      where: { id: itemId, order: { companyId } }
    });
    if (!item) throw new NotFoundException('ไม่พบรายการสินค้าที่ต้องการยกเลิก');

    return this.prisma.comOrderItem.update({
      where: { id: itemId },
      data: { 
        itemStatus: 'CANCELLED',
        // บันทึก note เข้าไปที่ช่อง comment (หรือถ้ามีช่อง cancelReason ให้เปลี่ยนเป็นช่องนั้น)
        comment: note ? `[CANCELLED]: ${note}` : item.comment
      }
    });
  }
}