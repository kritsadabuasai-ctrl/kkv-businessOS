import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateShippingMethodDto } from './dto/create-shipping-method.dto';
import { UpdateShippingMethodDto } from './dto/update-shipping-method.dto';

@Injectable()
export class ShippingMethodsService {
  constructor(private prisma: PrismaService) {}

  // 🌟 ปรับปรุงให้รับ companyId แยกต่างหาก
  async create(companyId: number, dto: CreateShippingMethodDto) {
    return this.prisma.comShippingMethod.create({
      data: {
        companyId: companyId, // บันทึกให้ตัวแม่
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
        calcType: dto.calcType || 'PRICE_BASED',
        rules: dto.rules?.length ? {
          create: dto.rules.map(r => ({
            companyId: companyId, // 🌟 กระจาย companyId ให้ตัวลูก (Rules) ทุกข้อ
            minAmount: r.minAmount || 0,
            maxAmount: r.maxAmount,
            minWeight: r.minWeight || 0,
            maxWeight: r.maxWeight,
            boxSize: r.boxSize || 'NONE',
            cost: r.cost
          }))
        } : undefined
      },
      include: { rules: true }
    });
  }

  async findAll(companyId: number) {
    return this.prisma.comShippingMethod.findMany({
      where: { companyId },
      include: { rules: { orderBy: { minAmount: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, companyId: number) {
    const item = await this.prisma.comShippingMethod.findFirst({
      where: { id, companyId },
      include: { rules: { orderBy: { minAmount: 'asc' } } },
    });

    if (!item) throw new NotFoundException(`Shipping Method ID ${id} not found`);
    return item;
  }

  async update(id: number, companyId: number, dto: UpdateShippingMethodDto) {
    await this.findOne(id, companyId);

    return this.prisma.$transaction(async (tx) => {
      // ลบกฎเก่าออกก่อนเพื่อเตรียมบันทึกกฎใหม่ (กรณีมีการแก้ List ของ Rules)
      if (dto.rules) {
        await tx.comShippingRule.deleteMany({
          where: { methodId: id, companyId }
        });
      }

      return tx.comShippingMethod.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          isActive: dto.isActive,
          calcType: dto.calcType,
          rules: dto.rules?.length ? {
            create: dto.rules.map(r => ({
              companyId: companyId, // 🌟 ใส่ให้ตัวลูกตอน Update ด้วย
              minAmount: r.minAmount || 0,
              maxAmount: r.maxAmount,
              minWeight: r.minWeight || 0,
              maxWeight: r.maxWeight,
              boxSize: r.boxSize || 'NONE',
              cost: r.cost
            }))
          } : undefined
        },
        include: { rules: true }
      });
    });
  }

  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return this.prisma.comShippingMethod.delete({
      where: { id },
    });
  }
}