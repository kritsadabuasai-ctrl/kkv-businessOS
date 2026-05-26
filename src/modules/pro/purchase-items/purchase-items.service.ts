import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReceivePurchaseItemDto, UpdatePurchaseItemDto } from './dto/update-purchase-item.dto';

@Injectable()
export class PurchaseItemsService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 🚚 1. รับของรายชิ้น (Partial Receive)
  // =========================================================
  async receive(itemId: number, companyId: number, dto: ReceivePurchaseItemDto) {
    // 1. หา Item นี้
    const item = await this.prisma.proPurchaseItem.findFirst({
      where: { id: itemId, purchaseOrder: { companyId } },
      include: { 
        purchaseOrder: true,
        customerOrderItems: true // ดึงรายการลูกค้าที่จองไว้มาด้วย
      }
    });

    if (!item) throw new NotFoundException('Purchase Item not found');

    // 2. คำนวณยอดรับรวม
    const newTotalReceived = item.qtyReceived + dto.qtyReceived;

    // (Optional) เช็คว่าเกินจำนวนที่สั่งไหม?
    // if (newTotalReceived > item.qty) throw new BadRequestException('Cannot receive more than ordered qty');

    // 3. อัปเดตข้อมูล
    await this.prisma.$transaction(async (tx) => {
      // 3.1 อัปเดตยอดรับใน PO Item
      await tx.proPurchaseItem.update({
        where: { id: itemId },
        data: { qtyReceived: newTotalReceived }
      });

      // 3.2 เช็คว่า "ครบ" หรือยัง?
      // ถ้าครบแล้ว -> ไปอัปเดตสถานะสินค้าของลูกค้า (ComOrderItem) เป็น ARRIVED_TH
      // (ถ้ายังไม่ครบ อาจจะปล่อยสถานะลูกค้าเป็น PO_CREATED ไปก่อน หรือจะมีสถานะ PARTIAL_ARRIVED ก็ได้)
      if (newTotalReceived >= item.qty) {
        
        if (item.customerOrderItems.length > 0) {
          const customerItemIds = item.customerOrderItems.map(c => c.id);
          
          await tx.comOrderItem.updateMany({
            where: { id: { in: customerItemIds } },
            data: { itemStatus: 'ARRIVED_TH' } // ของถึงไทยแล้ว
          });
        }
      }

      // 3.3 (แถม) เช็ค PO Parent ว่ารับของครบทุกชิ้นหรือยัง?
      // ถ้าครบทุกชิ้นใน PO แล้ว ให้ปิดจ็อบ PO เป็น RECEIVED
      const allItems = await tx.proPurchaseItem.findMany({
        where: { purchaseOrderId: item.purchaseOrderId }
      });

      // ถ้าทุกชิ้น qtyReceived >= qty
      const isAllReceived = allItems.every(i => {
         // ต้องใช้ Logic รวมยอดที่เพิ่งอัปเดตไปด้วย (ซึ่งอยู่ใน DB แล้วเพราะอยู่ใน tx เดียวกันแต่ต้องระวัง)
         // เพื่อความชัวร์ ใช้ค่าที่เพิ่งคำนวณสำหรับ Item ปัจจุบัน
         if (i.id === itemId) return newTotalReceived >= i.qty;
         return i.qtyReceived >= i.qty;
      });

      if (isAllReceived) {
        await tx.proPurchaseOrder.update({
          where: { id: item.purchaseOrderId },
          data: { status: 'RECEIVED' }
        });
      } else {
         // ถ้ายังไม่ครบ แต่เริ่มรับแล้ว อาจเปลี่ยนสถานะ PO เป็น PARTIAL_RECEIVED (ถ้ามี Enum)
         await tx.proPurchaseOrder.update({
            where: { id: item.purchaseOrderId },
            data: { status: 'PARTIAL_RECEIVED' } // (ต้องแน่ใจว่า String นี้รับได้ หรือใช้ RECEIVED ไปก่อน)
         });
      }
    });

    return { message: 'Received successfully', currentReceived: newTotalReceived };
  }

  // =========================================================
  // 📝 2. แก้ไขข้อมูล (ราคา/จำนวน)
  // =========================================================
  async update(itemId: number, companyId: number, dto: UpdatePurchaseItemDto) {
    const item = await this.prisma.proPurchaseItem.findFirst({
        where: { id: itemId, purchaseOrder: { companyId } }
    });
    if (!item) throw new NotFoundException('Item not found');

    // คำนวณ Total Cost ใหม่ถ้ามีการเปลี่ยนราคา/จำนวน
    const newQty = dto.qty ?? item.qty;
    const newCost = dto.unitCost ?? Number(item.unitCost);
    const newTotal = newQty * newCost;

    return this.prisma.proPurchaseItem.update({
      where: { id: itemId },
      data: {
        qty: newQty,
        unitCost: newCost,
        totalCost: newTotal
      }
    });
  }

  // =========================================================
  // ❌ 3. ลบ/ยกเลิก รายการนี้ (Supplier ไม่มีของ)
  // =========================================================
  async remove(itemId: number, companyId: number) {
    const item = await this.prisma.proPurchaseItem.findFirst({
        where: { id: itemId, purchaseOrder: { companyId } },
        include: { customerOrderItems: true }
    });
    if (!item) throw new NotFoundException('Item not found');

    await this.prisma.$transaction(async (tx) => {
        // 3.1 ถ้ามีลูกค้าจองไว้ -> ปลดลูกค้าออก ให้กลับไปสถานะ WAITING_PO
        // เพื่อให้ Admin ไปกดสั่งกับ Supplier เจ้าอื่นใหม่
        if (item.customerOrderItems.length > 0) {
            const customerItemIds = item.customerOrderItems.map(c => c.id);
            await tx.comOrderItem.updateMany({
                where: { id: { in: customerItemIds } },
                data: { 
                    purchaseItemId: null, // ปลด Link
                    itemStatus: 'WAITING_PO' // กลับไปรอสั่งใหม่
                }
            });
        }

        // 3.2 ลบรายการออกจาก PO
        await tx.proPurchaseItem.delete({
            where: { id: itemId }
        });

        // (Optional) อาจต้องคำนวณยอดเงินรวมของ PO Header ใหม่ด้วย
        // ... (Logic recalculate PO total)
    });

    return { message: 'Item removed and customer orders reverted to WAITING_PO' };
  }
}