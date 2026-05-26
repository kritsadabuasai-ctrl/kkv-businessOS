import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCartDto, UpdateCartDto,MergeCartDto } from './dto/create-cart.dto'; // ปรับชื่อไฟล์ให้ตรงกับที่คุณตั้ง

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  // 🧠 ฟังก์ชันคำนวณราคาอัจฉริยะ (แยกตามร้าน, จำนวน และเวลาที่ตั้งไว้)
  private async calculateActivePrice(
    companyId: number, 
    productId: number, 
    quantity: number, 
    levelCode: string = 'NORMAL'
  ): Promise<number> {
    // 1. เช็คตาราง ShopProduct ก่อน (ราคาขายปลีกสาขา)
    const shopProduct = await this.prisma.comShopProduct.findFirst({
      where: { companyId, productId }
    });

    if (shopProduct && shopProduct.priceOverride) {
      return Number(shopProduct.priceOverride);
    }

    // 2. ดึงข้อมูลสินค้าหลักพร้อมชุดราคา (Tier Price)
    const product = await this.prisma.comProduct.findUnique({
      where: { id: productId },
      include: {
        tierPrices: {
          where: {
            isActive: true,
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }]
          },
          include: {
            tiers: { orderBy: { minQty: 'desc' } }
          }
        }
      }
    });

    if (!product) throw new NotFoundException('ไม่พบสินค้านี้ในระบบ');

    // 3. คำนวณราคาส่งตามระดับสมาชิก (ถ้ามี)
    if (product.tierPrices && product.tierPrices.length > 0) {
      const activePriceSet = product.tierPrices[0];
      const matchedTier = activePriceSet.tiers.find(tier => quantity >= tier.minQty);
      if (matchedTier) {
        return Number(matchedTier.unitPrice);
      }
    }

    return Number(product.price);
  }

  // 🛒 เพิ่มสินค้าลงตะกร้า (พร้อมเช็คสิทธิ์การมองเห็น)
  // =========================================================
  // 🛒 เพิ่มสินค้าลงตะกร้า (รองรับ Multi-shop และ Tier Price)
  // =========================================================
 async addToCart(memberId: number, dto: CreateCartDto) {
    // 🛡️ ด่านที่ 1: ตรวจสอบระดับสมาชิกของร้านนี้
    const shopMember = await this.prisma.crmMemberShop.findUnique({
      where: {
        memberId_shopId: {
          memberId,
          shopId: dto.shopId
        }
      }
    });

    // ถ้ายังไม่เคยสมัครสมาชิกร้านนี้ ให้ถือว่าเป็น NORMAL
    const levelCode = shopMember?.memberLevelCode || 'NORMAL';

    // 🛡️ ด่านที่ 2: ตรวจสอบสถานะสินค้า
    const productInfo = await this.prisma.comProduct.findUnique({
      where: { id: dto.productId },
      select: { visibilityCode: true, status: true }
    });

    if (!productInfo || productInfo.status !== 'PUBLISHED') {
      throw new BadRequestException('สินค้านี้ไม่พร้อมจำหน่าย');
    }

    // 💰 ด่านที่ 3: คำนวณราคาปัจจุบันตามระดับสมาชิกของร้านนั้น
    const activePrice = await this.calculateActivePrice(dto.companyId, dto.productId, dto.quantity, levelCode);

    // 📦 ด่านที่ 4: จัดการข้อมูลในตะกร้า (แยกตาม shopId)
    const existingCart = await this.prisma.comCart.findFirst({
      where: { 
        memberId, 
        companyId: dto.companyId, 
        shopId: dto.shopId, // แยกตะกร้าตามร้าน
        productId: dto.productId 
      },
    });

    if (existingCart) {
      const newQuantity = existingCart.quantity + dto.quantity;
      const newPrice = await this.calculateActivePrice(dto.companyId, dto.productId, newQuantity, levelCode);

      return this.prisma.comCart.update({
        where: { id: existingCart.id },
        data: { quantity: newQuantity, priceAtAdd: newPrice },
      });
    }

    return this.prisma.comCart.create({
      data: {
        memberId,
        companyId: dto.companyId,
        shopId: dto.shopId,
        productId: dto.productId,
        quantity: dto.quantity,
        priceAtAdd: activePrice,
      },
    });
  }

  // 🔄 ระบบโอนย้ายตะกร้า (Merge Cart) สำหรับลูกค้าที่เพิ่ง Login
 async mergeCart(memberId: number, dto: MergeCartDto) {
    let successCount = 0;

    for (const item of dto.items) {
      try {
        await this.addToCart(memberId, {
          companyId: item.companyId,
          shopId: item.shopId,
          productId: item.productId,
          quantity: item.quantity
        });
        successCount++;
      } catch (e) {
        // ข้ามรายการที่เพิ่มไม่ได้ (เช่น สินค้าหมด หรือไม่มีสิทธิ์)
      }
    }

    return { 
      success: true, 
      message: `ซิงค์ตะกร้าสินค้าเรียบร้อยแล้ว จำนวน ${successCount} รายการ` 
    };
  }

  // 📦 ดูตะกร้าสินค้า (จัดกลุ่มตามร้านค้าให้หน้าบ้านใช้ง่ายๆ)
 // 📦 ดูตะกร้าสินค้า (จัดกลุ่มตามร้านค้า)
  async getMyCart(memberId: number) {
    const carts = await this.prisma.comCart.findMany({
      where: { memberId },
      include: {
        company: { select: { id: true, name: true, code: true } },
        product: { select: { id: true, name: true, sku: true, featuredImageUrl: true } }
      },
      orderBy: [{ shopId: 'asc' }, { createdAt: 'desc' }]
    });

    const updatedCarts = await Promise.all(carts.map(async (cart) => {
      // 🌟 ดึงระดับสมาชิกของร้านนั้นๆ (ถ้า cart.shopId เป็น null ให้ใช้ค่าพื้นฐาน)
      let levelCode = 'NORMAL';
      
      if (cart.shopId) {
        const shopMember = await this.prisma.crmMemberShop.findUnique({
          where: { 
            memberId_shopId: { 
              memberId, 
              shopId: cart.shopId 
            } 
          }
        });
        if (shopMember) levelCode = shopMember.memberLevelCode;
      }
      
      // คำนวณราคาล่าสุด (Re-calculate) เผื่อมีการเปลี่ยนราคาที่หลังร้าน
      const currentPrice = await this.calculateActivePrice(
        cart.companyId, 
        cart.productId, 
        cart.quantity, 
        levelCode
      );

      return { 
        ...cart, 
        currentPrice, 
        totalPrice: currentPrice * cart.quantity 
      };
    }));

    return updatedCarts;
  }

  // ✏️ อัปเดตจำนวนสินค้า
  async updateQuantity(memberId: number, cartId: number, dto: UpdateCartDto) {
    const cart = await this.prisma.comCart.findFirst({ where: { id: cartId, memberId } });
    if (!cart) throw new NotFoundException('ไม่พบรายการในตะกร้า');

    const shopMember = await this.prisma.crmMemberShop.findUnique({
      where: { memberId_shopId: { memberId, shopId: cart.shopId ?? 0 } }
    });

    const newPrice = await this.calculateActivePrice(
      cart.companyId, 
      cart.productId, 
      dto.quantity, 
      shopMember?.memberLevelCode || 'NORMAL'
    );

    return this.prisma.comCart.update({
      where: { id: cartId },
      data: { quantity: dto.quantity, priceAtAdd: newPrice },
    });
  }

  // 🗑️ ลบสินค้าออกจากตะกร้า
  async removeFromCart(memberId: number, cartId: number) {
    const cart = await this.prisma.comCart.findFirst({ where: { id: cartId, memberId } });
    if (!cart) throw new NotFoundException('ไม่พบรายการในตะกร้า');

    return this.prisma.comCart.delete({ where: { id: cartId } });
  }
}