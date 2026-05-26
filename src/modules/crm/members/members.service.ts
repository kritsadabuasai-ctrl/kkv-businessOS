import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MembersService {
  constructor(
    private prisma: PrismaService
  ) {}

  // =========================================================
  // 📝 1. สร้างลูกค้าใหม่ (รองรับการเชื่อมโยงรูปโปรไฟล์ผ่าน DMS) + 🛡️ Defensive Code
  // =========================================================
  async create(companyId: number, dto: CreateMemberDto) {
    const { memberCode, runningCodeType, shopId, profileMediaId, ...restDto } = dto;

    // 🌟 [Defensive Code] ตรวจสอบว่ารูปภาพโปรไฟล์มีอยู่จริงในตาราง SysMedia
    let finalProfileMediaId = profileMediaId;
    if (finalProfileMediaId) {
      const mediaExists = await this.prisma.sysMedia.findUnique({
        where: { id: finalProfileMediaId },
        select: { id: true }
      });
      if (!mediaExists) {
        console.warn(`⚠️ [Create Member] Media ID: ${finalProfileMediaId} หาไม่เจอในระบบ ข้ามการผูกรูปโปรไฟล์ลูกค้านี้`);
        finalProfileMediaId = undefined; // หรือ null
      }
    }

    let member: any = null;

    // เช็คว่ามี Master Profile ในบริษัทนี้อยู่แล้วหรือไม่ (จากเบอร์โทร หรือ LINE)
    if (dto.phone) {
      member = await this.prisma.crmMember.findUnique({
        where: { companyId_phone: { companyId, phone: dto.phone } }
      });
    } else if (dto.lineUserId) {
      member = await this.prisma.crmMember.findUnique({
        where: { companyId_lineUserId: { companyId, lineUserId: dto.lineUserId } }
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // ถ้ายังไม่มีข้อมูลสมาชิกส่วนกลาง ให้สร้างขึ้นมาใหม่
      if (!member) {
        member = await tx.crmMember.create({
          data: {
            companyId,
            ...restDto,
            profileMediaId: finalProfileMediaId, // 🚩 บันทึกด้วย ID ที่ผ่านการกรองแล้ว
            memberCode: memberCode || `M-${Date.now()}`
          }
        });
      } else {
        // ถ้ามีสมาชิกอยู่แล้ว แต่อยากอัปเดตรูปภาพโปรไฟล์ผ่านไอดีใหม่
        if (finalProfileMediaId) {
          member = await tx.crmMember.update({
            where: { id: member.id },
            data: { profileMediaId: finalProfileMediaId }
          });
        }
      }

      // ตรวจสอบลอจิกผูกสมาชิกร้านค้ารายสาขา (Shop Membership)
      if (shopId) {
        const existingMembership = await tx.crmMemberShop.findUnique({
          where: { memberId_shopId: { memberId: member.id, shopId } }
        });

        if (!existingMembership) {
          await tx.crmMemberShop.create({
            data: {
              companyId,
              shopId,
              memberId: member.id,
              pointBalance: 0
            }
          });
        }
      }

      return tx.crmMember.findUnique({
        where: { id: member.id },
        include: {
          profileMedia: true, 
          shopMemberships: { include: { shop: { select: { shopName: true } } } }
        }
      });
    });
  }

  // =========================================================
  // 🔍 2. ค้นหารายชื่อลูกค้าทั้งหมดในบริษัท (ดึงรูปโปรไฟล์ DMS และรองรับ Filter)
  // =========================================================
  async findAll(companyId: number, search?: string, level?: string, shopId?: number) {
    // 1. ตั้งค่าพื้นฐาน: ดึงเฉพาะลูกค้าของบริษัทนี้ และที่ยัง Active อยู่
    const whereClause: any = { companyId, isActive: true };

    // 2. 🔍 เงื่อนไขค้นหา (Search): ค้นจาก ชื่อ, นามสกุล, เบอร์โทร หรือ รหัสสมาชิก
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { memberCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    // 3. 🏪 เงื่อนไขสาขา (Shop Filter): ค้นหาเฉพาะลูกค้าที่เป็นสมาชิกของสาขาที่ระบุ
    if (shopId) {
      whereClause.shopMemberships = {
        some: { shopId: shopId } // ใช้ some เพื่อเช็คใน Array ของ Relation
      };
    }

    // (ถ้าในอนาคตมีระบบ Level สามารถเพิ่มเงื่อนไข level เข้าไปใน whereClause ต่อได้เลยครับ)

    // 4. ดึงข้อมูลจากฐานข้อมูล
    return this.prisma.crmMember.findMany({
      where: whereClause,
      include: {
        profileMedia: true, // 🚩 ดึงข้อมูลภาพสื่อประกอบตารางแสดงผลภาพรวม
        shopMemberships: { include: { shop: { select: { shopName: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // =========================================================
  // 🔍 3. ดึงรายละเอียดสมาชิกรายบุคคล
  // =========================================================
  async findOne(companyId: number, id: number) {
    const member = await this.prisma.crmMember.findFirst({
      where: { id, companyId },
      include: {
        profileMedia: true, // 🚩 ดึงภาพโปรไฟล์ประมวลผลรายละเอียดรายบุคคล
        addresses: true,
        shopMemberships: { include: { shop: { select: { shopName: true } } } }
      }
    });

    if (!member) throw new NotFoundException('ไม่พบข้อมูลสมาชิกท่านนี้ในระบบ');
    return member;
  }

  // =========================================================
  // 📝 4. อัปเดตข้อมูลรายละเอียดลูกค้า + 🛡️ Defensive Code
  // =========================================================
  async update(companyId: number, id: number, dto: UpdateMemberDto) {
    await this.findOne(companyId, id); // ตรวจสอบสิทธิ์การเข้าถึงความปลอดภัย

    // 🌟 [Defensive Code] ตรวจสอบรูปภาพโปรไฟล์ก่อนอัปเดต
    let finalProfileMediaId = dto.profileMediaId;
    if (finalProfileMediaId) {
      const mediaExists = await this.prisma.sysMedia.findUnique({
        where: { id: finalProfileMediaId },
        select: { id: true }
      });
      if (!mediaExists) {
        console.warn(`⚠️ [Update Member] Media ID: ${finalProfileMediaId} หาไม่เจอในระบบ ข้ามการผูกรูปโปรไฟล์ลูกค้านี้`);
        finalProfileMediaId = undefined;
      }
    }

    return this.prisma.crmMember.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        idCardNumber: dto.idCardNumber,
        thaiId: dto.thaiId,
        lineName: dto.lineName,
        linePicture: dto.linePicture,
        ...(finalProfileMediaId !== undefined && { profileMediaId: finalProfileMediaId }), // 🚩 อัปเดตด้วย ID ที่ผ่านการกรองแล้ว
        isMarketingConsent: dto.isMarketingConsent
      },
      include: {
        profileMedia: true // ส่งข้อมูลรูปชุดใหม่กลับหน้าบ้าน
      }
    });
  }

  // =========================================================
  // 🗑️ 5. ลบรายชื่อลูกค้าออกจากระบบ
  // =========================================================
  async remove(companyId: number, id: number) {
    await this.findOne(companyId, id); // ตรวจเช็คสิทธิ์ความปลอดภัย
    
    // เลือกใช้ Soft Delete หรือ Hard Delete ตามความต้องการระเบียบสัญญาระบบภายใน
    return this.prisma.crmMember.update({
      where: { id },
      data: { isActive: false }
    });
  }
}