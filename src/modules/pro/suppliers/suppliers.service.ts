import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  // 1. สร้าง Supplier
  async create(dto: CreateSupplierDto) {
    return this.prisma.proSupplier.create({
      data: {
        companyId: dto.companyId!, // มั่นใจว่ามีค่าเพราะ Controller ใส่ให้แล้ว
        code: dto.code,
        name: dto.name,
        taxId: dto.taxId,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        creditTerm: dto.creditTerm ?? 0,
        currency: dto.currency ?? 'THB',
        type: dto.type ?? 'LOCAL',
        isActive: dto.isActive ?? true,
      },
    });
  }

  // 2. ดูทั้งหมด (เฉพาะบริษัทเรา)
  findAll(companyId: number) {
    return this.prisma.proSupplier.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. ดูรายตัว
  async findOne(id: number, companyId: number) {
    const supplier = await this.prisma.proSupplier.findFirst({
      where: { id, companyId }, // ✅ ต้องตรงทั้ง ID และ Company
    });

    if (!supplier) throw new NotFoundException(`Supplier ID ${id} not found`);
    return supplier;
  }

  // 4. แก้ไข
  async update(id: number, companyId: number, dto: UpdateSupplierDto) {
    await this.findOne(id, companyId); // เช็คสิทธิ์ก่อน

    return this.prisma.proSupplier.update({
      where: { id },
      data: dto,
    });
  }

  // 5. ลบ
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId); // เช็คสิทธิ์ก่อน
    return this.prisma.proSupplier.delete({ where: { id } });
  }
}