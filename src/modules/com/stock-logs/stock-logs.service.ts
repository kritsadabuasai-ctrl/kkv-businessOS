import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; 
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { StockChangeType } from '@prisma/client';

@Injectable()
export class StockLogsService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 🖐 1. Manual Adjustment (แอดมินปรับปรุงยอดเอง)
  // =========================================================
  // *ข้อควรระวัง: ต้องแน่ใจว่า CreateStockAdjustmentDto มีฟิลด์ warehouseId แล้ว
  async createAdjustment(companyId: number, userId: number, dto: CreateStockAdjustmentDto & { warehouseId: number }) {
    return this.changeStock(
      companyId,
      dto.productId,
      dto.warehouseId, // เพิ่ม warehouseId เข้ามา
      dto.changeQty,
      dto.type as StockChangeType,
      { note: dto.note, createdBy: userId }
    );
  }

  // =========================================================
  // ⚙️ 2. Core Function: เปลี่ยนแปลงสต็อก (เรียกจาก Module อื่น)
  // =========================================================
  async changeStock(
    companyId: number,
    productId: number,
    warehouseId: number, // 🌟 บังคับรับ warehouseId
    changeQty: number,
    type: StockChangeType,
    meta: {
      refOrderId?: number;
      refPurchaseItemId?: number;
      refReturnId?: number;
      note?: string;
      createdBy?: number;
    } = {}
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. ตรวจสอบสินค้าภายใต้บริษัท 
      const product = await tx.comProduct.findFirst({
        where: { id: productId, companyId }
      });

      if (!product) throw new NotFoundException(`Product ID ${productId} not found in this company`);

      // 2. คำนวณยอดใหม่ (อิงจาก Product Master)
      const newBalance = product.stockQty + changeQty;

      // 🌟 เพิ่มตัวดักจับป้องกันสต็อกติดลบ (Negative Stock Guard)
      if (newBalance < 0) {
        throw new BadRequestException(`Insufficient stock. Current stock is ${product.stockQty}, cannot reduce by ${Math.abs(changeQty)}`);
      }

      // 3. อัปเดตยอดคงเหลือใน Product Master
      await tx.comProduct.update({
        where: { id: productId },
        data: { stockQty: newBalance }
      });

      // 4. บันทึก Log ประวัติ 
      const log = await tx.comStockLog.create({
        data: {
          companyId,
          productId,
          warehouseId, // 🌟 ส่งค่า warehouseId ให้ Prisma
          changeQty,
          balanceAfter: newBalance,
          type,
          refOrderId: meta.refOrderId,
          refPurchaseItemId: meta.refPurchaseItemId,
          refReturnId: meta.refReturnId,
          note: meta.note,
          createdBy: meta.createdBy
        }
      });

      return {
        ...log,
        id: log.id.toString() 
      };
    });
  }

  // =========================================================
  // 📜 3. ดูประวัติการเคลื่อนไหว (Stock Card)
  // =========================================================
  async findAll(companyId: number, productId?: number, warehouseId?: number) {
    const where: any = { companyId };
    if (productId) where.productId = productId;
    if (warehouseId) where.warehouseId = warehouseId; // 🌟 เพิ่มเงื่อนไขค้นหาตามคลัง

    const logs = await this.prisma.comStockLog.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    return logs.map(log => ({
        ...log,
        id: log.id.toString() 
    }));
  }
}