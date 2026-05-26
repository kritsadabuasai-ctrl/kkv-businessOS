import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

 // ==========================================
  // 🎟️ 1. สร้างคูปองส่วนลด/โปรโมชั่นใหม่ (Create) + 🛡️ Defensive Code
  // ==========================================
  async create(dto: CreateDiscountDto) {
    dto.code = dto.code.toUpperCase().trim(); 

    const existing = await this.prisma.comDiscount.findFirst({
      where: {
        companyId: dto.companyId!, 
        shopId: dto.shopId || null, 
        code: dto.code
      },
    });

    if (existing) {
      throw new BadRequestException(`รหัสส่วนลด '${dto.code}' นี้มีอยู่แล้วในระบบของร้านค้า/บริษัทนี้`);
    }

    const { documents, targetIds, ...discountData } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1.1 บันทึกส่วนลดหลักลงตาราง com_discounts
      const discount = await tx.comDiscount.create({
        data: {
          ...discountData,
          companyId: dto.companyId!,
          shopId: dto.shopId || null,
          targetIds: targetIds ?? undefined,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          isActive: dto.isActive ?? true,
        },
      });

      // 1.2 🛡️ [Defensive Code] บริหารจัดการไฟล์/รูปโปรโมชั่น 
      if (documents && documents.length > 0) {
        
        // ค้นหา ID ที่มีอยู่จริงรวดเดียว
        const mediaIds = documents.map(doc => doc.mediaId);
        const existingMedias = await tx.sysMedia.findMany({
          where: { id: { in: mediaIds } },
          select: { id: true }
        });
        const validMediaIds = new Set(existingMedias.map(m => m.id));

        for (const doc of documents) {
          if (validMediaIds.has(doc.mediaId)) {
            await tx.ecomPromotionDocument.create({
              data: {
                companyId: dto.companyId!,
                discountId: discount.id,
                mediaId: doc.mediaId,
              },
            });
          } else {
             console.warn(`⚠️ [Create Discount] Media ID: ${doc.mediaId} หาไม่เจอในระบบ ข้ามการผูกรูปโปรโมชั่นนี้`);
          }
        }
      }

      // ดึงข้อมูลเวอร์ชันเต็มพร้อมรายละเอียดไฟล์แนบกลับไปแสดงผล
      return tx.comDiscount.findUnique({
        where: { id: discount.id },
        include: {
          documents: { include: { media: true } },
        },
      });
    });
  }

  // ==========================================
  // 🎟️ 2. ดึงคูปองส่วนลดทั้งหมดของบริษัท (Find All)
  // ==========================================
  async findAll(companyId: number, shopId?: number) {
    return this.prisma.comDiscount.findMany({
      where: {
        companyId,
        ...(shopId !== undefined ? { OR: [{ shopId }, { shopId: null }] } : {}),
      },
      include: {
        documents: { include: { media: true } }, // ✅ ดึงรายการรูป/ไฟล์โปรโมชั่นไปด้วย
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // 🎟️ 3. ตรวจสอบคูปองจากหน้าบ้าน (Check Coupon Code)
  // ==========================================
  async findByCode(companyId: number, code: string, shopId?: number) {
    const cleanCode = code.toUpperCase().trim();

    const discount = await this.prisma.comDiscount.findFirst({
      where: {
        companyId,
        code: cleanCode,
        isActive: true,
        OR: [
          { shopId: shopId ? Number(shopId) : null },
          { shopId: null }
        ]
      },
      include: {
        documents: { include: { media: true } },
      }
    });

    if (!discount) throw new NotFoundException('รหัสส่วนลดไม่ถูกต้องหรือหมดอายุแล้ว');

    const now = new Date();
    if (discount.startDate && now < discount.startDate) throw new BadRequestException('คูปองส่วนลดนี้ยังไม่เปิดให้ใช้งาน');
    if (discount.endDate && now > discount.endDate) throw new BadRequestException('คูปองส่วนลดนี้หมดอายุการใช้งานแล้ว');
    if (discount.maxUsageTotal && discount.usedCount >= discount.maxUsageTotal) throw new BadRequestException('คูปองส่วนลดนี้ถูกใช้งานครบสิทธิ์เต็มจำนวนแล้ว');

    return discount;
  }

  // ==========================================
  // 🎟️ 4. ดึงข้อมูลส่วนลดเดี่ยวตาม ID (Find One)
  // ==========================================
  async findOne(id: number, companyId: number) {
    const discount = await this.prisma.comDiscount.findFirst({
      where: { id, companyId },
      include: {
        documents: { include: { media: true } }, // ✅ รวมข้อมูลไฟล์ DMS แนบฉบับสมบูรณ์
      },
    });
    if (!discount) throw new NotFoundException(`ไม่พบข้อมูลคูปองส่วนลดรหัส ${id}`);
    return discount;
  }

  // ==========================================
  // 🎟️ 5. อัปเดตข้อมูลส่วนลด/โปรโมชั่น (Update) + 🛡️ Defensive Code
  // ==========================================
  async update(id: number, companyId: number, dto: UpdateDiscountDto) {
    await this.findOne(id, companyId); 
    
    if (dto.code) dto.code = dto.code.toUpperCase().trim();

    const { documents, targetIds, ...discountData } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 5.1 แก้ไขข้อมูลโครงสร้างหลักบนตาราง com_discounts
      await tx.comDiscount.update({
        where: { id },
        data: {
          ...discountData,
          targetIds: targetIds !== undefined ? targetIds : undefined,
          startDate: dto.startDate === null ? null : (dto.startDate ? new Date(dto.startDate) : undefined),
          endDate: dto.endDate === null ? null : (dto.endDate ? new Date(dto.endDate) : undefined),
        },
      });

      // 5.2 🛡️ [Defensive Code] บริหารจัดการไฟล์/รูปภาพหน้าปกโปรโมชั่น
      if (documents !== undefined) {
        // ล้างความสัมพันธ์รูปภาพเก่าทั้งหมดของโปรโมชั่นนี้ออกก่อน
        await tx.ecomPromotionDocument.deleteMany({
          where: { discountId: id },
        });

        // หากมีการส่งเอกสารชุดภาพใหม่เข้ามา ให้ทำการคัดกรองก่อนผูก
        if (documents.length > 0) {
          const mediaIds = documents.map(doc => doc.mediaId);
          const existingMedias = await tx.sysMedia.findMany({
            where: { id: { in: mediaIds } },
            select: { id: true }
          });
          const validMediaIds = new Set(existingMedias.map(m => m.id));

          for (const doc of documents) {
            if (validMediaIds.has(doc.mediaId)) {
              await tx.ecomPromotionDocument.create({
                data: {
                  companyId,
                  discountId: id,
                  mediaId: doc.mediaId,
                },
              });
            } else {
              console.warn(`⚠️ [Update Discount] Media ID: ${doc.mediaId} หาไม่เจอในระบบ ข้ามการผูกรูปโปรโมชั่นนี้`);
            }
          }
        }
      }

      return tx.comDiscount.findUnique({
        where: { id },
        include: {
          documents: { include: { media: true } },
        },
      });
    });
  }

  // ==========================================
  // 🎟️ 6. ลบคูปองส่วนลด (Delete)
  // ==========================================
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    
    // ตาราง ecom_promotion_documents มีการตั้ง onDelete: Cascade เอาไว้ในระดับฐานข้อมูล
    // เมื่อคูปองหลักถูกลบ ข้อมูลประวัติเอกสารอ้างอิงตารางลูกจะโดนล้างออกโดยอัตโนมัติ
    await this.prisma.comDiscount.delete({
      where: { id },
    });

    return { message: 'ลบรหัสคูปองส่วนลดและล้างประวัติเชื่อมโยงสื่อสำเร็จ' };
  }
}