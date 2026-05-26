import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateShopProductDto } from './dto/create-shop-product.dto';
import { UpdateShopProductDto } from './dto/update-shop-product.dto';

@Injectable()
export class ShopProductsService {
  constructor(private prisma: PrismaService) {}

  // 🛡️ Helper: ตรวจสอบว่า Shop และ Product เป็นของบริษัทนี้จริงๆ
  private async verifyOwnership(companyId: number, shopId: number, productId: number) {
    const [shop, product] = await Promise.all([
      this.prisma.comShopProfile.findFirst({ where: { id: shopId, companyId } }),
      this.prisma.comProduct.findFirst({ where: { id: productId, companyId } })
    ]);

    if (!shop) throw new NotFoundException(`ไม่พบข้อมูลร้านค้า หรือคุณไม่มีสิทธิ์เข้าถึง`);
    if (!product) throw new NotFoundException(`ไม่พบข้อมูลสินค้า หรือคุณไม่มีสิทธิ์เข้าถึง`);
  }

  // 1. เพิ่มสินค้าเข้าร้าน
  // 1. เพิ่มสินค้าเข้าร้าน
  async create(companyId: number, dto: CreateShopProductDto) {
    await this.verifyOwnership(companyId, dto.shopId, dto.productId);

    return this.prisma.comShopProduct.upsert({
      where: {
        shopId_productId: { shopId: dto.shopId, productId: dto.productId },
      },
      update: dto,
      create: {
        ...dto,
        companyId: companyId, // 🌟 เพิ่ม companyId เข้าไปตอนสร้างข้อมูลใหม่
      },
    });
  }

  // 2. ดึงสินค้าทั้งหมดในร้าน (พร้อมลอจิก ราคากลาง & ราคาแยกสาขา)
  async findAllByShop(companyId: number, shopId: number) {
    // 🛡️ เช็คสิทธิ์ร้านค้าก่อน
    const shop = await this.prisma.comShopProfile.findFirst({ where: { id: shopId, companyId } });
    if (!shop) throw new NotFoundException('ไม่พบร้านค้า');

    const shopProducts = await this.prisma.comShopProduct.findMany({
      where: { shopId },
      include: {
        product: {
          include: {
            images: { orderBy: { sortOrder: 'asc' }, take: 1 }, // ดึงรูปหลักมาโชว์ 1 รูป
            parent: { select: { id: true, price: true } } // 🌟 ดึงราคาแม่มาเผื่อ Fallback
          }
        }, 
      },
      orderBy: { createdAt: 'desc' },
    });

    // 💰 แมปข้อมูลราคาให้แสดงผลถูกต้องตาม Business Logic
    return shopProducts.map(sp => {
      const prod = sp.product;
      let basePrice = prod.price;

      // ลอจิก 1: ถ้าเป็นตัวลูก และไม่มีราคา ให้ยืมราคาแม่มาตั้งต้น
      if (prod.parentId && prod.parent && (!basePrice || Number(basePrice) === 0)) {
        basePrice = prod.parent.price;
      }

      // ลอจิก 2: ถ้ามีการตั้งราคาขายเฉพาะร้าน (priceOverride) ให้ยึดราคานี้เป็นหลัก! (กลยุทธ์ปลาสองน้ำ)
      const finalDisplayPrice = sp.priceOverride !== null ? sp.priceOverride : basePrice;

      return {
        ...sp,
        priceOverride: sp.priceOverride ? Number(sp.priceOverride) : null,
        displayPrice: Number(finalDisplayPrice || 0), // ส่งราคาที่คำนวณจบแล้วไปให้หน้าบ้านโชว์เลย
        product: {
          ...prod,
          price: Number(prod.price || 0)
        }
      };
    });
  }

  // 3. ดึงรายชื่อร้านที่สินค้านี้วางขายอยู่ (Reverse Lookup)
  async findAllByProduct(companyId: number, productId: number) {
    // 🛡️ เช็คสิทธิ์สินค้าก่อน
    const product = await this.prisma.comProduct.findFirst({ where: { id: productId, companyId } });
    if (!product) throw new NotFoundException('ไม่พบสินค้า');

    return this.prisma.comShopProduct.findMany({
      where: { productId },
      include: {
        shop: true, 
      },
      orderBy: { shopId: 'asc' },
    });
  }

  // 4. ดูเจาะจง Mapping
  async findOne(companyId: number, shopId: number, productId: number) {
    await this.verifyOwnership(companyId, shopId, productId);

    const item = await this.prisma.comShopProduct.findUnique({
      where: { shopId_productId: { shopId, productId } },
      include: {
        product: { include: { parent: { select: { price: true } } } },
        shop: true,
      },
    });

    if (!item) throw new NotFoundException(`ไม่พบการผูกสินค้านี้กับร้านค้าที่ระบุ`);

    // ลอจิก Price Fallback
    let basePrice = item.product.price;
    if (item.product.parentId && item.product.parent && (!basePrice || Number(basePrice) === 0)) {
      basePrice = item.product.parent.price;
    }

    return {
      ...item,
      priceOverride: item.priceOverride ? Number(item.priceOverride) : null,
      displayPrice: Number(item.priceOverride !== null ? item.priceOverride : basePrice)
    };
  }

  // 5. แก้ไข
  async update(companyId: number, shopId: number, productId: number, dto: UpdateShopProductDto) {
    await this.verifyOwnership(companyId, shopId, productId);
    await this.findOne(companyId, shopId, productId); 

    return this.prisma.comShopProduct.update({
      where: { shopId_productId: { shopId, productId } },
      data: dto,
    });
  }

  // 6. ลบ
  async remove(companyId: number, shopId: number, productId: number) {
    await this.verifyOwnership(companyId, shopId, productId);
    await this.findOne(companyId, shopId, productId); 

    return this.prisma.comShopProduct.delete({
      where: { shopId_productId: { shopId, productId } },
    });
  }
}