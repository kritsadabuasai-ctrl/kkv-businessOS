import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateMemberShopDto, MemberShopQueryDto } from './dto/member-shop.dto';

@Injectable()
export class CrmMemberShopService {
  constructor(private prisma: PrismaService) {}

  // 🔍 1. ดึงรายการสมาชิกรายร้าน (พร้อมข้อมูลลูกค้า)
  async findAll(companyId: number, query: MemberShopQueryDto) {
    return this.prisma.crmMemberShop.findMany({
      where: {
        companyId,
        shopId: query.shopId ? Number(query.shopId) : undefined,
        memberId: query.memberId ? Number(query.memberId) : undefined,
      },
      include: {
        member: true, // ดึงข้อมูล Master Profile มาโชว์ด้วย
        shop: true
      },
      orderBy: { joinedAt: 'desc' }
    });
  }

  // 🔍 2. ดูข้อมูลสมาชิกรายคนในร้านนั้นๆ
  async findOne(companyId: number, id: number) {
    const memberShop = await this.prisma.crmMemberShop.findFirst({
      where: { id, companyId },
      include: { member: true, shop: true }
    });
    if (!memberShop) throw new NotFoundException('ไม่พบข้อมูลสมาชิกในร้านนี้');
    return memberShop;
  }

  // 📝 3. อัปเดตแต้มหรือระดับสมาชิก (เฉพาะร้านนี้)
  async update(companyId: number, id: number, dto: UpdateMemberShopDto) {
    await this.findOne(companyId, id); // เช็คสิทธิ์ก่อน
    return this.prisma.crmMemberShop.update({
      where: { id },
      data: dto
    });
  }

  // 💰 4. ลอจิกพิเศษ: เติม/หักแต้มสมาชิกรายร้าน
  async adjustPoints(companyId: number, id: number, amount: number) {
    await this.findOne(companyId, id);
    return this.prisma.crmMemberShop.update({
      where: { id },
      data: { pointBalance: { increment: amount } }
    });
  }
}