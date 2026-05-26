import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';

@Injectable()
export class WishlistsService {
  constructor(private prisma: PrismaService) {}

  // 1. Toggle Wishlist (Logic: ถ้ามีให้ลบ ถ้าไม่มีให้เพิ่ม)
  async toggle(companyId: number, memberId: number, dto: ToggleWishlistDto) {
    // ตรวจสอบว่าสินค้ามีอยู่จริงและเป็นของบริษัทนี้หรือไม่
    const product = await this.prisma.comProduct.findFirst({
      where: { id: dto.productId, companyId },
    });
    
    if (!product) {
      throw new NotFoundException('ไม่พบสินค้าที่ต้องการจัดการ');
    }

    // ค้นหาข้อมูลเดิมใน Wishlist
    const existing = await this.prisma.comWishlist.findUnique({
      where: {
        memberId_productId: { 
          memberId: memberId, 
          productId: dto.productId 
        },
      },
    });

    if (existing) {
      // ❌ กรณีที่ 1: มีอยู่แล้ว -> ทำการลบออก (Action เหมือน Delete)
      await this.prisma.comWishlist.delete({
        where: { id: existing.id },
      });
      return { 
        success: true,
        action: 'REMOVED', 
        message: 'นำสินค้าออกจากรายการที่ชื่นชอบแล้ว',
        productId: dto.productId 
      };
    } else {
      // ✅ กรณีที่ 2: ยังไม่มี -> ทำการเพิ่มเข้าไป (Action เหมือน Create)
      await this.prisma.comWishlist.create({
        data: {
          companyId,
          memberId,
          productId: dto.productId,
        },
      });
      return { 
        success: true,
        action: 'ADDED', 
        message: 'เพิ่มสินค้าเข้าในรายการที่ชื่นชอบเรียบร้อยแล้ว',
        productId: dto.productId 
      };
    }
  }

  // 2. ดึงรายการ Wishlist ทั้งหมดของสมาชิกคนนี้
  async findAll(companyId: number, memberId: number) {
    const list = await this.prisma.comWishlist.findMany({
      where: { companyId, memberId },
      include: {
        product: {
          include: {
            images: { take: 1 } // เอาเฉพาะรูปแรกมาโชว์ใน List
          }
        }
      },
      orderBy: { createdAt: 'desc' } // ล่าสุดอยู่บน
    });

    // ปรับโครงสร้างข้อมูลก่อนส่งกลับ (เพื่อความง่ายของ Frontend)
    return list.map(item => ({
      wishlistId: item.id.toString(),
      addedAt: item.createdAt,
      product: item.product
    }));
  }
}