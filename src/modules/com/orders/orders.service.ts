import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductsService } from '../../com/products/products.service';
import { RunningNumbersService } from '../../cfg/running-numbers/running-numbers.service'; 
import { CreateOrderDto } from './dto/create-order.dto';
import { Prisma, StockChangeType } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private runningService: RunningNumbersService 
  ) {}

 // =========================================================
  // 🧮 1. ฟังก์ชันตัวช่วย: คำนวณราคาสุทธิ (รองรับ Discount Stacking)
  // =========================================================
  async calculateCheckout(companyId: number, dto: CreateOrderDto) {
    // 1. กำหนดขีดจำกัดจำนวนโค้ดต่อออเดอร์ 
    const MAX_DISCOUNT_CODES = 2; 
    if (dto.discountIds && dto.discountIds.length > MAX_DISCOUNT_CODES) {
      throw new BadRequestException(`สามารถใช้โค้ดส่วนลดได้สูงสุด ${MAX_DISCOUNT_CODES} โค้ดต่อคำสั่งซื้อ`);
    }

    let subTotal = 0;
    const checkoutItems: any[] = []; 
    const stockUpdates: any[] = [];  

    // 2. คำนวณยอดรวมสินค้า
    for (const item of dto.items) {
      const product = await this.prisma.comProduct.findUnique({
        where: { id: item.productId, companyId },
        select: { id: true, name: true, price: true, stockQty: true, parentId: true }
      });

      if (!product) throw new NotFoundException(`ไม่พบสินค้า ID ${item.productId}`);
      
      const itemTotal = Number(product.price) * item.quantity;
      subTotal += itemTotal;

      checkoutItems.push({
        productId: product.id,
        productName: product.name, // 🌟 เพิ่ม productName เข้าไปเพื่อส่งต่อให้ OrderItem
        quantity: item.quantity,
        unitPrice: Number(product.price),
        itemTotal,
        comment: item.comment
      });

      //เตรียมข้อมูลไว้ตัดสต็อก
      stockUpdates.push({
        productId: product.id,
        changeQty: -item.quantity,
        currentStock: Number(product.stockQty),
        warehouseId: (product as any).warehouseId || 1 // Fallback คลังหลัก
      });
    }

    // 3. คำนวณค่าจัดส่งและเช็คสิทธิ์ส่งฟรี 
    let shippingFee = 0;
    let isFreeShipping = false;

    if (dto.shippingRuleId) {
      // 🌟 แก้ไข: เปลี่ยนจาก findUnique เป็น findFirst เพราะมี companyId อยู่ในเงื่อนไขด้วย
      const rule = await this.prisma.comShippingRule.findFirst({
        where: { id: dto.shippingRuleId, companyId }
      });
      if (rule) {
        shippingFee = Number(rule.cost); 
        if (shippingFee === 0) {
          isFreeShipping = true;
        }
      }
    }

    // 4. คำนวณส่วนลดหลายต่อ (Discount Stacking Logic)
    let totalDiscount = 0;
    const appliedDiscounts: any[] = [];

    if (dto.discountIds && dto.discountIds.length > 0) {
      const discounts = await this.prisma.comDiscount.findMany({
        where: { 
          id: { in: dto.discountIds }, 
          companyId,
          isActive: true // 🌟 เอาเงื่อนไข endsAt ออก ป้องกัน Error เนื่องจากใน Schema ไม่มีฟิลด์นี้
        }
      });

      const sortedDiscounts = discounts.sort((a, b) => (a.discountType === 'PERCENTAGE' ? -1 : 1));

      for (const disc of sortedDiscounts) {
        let currentDiscount = 0;
        const currentTotalForCalc = subTotal - totalDiscount;

        if (disc.discountType === 'PERCENTAGE') {
          currentDiscount = currentTotalForCalc * (Number(disc.discountValue) / 100);
        } else {
          currentDiscount = Number(disc.discountValue);
        }

        if (disc.maxDiscountAmount && currentDiscount > Number(disc.maxDiscountAmount)) {
          currentDiscount = Number(disc.maxDiscountAmount);
        }

        totalDiscount += currentDiscount;
        appliedDiscounts.push({
          discountId: disc.id,
          code: disc.code,
          amount: currentDiscount
        });
      }
    }

    // 5. สรุปยอดสุทธิ
    const netTotal = (subTotal + shippingFee) - totalDiscount;

    return {
      subTotal,
      shippingFee,
      isFreeShipping,
      totalDiscount,
      appliedDiscounts, 
      netTotal: netTotal < 0 ? 0 : netTotal, 
      items: checkoutItems,
      stockUpdates 
    };
  }

 // =========================================================
  // 🛒 2. สร้าง Order (ผูกกับ Cart, ตัดสต็อก, หักคูปอง, ผูก DMS)
  // =========================================================
  async create(memberId: number, companyId: number, dto: CreateOrderDto) {
    const member = await this.prisma.crmMember.findFirst({
      where: { id: memberId, companyId }
    });

    if (!member) throw new BadRequestException('ไม่พบข้อมูลลูกค้า');

    // 1. เรียกใช้ฟังก์ชันคำนวณราคา
    const calcResult = await this.calculateCheckout(companyId, dto);

    // 2. เริ่ม Transaction
    return this.prisma.$transaction(async (tx) => {
      let orderNo = new Date().getTime().toString();
      try {
        orderNo = await this.runningService.generateNextNumber(companyId, 'ORDER');
      } catch (e) {
        this.logger.warn('ไม่พบ Running Number Format สำหรับ ORDER ใช้ Time-based แทน');
      }

      // 📦 สร้างใบสั่งซื้อ
      const order = await tx.comOrder.create({
        data: {
          companyId,
          memberId: member.id,
          shopId: dto.shopId,
          orderNo,
          status: 'PENDING',        
          paymentStatus: 'UNPAID',
          paymentType: dto.paymentType || 'FULL', 
          totalAmount: calcResult.netTotal,       
          shippingCost: calcResult.shippingFee,   
          shippingRuleId: dto.shippingRuleId,
          shippingAddress: dto.shippingAddress,
          discountId: dto.discountIds && dto.discountIds.length > 0 ? dto.discountIds[0] : null,
          discountAmount: calcResult.totalDiscount, 
          
          items: { 
            create: calcResult.items.map(i => ({
              companyId: companyId,
              productId: i.productId,
              productName: i.productName,
              price: i.unitPrice,
              qty: i.quantity,
              total: i.itemTotal,
              comment: i.comment,
              itemStatus: 'WAITING_PO'
            }))
          }
        },
        include: { items: true }
      });

      // ✂️ ตัดสต็อก & บันทึก Log
      for (const update of calcResult.stockUpdates) {
        const newBalance = update.currentStock + update.changeQty;
        
        await tx.comProduct.update({
          where: { id: update.productId, companyId }, 
          data: { stockQty: newBalance }
        });

        await tx.comStockLog.create({
          data: {
            companyId,
            productId: update.productId,
            changeQty: update.changeQty,
            balanceAfter: newBalance,
            warehouseId: update.warehouseId,
            type: 'SALE', 
            refOrderId: order.id,
            note: `ขายสินค้า Order ${orderNo}`,
            createdBy: memberId 
          }
        });
      }

      // 🎫 อัปเดตยอดการใช้คูปอง
      if (dto.discountIds && dto.discountIds.length > 0) {
        for (const dId of dto.discountIds) {
          await tx.comDiscount.update({
            where: { id: dId, companyId },
            data: { usedCount: { increment: 1 } }
          });
        }
      }

      // 🧹 ลบสินค้าออกจากตะกร้า
      const productIdsInOrder = calcResult.items.map(item => item.productId);
      await tx.comCart.deleteMany({
        where: {
          memberId: member.id,
          companyId: companyId,
          productId: { in: productIdsInOrder }
        }
      });

      // =========================================================
      // 📂 [NEW] บันทึกไฟล์เอกสารการจัดส่ง ลงตาราง DMS (EcomShippingDocument)
      // =========================================================
      if (dto.shippingDocs && dto.shippingDocs.length > 0) {
        for (const doc of dto.shippingDocs) {
          await tx.ecomShippingDocument.create({
            data: {
              companyId,
              orderId: order.id,
              mediaId: doc.mediaId,
              docType: doc.docType
            }
          });
        }
      }

      // =========================================================
      // 🎁 คำนวณและแจกแต้มสะสมเข้าสมาชิกร้าน (CrmMemberShop)
      // =========================================================
      const crmConfig = await tx.crmCompanyConfig.findUnique({ where: { companyId } });
      if (crmConfig?.isPointEnabled) {
        const earnedPoints = Math.floor(calcResult.netTotal / (crmConfig.earnRatio || 100));
        
        if (earnedPoints > 0) {
          // 🌟 1. ค้นหาข้อมูลสมาชิกร้านค้า (ถ้าไม่มีให้สร้างแบบ Silent Link)
          let shopMember = await tx.crmMemberShop.findUnique({
            where: {
              memberId_shopId: {
                memberId: member.id,
                shopId: dto.shopId
              }
            }
          });

          if (!shopMember) {
            shopMember = await tx.crmMemberShop.create({
              data: {
                companyId,
                memberId: member.id,
                shopId: dto.shopId,
                pointBalance: 0
              }
            });
          }

          const newBalance = shopMember.pointBalance + earnedPoints;

          // 🌟 2. บันทึก Point Log (ใช้ค่าจาก shopMember)
          await tx.crmPointLog.create({
            data: {
              companyId,
              memberId: member.id,
              amount: earnedPoints,
              balanceAfter: newBalance,
              action: 'EARN_FROM_ORDER',
              refOrderId: order.id,
              note: `ได้รับแต้มจากคำสั่งซื้อ ${orderNo}`
            }
          });
          
          // 🌟 3. อัปเดตแต้มที่ตาราง CrmMemberShop แทน CrmMember
          await tx.crmMemberShop.update({
            where: { id: shopMember.id },
            data: { pointBalance: { increment: earnedPoints } }
          });
        }
      }

      // ส่งกลับข้อมูล order (หากต้องการให้ดึงข้อมูลสื่อ DMS กลับไปด้วย สามารถใช้ findUnique ตรงนี้แทนการ return order ดื้อๆ ได้ครับ)
      return tx.comOrder.findUnique({
        where: { id: order.id },
        include: {
          items: true,
          shippingDocs: { include: { media: true } } // 📂 เพิ่มการ Include DMS คืนไปให้หน้าบ้าน
        }
      });
    });
  }

  // =========================================================
  // 🔍 3. ดูรายละเอียด Order
  // =========================================================
  async findOne(id: number, companyId: number) {
    const order = await this.prisma.comOrder.findFirst({
      where: { id, companyId },
      include: { 
        items: { include: { returnedItems: true, product: true } }, 
        shop: true, 
        member: true,
        productReview: true, 
        returnRequests: { include: { items: true } },
        discount: true 
      }
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // =========================================================
  // 📊 4. Dashboard
  // =========================================================
  async getDashboardStats(companyId: number) {
    const stats = await this.prisma.comOrder.groupBy({
      by: ['status', 'paymentStatus'],
      where: { companyId },
      _count: { id: true },
      _sum: { totalAmount: true }
    });
    return stats;
  }

  // =========================================================
  // 🚫 5. ยกเลิก Order 
  // =========================================================
  async cancelOrder(orderId: number, userId: number, companyId: number, isAdmin: boolean) {
    const order = await this.findOne(orderId, companyId);
    
    const nonCancellableStatus = ['SHIPPED_FROM_SUP', 'ARRIVED_TH', 'COMPLETED'];
    if (!isAdmin && nonCancellableStatus.includes(order.status)) {
      throw new BadRequestException('ห้ามยกเลิกเนื่องจากสินค้าอยู่ระหว่างจัดส่ง');
    }

    return this.prisma.comOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' }
    });
  }

  async updateStatus(orderId: number, status: string, adminId: number, companyId: number, note?: string) {
    await this.findOne(orderId, companyId); 
    return this.prisma.comOrder.update({
      where: { id: orderId },
      data: { status }
    });
  }

  async reOrder(oldOrderId: number, userId: number, companyId: number) {
    const oldOrder = await this.findOne(oldOrderId, companyId);
    
    const createDto = new CreateOrderDto();
    createDto.shopId = oldOrder.shopId;
    createDto.shippingAddress = oldOrder.shippingAddress || undefined;
    createDto.paymentType = oldOrder.paymentType; 
    
    createDto.items = oldOrder.items.map(i => ({
      productId: i.productId,
      quantity: i.qty,
      comment: i.comment || undefined
    }));

    return this.create(oldOrder.memberId, companyId, createDto);
  }
}