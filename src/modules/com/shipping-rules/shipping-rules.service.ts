import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateShippingRuleDto } from './dto/create-shipping-rule.dto';
import { UpdateShippingRuleDto } from './dto/update-shipping-rule.dto';

@Injectable()
export class ShippingRulesService {
  constructor(private prisma: PrismaService) {}

  // 1. สร้างกฎใหม่
  async create(dto: CreateShippingRuleDto, companyId: number) {
    // Security: เช็คว่า Method นี้เป็นของบริษัทเราจริงไหม
    const method = await this.prisma.comShippingMethod.findFirst({
      where: { id: dto.methodId, companyId },
    });
    if (!method) throw new ForbiddenException(`You do not own Shipping Method ID ${dto.methodId}`);

    return this.prisma.comShippingRule.create({
      data: {
        ...dto,
        companyId, // 🌟 เพิ่ม companyId ตรงนี้! (สำคัญมาก ไม่งั้น Prisma จะฟ้อง Error)
      },
    });
  }

  // 2. ดึงกฎทั้งหมดของ Method นี้
  async findAllByMethod(methodId: number, companyId: number) {
    // 🌟 โค้ดคลีนขึ้นและทำงานเร็วขึ้น เพราะเราเอา companyId ไปกรองที่ตาราง ShippingRule ได้โดยตรงแล้ว
    return this.prisma.comShippingRule.findMany({
      where: { 
        methodId, 
        companyId // 🌟 เพิ่มเงื่อนไข companyId
      },
      orderBy: { minAmount: 'asc' }, // เรียงจากถูกไปแพง
    });
  }

  // 3. ดูทีละอัน
  async findOne(id: number, companyId: number) {
    // 🌟 ไม่ต้อง Join ตาราง (include) ให้หนักเครื่องแล้ว ค้นหาตรงๆ ได้เลย
    const rule = await this.prisma.comShippingRule.findFirst({
      where: { id, companyId },
    });

    if (!rule) throw new NotFoundException(`Shipping Rule ID ${id} not found or Access denied`);

    return rule;
  }

  // 4. แก้ไข
  async update(id: number, companyId: number, dto: UpdateShippingRuleDto) {
    await this.findOne(id, companyId); // เช็คสิทธิ์และเช็คว่ามีข้อมูลก่อน

    return this.prisma.comShippingRule.update({
      where: { id },
      data: dto,
    });
  }

  // 5. ลบ
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId); // เช็คสิทธิ์ก่อนลบ

    return this.prisma.comShippingRule.delete({
      where: { id },
    });
  }
}