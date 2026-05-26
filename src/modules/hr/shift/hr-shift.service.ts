import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateHrShiftDto, UpdateHrShiftDto } from './hr-shift.dto';

@Injectable()
export class HrShiftService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: number, dto: CreateHrShiftDto) {
    const existing = await this.prisma.hrShift.findFirst({
      where: { companyId, code: dto.code }
    });
    if (existing) throw new BadRequestException(`รหัสกะการทำงาน ${dto.code} มีอยู่แล้วในระบบ`);

    return await this.prisma.hrShift.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        color: dto.color,
        type: dto.type,
        workStartTime: dto.workStartTime,
        workStartRel: dto.workStartRel,
        workEndTime: dto.workEndTime,
        workEndRel: dto.workEndRel,
        totalDayHours: dto.totalDayHours,
        firstHalfHours: dto.firstHalfHours,
        secondHalfHours: dto.secondHalfHours,
        // 🌟 เพิ่มข้อมูล OT
        isOtBeforeShift: dto.isOtBeforeShift,
        minOtBeforeMinutes: dto.minOtBeforeMinutes,
        isOtAfterShift: dto.isOtAfterShift,
        minOtAfterMinutes: dto.minOtAfterMinutes,
        isActive: dto.isActive,
        details: {
          create: (dto.details || []).map(d => ({
            previousShiftId: d.previousShiftId || null,
            boundaryStartTime: d.boundaryStartTime,
            boundaryStartRel: d.boundaryStartRel,
            boundaryEndTime: d.boundaryEndTime,
            boundaryEndRel: d.boundaryEndRel,
            priority: d.priority || 1,
            companyId
          }))
        },
        breaks: {
          create: [...new Set(dto.breakIds || [])].map(groupId => ({ groupId, companyId }))
        }
      },
      include: { 
        details: { include: { previousShift: true } },
        breaks: { include: { group: { include: { details: true } } } }
      }
    });
  }

  async findAll(companyId: number) {
    return await this.prisma.hrShift.findMany({
      where: { companyId },
      include: { 
        details: { include: { previousShift: true } },
        breaks: { include: { group: { include: { details: true } } } }
      },
      orderBy: { code: 'asc' }
    });
  }

  async findOne(id: number, companyId: number) {
    const shift = await this.prisma.hrShift.findFirst({
      where: { id, companyId },
      include: { 
        details: { include: { previousShift: true } },
        breaks: { include: { group: { include: { details: true } } } }
      }
    });
    if (!shift) throw new NotFoundException('ไม่พบข้อมูลกะการทำงาน');
    return shift;
  }

  async update(id: number, companyId: number, dto: UpdateHrShiftDto) {
    await this.findOne(id, companyId);

    return await this.prisma.$transaction(async (tx) => {
      // 1. อัปเดตข้อมูล Master
      await tx.hrShift.update({
        where: { id },
        data: {
          name: dto.name,
          color: dto.color,
          type: dto.type,
          workStartTime: dto.workStartTime,
          workStartRel: dto.workStartRel,
          workEndTime: dto.workEndTime,
          workEndRel: dto.workEndRel,
          totalDayHours: dto.totalDayHours,
          firstHalfHours: dto.firstHalfHours,
          secondHalfHours: dto.secondHalfHours,
          // 🌟 เพิ่มการอัปเดตข้อมูล OT
          isOtBeforeShift: dto.isOtBeforeShift,
          minOtBeforeMinutes: dto.minOtBeforeMinutes,
          isOtAfterShift: dto.isOtAfterShift,
          minOtAfterMinutes: dto.minOtAfterMinutes,
          isActive: dto.isActive
        }
      });

      // 2. อัปเดตข้อมูล Details (กรองเฉพาะฟิลด์พื้นฐาน)
      if (dto.details !== undefined && dto.details !== null) {
        await tx.hrShiftDetail.deleteMany({ where: { shiftId: id } });
        if (Array.isArray(dto.details) && dto.details.length > 0) {
          await tx.hrShiftDetail.createMany({
            data: dto.details.map(d => ({
              previousShiftId: d.previousShiftId || null,
              boundaryStartTime: d.boundaryStartTime,
              boundaryStartRel: d.boundaryStartRel,
              boundaryEndTime: d.boundaryEndTime,
              boundaryEndRel: d.boundaryEndRel,
              priority: d.priority || 1,
              shiftId: id,
              companyId
            }))
          });
        }
      }

      // 3. อัปเดตข้อมูลการพัก (Breaks) แบบป้องกันข้อมูลซ้ำ
      if (dto.breakIds !== undefined && dto.breakIds !== null) {
        await tx.hrShiftBreak.deleteMany({ where: { shiftId: id } });
        if (Array.isArray(dto.breakIds) && dto.breakIds.length > 0) {
          const uniqueBreakIds = [...new Set(dto.breakIds)];
          await tx.hrShiftBreak.createMany({
            data: uniqueBreakIds.map(groupId => ({ 
              shiftId: id, 
              groupId, 
              companyId 
            }))
          });
        }
      }

      // 4. ดึงข้อมูลล่าสุดกลับไปพร้อม nested ข้อมูลครบชุด
      return await tx.hrShift.findUnique({
        where: { id },
        include: { 
          details: { include: { previousShift: true } },
          breaks: { include: { group: { include: { details: true } } } }
        }
      });
    });
  }

  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return await this.prisma.hrShift.delete({ where: { id } });
  }
}