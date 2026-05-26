import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateHrTimeBreakGroupDto, UpdateHrTimeBreakGroupDto } from './hr-time-break.dto';

@Injectable()
export class HrTimeBreakService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: number, dto: CreateHrTimeBreakGroupDto) {
    const existing = await this.prisma.hrTimeBreakGroup.findFirst({
      where: { companyId, code: dto.code }
    });
    if (existing) {
      throw new BadRequestException(`รหัสชุดเวลาพัก ${dto.code} มีอยู่แล้วในระบบ`);
    }

    // 🚩 ล้างข้อมูล Detail ตาม Type ที่เลือกจาก Master
    const cleanDetails = (dto.details || []).map(d => {
      const detail: any = { ...d, companyId };
      if (dto.type === 'FIXED_TIME') {
        detail.triggerAfterHours = null;
      } else if (dto.type === 'FLEXIBLE') {
        detail.startTime = null;
        detail.endTime = null;
      }
      return detail;
    });

    return await this.prisma.hrTimeBreakGroup.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        isActive: dto.isActive,
        details: {
          create: cleanDetails
        }
      },
      include: { details: true }
    });
  }

  async findAll(companyId: number) {
    return await this.prisma.hrTimeBreakGroup.findMany({
      where: { companyId },
      include: { details: true },
      orderBy: { code: 'asc' }
    });
  }

  async findOne(id: number, companyId: number) {
    const group = await this.prisma.hrTimeBreakGroup.findFirst({
      where: { id, companyId },
      include: { details: true }
    });
    if (!group) {
      throw new NotFoundException('ไม่พบข้อมูลชุดเวลาพักที่ระบุ');
    }
    return group;
  }

async update(id: number, companyId: number, dto: UpdateHrTimeBreakGroupDto) {
    // เช็คก่อนว่ามีข้อมูลอยู่จริง
    await this.findOne(id, companyId);

    return await this.prisma.$transaction(async (tx) => {
      // 1. อัปเดตข้อมูล Master (หัวข้อมูลเวลาพัก)
      await tx.hrTimeBreakGroup.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
          isActive: dto.isActive
        }
      });

      // 2. อัปเดตข้อมูล Details (กรองเฉพาะฟิลด์พื้นฐาน ป้องกันขยะจากหน้าบ้าน)
      if (dto.details !== undefined && dto.details !== null) {
        // ลบของเดิมทิ้งก่อน
        await tx.hrTimeBreakDetail.deleteMany({ where: { groupId: id } });
        
        // เช็คว่าเป็น Array และมีข้อมูล
        if (Array.isArray(dto.details) && dto.details.length > 0) {
          await tx.hrTimeBreakDetail.createMany({
            data: dto.details.map(d => ({
              // 🚩 ดึงมาเฉพาะฟิลด์ที่มีใน Database จริงๆ
              name: d.name,
              startTime: d.startTime || null,
              endTime: d.endTime || null,
              triggerAfterHours: d.triggerAfterHours || null,
              duration: d.duration,
              // ------------------------------------------
              groupId: id, 
              companyId 
            }))
          });
        }
      }

      // 3. ส่งข้อมูลล่าสุดกลับไปให้หน้าบ้าน
      return await tx.hrTimeBreakGroup.findUnique({
        where: { id },
        include: { details: true }
      });
    });
  }

  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return await this.prisma.hrTimeBreakGroup.delete({
      where: { id }
    });
  }
}