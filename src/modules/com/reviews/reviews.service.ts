import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 1. สร้างรีวิวใหม่ (พร้อมระบบตรวจสอบประวัติการซื้อ + 🛡️ Defensive Code เชื่อม DMS)
  // =========================================================
  async create(companyId: number, memberId: number, dto: CreateReviewDto) {
    return this.prisma.$transaction(async (tx) => {
      
      // 🛡️ 1.1 ระบบตรวจสอบสิทธิ์การรีวิว (No Purchase, No Review)
      const purchaseCondition: any = {
        memberId: memberId,
        companyId: companyId,
        status: 'COMPLETED', 
        items: {
          some: { productId: dto.productId }
        }
      };

      if (dto.orderId) {
        purchaseCondition.id = dto.orderId;
      }

      const verifiedOrder = await tx.comOrder.findFirst({
        where: purchaseCondition
      });

      if (!verifiedOrder) {
        throw new BadRequestException('คุณสามารถรีวิวได้เฉพาะสินค้าที่คุณเคยสั่งซื้อและได้รับสินค้าเรียบร้อยแล้วเท่านั้น');
      }

      // 🛡️ 1.2 ตรวจสอบว่าเคยรีวิวสินค้าชิ้นนี้ในออเดอร์นี้ไปหรือยัง (ป้องกันรีวิวซ้ำ)
      const existing = await tx.comProductReview.findFirst({
        where: { 
          productId: dto.productId, 
          memberId,
          ...(dto.orderId ? { orderId: dto.orderId } : {}) 
        }
      });

      if (existing) {
        throw new BadRequestException('คุณได้รีวิวสินค้านี้ไปเรียบร้อยแล้ว');
      }

      // 🌟 1.3 [Defensive Code] คัดกรองเฉพาะ Media ID ที่มีอยู่จริงในตาราง SysMedia
      let validMediaIds: number[] = [];
      if (dto.mediaIds && dto.mediaIds.length > 0) {
        // ค้นหา ID ที่มีอยู่จริงรวดเดียว
        const existingMedias = await tx.sysMedia.findMany({
          where: { id: { in: dto.mediaIds } },
          select: { id: true }
        });
        
        validMediaIds = existingMedias.map(m => m.id);

        if (validMediaIds.length !== dto.mediaIds.length) {
           console.warn(`⚠️ [Create Review] พบรูปภาพบางรายการสูญหาย ข้ามการผูกรูปที่ไม่มีอยู่จริง`);
        }
      }

      // 📝 1.4 บันทึกรีวิวลงฐานข้อมูล พร้อมเชื่อมรูปภาพเฉพาะตัวที่ถูกต้อง (validMediaIds)
      const review = await tx.comProductReview.create({
        data: {
          companyId,
          productId: dto.productId,
          memberId,
          orderId: dto.orderId || verifiedOrder.id,
          rating: dto.rating,
          comment: dto.comment,
          // 🌟 สร้างความสัมพันธ์เฉพาะรูปภาพที่ผ่านการคัดกรองแล้ว
          ...(validMediaIds.length > 0 ? {
            reviewMedias: {
              create: validMediaIds.map((mediaId, index) => ({
                companyId: companyId,
                mediaId: mediaId,
                sortOrder: index // เรียงลำดับรูปตามที่ส่งมา
              }))
            }
          } : {})
        },
        include: {
          reviewMedias: true
        }
      });

      // 📈 1.5 อัปเดตสถิติคะแนนและจำนวนรีวิวของสินค้า
      await this.updateProductStats(tx, dto.productId);

      // แปลง BigInt เพื่อป้องกัน Error ตอนส่งกลับเป็น JSON
      return { 
        ...review, 
        id: review.id.toString(), 
        reviewMedias: review.reviewMedias?.map(rm => ({
          ...rm, 
          id: rm.id.toString(), 
          reviewId: rm.reviewId.toString()
        })) 
      };
    });
  }

  // =========================================================
  // 2. ดึงรีวิวของสินค้า (Public - สำหรับหน้าเว็บ)
  // =========================================================
  async findByProduct(productId: number) {
    const reviews = await this.prisma.comProductReview.findMany({
      where: { productId, isHidden: false },
      include: {
        member: { select: { firstName: true, lineName: true, linePicture: true } },
        // 🌟 ดึงข้อมูลรูปภาพจาก SysMedia ออกมาโชว์หน้าบ้านด้วย
        reviewMedias: {
          include: {
            media: true // JOIN ไปเอา URL ไฟล์จริงจาก SysMedia
          },
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // แปลง BigInt เป็น String เพื่อให้ JSON ทำงานได้
    return reviews.map(r => ({ 
      ...r, 
      id: r.id.toString(),
      reviewMedias: r.reviewMedias?.map(rm => ({
        ...rm,
        id: rm.id.toString(),
        reviewId: rm.reviewId.toString()
      }))
    }));
  }

  // =========================================================
  // 3. ร้านค้าตอบกลับรีวิว (Admin Only)
  // =========================================================
  async reply(companyId: number, reviewId: number, replyMessage: string) {
    const review = await this.prisma.comProductReview.findFirst({
      where: { id: BigInt(reviewId), companyId }
    });
    if (!review) throw new NotFoundException('ไม่พบข้อมูลรีวิว');

    return this.prisma.comProductReview.update({
      where: { id: BigInt(reviewId) },
      data: {
        replyMessage,
        repliedAt: new Date(),
      },
    });
  }

  // =========================================================
  // 4. ลบรีวิว (Admin Only)
  // =========================================================
  async remove(reviewId: number, companyId: number) {
    const review = await this.prisma.comProductReview.findFirst({
      where: { id: BigInt(reviewId), companyId }
    });

    if (!review) throw new NotFoundException('ไม่พบรีวิวที่ต้องการลบ');

    return this.prisma.$transaction(async (tx) => {
      // 4.1 ลบรีวิว (เนื่องจากตั้ง onDelete: Cascade ใน Schema แล้ว ข้อมูลใน reviewMedias จะถูกลบตามไปด้วยอัตโนมัติ)
      await tx.comProductReview.delete({
        where: { id: BigInt(reviewId) }
      });

      // 4.2 อัปเดตสถิติคะแนนสินค้าใหม่ทันที
      await this.updateProductStats(tx, review.productId);

      return { success: true, message: 'ลบรีวิวเรียบร้อยแล้ว' };
    });
  }

  // =========================================================
  // 🛠️ Helper: ฟังก์ชันสำหรับคำนวณคะแนนเฉลี่ย (Rating Avg)
  // =========================================================
  private async updateProductStats(tx: any, productId: number) {
    const stats = await tx.comProductReview.aggregate({
      where: { productId, isHidden: false },
      _avg: { rating: true },
      _count: { id: true },
    });

    await tx.comProduct.update({
      where: { id: productId },
      data: {
        ratingAvg: stats._avg.rating || 0,
        reviewCount: stats._count.id || 0,
      },
    });
  }
}