import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { RunningNumbersService } from '../../cfg/running-numbers/running-numbers.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private runningService: RunningNumbersService
  ) {}

  // =========================================================
  // 🛒 1. เปิดใบสั่งซื้อสินค้า (Create PO) + ผูก DMS + ผูก Workflow + 🛡️ Defensive Code
  // =========================================================
  async create(companyId: number, userId: number, dto: CreatePurchaseOrderDto) {
    // 1. ตรวจสอบข้อมูลซัพพลายเออร์
    const supplier = await this.prisma.proSupplier.findFirst({
      where: { id: dto.supplierId, companyId }
    });
    if (!supplier) throw new NotFoundException('ไม่พบข้อมูลซัพพลายเออร์ในระบบของคุณ');

    // 1.5 ดึงข้อมูลสินค้าทั้งหมดที่สั่งซื้อ เพื่อเอาชื่อ (productName) มาบันทึกกัน Error Prisma
    const productIds = dto.items.map(item => item.productId);
    const products = await this.prisma.comProduct.findMany({
      where: { id: { in: productIds }, companyId }
    });
    
    // สร้าง Map เพื่อให้ดึงชื่อสินค้ามาใช้ง่ายและไวขึ้น
    const productMap = new Map(products.map(p => [p.id, p]));

    // 2. คำนวณยอดเงิน (ราคารวม, ภาษีมูลค่าเพิ่ม 7%, ยอดสุทธิ)
    const totalAmount = dto.items.reduce((sum, item) => sum + (item.qty * item.unitCost), 0);
    const vatAmount = totalAmount * 0.07; 
    const netAmount = totalAmount + vatAmount;

    // 3. เจนเลขที่เอกสาร PO อ้างอิงตามรูปแบบบริษัท
    const docNo = await this.runningService.generateNextNumber(companyId, 'PO');

    return this.prisma.$transaction(async (tx) => {
      
      // 🌟 [Defensive Code] กรองเอกสารที่มีอยู่จริงใน SysMedia ก่อนบันทึก
      let validDocuments: typeof dto.documents = [];
      if (dto.documents && dto.documents.length > 0) {
        const mediaIds = dto.documents.map(d => d.mediaId);
        const existingMedias = await tx.sysMedia.findMany({
          where: { id: { in: mediaIds } },
          select: { id: true }
        });
        
        const validMediaIds = new Set(existingMedias.map(m => m.id));
        validDocuments = dto.documents.filter(doc => validMediaIds.has(doc.mediaId));

        if (validDocuments.length !== dto.documents.length) {
          console.warn(`⚠️ [Create PO] พบไฟล์เอกสารแนบบางรายการสูญหาย ข้ามการผูกไฟล์ที่ไม่มีอยู่จริง`);
        }
      }

      // 4. สร้างใบสั่งซื้อหลัก พร้อมผูกเอกสาร DMS ที่ผ่านการกรองแล้ว และรายการสินค้า
      const po = await tx.proPurchaseOrder.create({
        data: {
          companyId,
          supplierId: dto.supplierId,
          docNo,
          docDate: dto.docDate ? new Date(dto.docDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          note: dto.note,
          totalAmount,
          vatAmount,
          netAmount,
          status: 'PENDING', // รออนุมัติ
          
          items: {
            create: dto.items.map(item => {
              const product = productMap.get(item.productId);
              if (!product) throw new BadRequestException(`ไม่พบรหัสสินค้า ID ${item.productId} ในระบบ`);

              return {
                companyId,
                productId: item.productId,
                productName: product.name, 
                qty: item.qty,
                unitCost: item.unitCost,
                totalCost: item.qty * item.unitCost, 
                
                ...(item.comOrderItemIds && item.comOrderItemIds.length > 0 && {
                  customerOrderItems: {
                    connect: item.comOrderItemIds.map(id => ({ id }))
                  }
                })
              };
            })
          },

          // 📂 ผูกไฟล์เอกสาร (DMS) เฉพาะตัวที่มีอยู่จริง
          ...(validDocuments.length > 0 && {
            documents: {
              create: validDocuments.map(doc => ({
                companyId,
                mediaId: doc.mediaId,
                docType: doc.docType
              }))
            }
          })
        }
      });

      // 🌟 5. [WORKFLOW INTEGRATION] ค้นหาสายอนุมัติใบสั่งซื้อ
      const moduleMapping = await tx.wfModuleMapping.findFirst({
        where: { 
          companyId, 
          moduleCode: 'PRO_PO',
          isActive: true 
        },
      });

      let wfRequestId: number | null = null;

      if (moduleMapping) {
        // 🛡️ ป้องกันงูกินหางระดับข้อมูล
        const existingWf = await tx.wfRequest.findFirst({
          where: { businessId: po.docNo, businessType: 'PURCHASE_ORDER', companyId }
        });

        if (!existingWf) {
          const wfRequest = await tx.wfRequest.create({
            data: {
              companyId,
              workflowId: moduleMapping.workflowId, 
              requesterId: userId,
              businessId: po.docNo,
              businessType: 'PURCHASE_ORDER', 
              topic: `ขออนุมัติใบสั่งซื้อ ${po.docNo} - ยอดรวม ${netAmount.toFixed(2)} บาท`,
              status: 'PENDING', 
            }
          });
          wfRequestId = wfRequest.id;

          await tx.proPurchaseOrder.update({
            where: { id: po.id },
            data: { wfRequestId }
          });
        }
      } else {
        // ถ้าไม่มีการตั้งสายอนุมัติ ให้สถานะ APPROVED ได้เลย
        await tx.proPurchaseOrder.update({
          where: { id: po.id },
          data: { status: 'APPROVED' }
        });
      }

      // 6. ดึงข้อมูลฉบับสมบูรณ์คืนหน้าบ้าน
      return tx.proPurchaseOrder.findUnique({
        where: { id: po.id },
        include: {
          supplier: true,
          items: { include: { product: true } },
          documents: { include: { media: true } },
          wfRequest: { include: { currentNode: true } }
        }
      });
    });
  }

  // =========================================================
  // 📋 2. ดึงข้อมูลใบสั่งซื้อทั้งหมดภายในบริษัท
  // =========================================================
  async findAll(companyId: number) {
    return this.prisma.proPurchaseOrder.findMany({
      where: { companyId },
      include: {
        // 🚩 [FIXED] เปลี่ยนจาก supplierName เป็น name ตามใน schema
        supplier: { select: { name: true, contactName: true } },
        wfRequest: { include: { currentNode: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // =========================================================
  // 🔍 3. เรียกดูรายละเอียดใบสั่งซื้อเดี่ยว
  // =========================================================
  async findOne(id: number, companyId: number) {
    const po = await this.prisma.proPurchaseOrder.findFirst({
      where: { id, companyId },
      include: {
        supplier: true,
        items: { include: { product: true, customerOrderItems: true } },
        documents: { include: { media: true } },
        wfRequest: { include: { currentNode: true } }
      }
    });
    if (!po) throw new NotFoundException('ไม่พบใบสั่งซื้อสินค้านี้');
    return po;
  }

  // =========================================================
  // 🚚 4. กดรับสินค้าเข้าคลังสำเร็จ (Receive All Items)
  // =========================================================
  async receiveItems(poId: number, companyId: number) {
    const po = await this.prisma.proPurchaseOrder.findFirst({
      where: { id: poId, companyId },
      include: { items: { include: { customerOrderItems: true } } }
    });
    
    if (!po) throw new NotFoundException('ไม่พบเอกสารใบสั่งซื้อสินค้าฉบับนี้');
    
    if (po.status === 'PENDING' || po.status === 'REJECTED') {
      throw new BadRequestException('ไม่สามารถรับสินค้าได้เนื่องจากใบสั่งซื้อยังไม่ได้รับการอนุมัติ');
    }

    await this.prisma.$transaction(async (tx) => {
      // อัปเดตสถานะหัวเอกสารหลักเป็นได้รับของแล้ว
      await tx.proPurchaseOrder.update({
        where: { id: poId },
        data: { status: 'RECEIVED' }
      });

      // อัปเดตจำนวนรับสินค้าจริงบนรายการย่อยและเปลี่ยนสถานะสินค้าของลูกค้าปลายทาง
      for (const item of po.items) {
        await tx.proPurchaseItem.update({
          where: { id: item.id },
          data: { qtyReceived: item.qty }
        });

        // หากเป็นสินค้าที่สั่งตามออเดอร์ลูกค้า ให้ปรับสถานะออเดอร์ลูกค้ารายการนั้นเป็น 'สินค้าถึงไทยแล้ว'
        if (item.customerOrderItems.length > 0) {
          const customerItemIds = item.customerOrderItems.map(c => c.id);
          await tx.comOrderItem.updateMany({
            where: { id: { in: customerItemIds } },
            // 🚩 [FIXED] เปลี่ยนจาก status เป็น itemStatus ตามใน schema 
            data: { itemStatus: 'ARRIVED_AT_WAREHOUSE' } 
          });
        }
      }
    });
    
    return { success: true, message: 'รับสินค้าเข้าคลังสำเร็จ' };
  }
}