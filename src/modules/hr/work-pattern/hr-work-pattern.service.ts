import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateHrWorkPatternDto, UpdateHrWorkPatternDto } from './hr-work-pattern.dto';

@Injectable()
export class HrWorkPatternService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: number, dto: CreateHrWorkPatternDto) {
    const existing = await this.prisma.hrWorkPattern.findFirst({
      where: { companyId, code: dto.code }
    });
    if (existing) throw new BadRequestException(`รหัสรูปแบบการทำงาน ${dto.code} มีอยู่แล้วในระบบ`);

    return await this.prisma.hrWorkPattern.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        cycleDays: dto.cycleDays,
        isActive: dto.isActive,
        items: {
          create: (dto.items || []).map(item => ({
            ...item,
            companyId
          }))
        }
      },
      include: { items: { include: { shift: true } } }
    });
  }

  async findAll(companyId: number) {
    return await this.prisma.hrWorkPattern.findMany({
      where: { companyId },
      include: { items: { include: { shift: true } } },
      orderBy: { code: 'asc' }
    });
  }

  async findOne(id: number, companyId: number) {
    const pattern = await this.prisma.hrWorkPattern.findFirst({
      where: { id, companyId },
      include: { items: { include: { shift: true }, orderBy: { dayIndex: 'asc' } } }
    });
    if (!pattern) throw new NotFoundException('ไม่พบข้อมูลรูปแบบการทำงาน');
    return pattern;
  }

  async update(id: number, companyId: number, dto: UpdateHrWorkPatternDto) {
    await this.findOne(id, companyId);

    return await this.prisma.$transaction(async (tx) => {
      // 1. อัปเดตข้อมูล Master
      await tx.hrWorkPattern.update({
        where: { id },
        data: {
          name: dto.name,
          cycleDays: dto.cycleDays,
          isActive: dto.isActive
        }
      });

      // 2. จัดการข้อมูล Items (Delete-then-Create)
      if (dto.items) {
        await tx.hrWorkPatternItem.deleteMany({ where: { patternId: id } });
        
        if (dto.items.length > 0) {
          await tx.hrWorkPatternItem.createMany({
            data: dto.items.map(item => ({
              ...item,
              patternId: id,
              companyId
            }))
          });
        }
      }

      return await tx.hrWorkPattern.findUnique({
        where: { id },
        include: { items: { include: { shift: true }, orderBy: { dayIndex: 'asc' } } }
      });
    });
  }

  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return await this.prisma.hrWorkPattern.delete({ where: { id } });
  }
}