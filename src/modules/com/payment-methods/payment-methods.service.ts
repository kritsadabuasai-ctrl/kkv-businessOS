import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(private prisma: PrismaService) {}

  // 1. เพิ่มช่องทางชำระเงิน
  async create(dto: CreatePaymentMethodDto) {
    return this.prisma.comPaymentMethod.create({
      data: {
        companyId: dto.companyId!,
        code: dto.code,
        name: dto.name,
        type: dto.type || 'BANK_TRANSFER',
        config: dto.config || {}, // Default Empty JSON
        instruction: dto.instruction,
        qrImage: dto.qrImage,
        isActive: dto.isActive ?? true,
      },
    });
  }

  // 2. ดูทั้งหมดของบริษัท
  findAll(companyId: number) {
    return this.prisma.comPaymentMethod.findMany({
      where: { companyId },
      orderBy: { isActive: 'desc' }, // เอาตัวที่เปิดใช้งานขึ้นก่อน
    });
  }

  // 3. ดูทีละอัน
  async findOne(id: number, companyId: number) {
    const item = await this.prisma.comPaymentMethod.findFirst({
      where: { id, companyId }, // ✅ ต้องเป็นของบริษัทเราเท่านั้น
    });

    if (!item) throw new NotFoundException(`Payment Method ID ${id} not found`);
    return item;
  }

  // 4. แก้ไข
  async update(id: number, companyId: number, dto: UpdatePaymentMethodDto) {
    await this.findOne(id, companyId); // เช็คสิทธิ์ก่อน

    return this.prisma.comPaymentMethod.update({
      where: { id },
      data: dto,
    });
  }

  // 5. ลบ
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return this.prisma.comPaymentMethod.delete({ where: { id } });
  }
}