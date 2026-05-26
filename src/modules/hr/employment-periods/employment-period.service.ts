import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEmploymentPeriodDto, UpdateEmploymentPeriodDto } from './employment-period.dto';

@Injectable()
export class EmploymentPeriodService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 1. เพิ่มประวัติช่วงการทำงาน
  // =========================================================
  async createPeriod(companyId: number, dto: CreateEmploymentPeriodDto) {
    const employee = await this.prisma.hrEmployee.findFirst({
        where: { id: dto.employeeId, companyId }
    });

    if (!employee) {
        throw new NotFoundException(`Employee ID ${dto.employeeId} not found in your company`);
    }

    if (dto.endDate && new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('End date cannot be before start date');
    }

    return this.prisma.hrEmploymentPeriod.create({
      data: {
        companyId,
        employeeId: dto.employeeId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        reason: dto.reason,
        isDeductible: dto.isDeductible ?? true,
      },
    });
  }

  // =========================================================
  // 2. ดึงประวัติทั้งหมดของพนักงานคนหนึ่ง (By Employee)
  // =========================================================
  async getPeriodsByEmployee(companyId: number, employeeId: number) {
    const employee = await this.prisma.hrEmployee.findFirst({
        where: { id: employeeId, companyId }
    });
    if (!employee) {
        throw new NotFoundException(`Employee ID ${employeeId} not found`);
    }

    return this.prisma.hrEmploymentPeriod.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
      // ✅ ไม่ต้อง Include เยอะ เพราะรู้ Employee ID อยู่แล้ว
    });
  }

  // =========================================================
  // ✅ 3. (เพิ่มใหม่) ดึงประวัติทั้งหมดของบริษัท (All Company)
  // =========================================================
  async getAllPeriods(companyId: number) {
    return this.prisma.hrEmploymentPeriod.findMany({
      where: { 
        employee: { companyId } // กรองผ่าน Relation
      },
      include: {
        // ✅ Include ชื่อพนักงานมาด้วย เพื่อให้รู้ว่าเป็นประวัติของใคร
        employee: {
            select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                status: true
            }
        }
      },
      orderBy: { startDate: 'desc' }, // เรียงตามวันล่าสุด
    });
  }

  // =========================================================
  // 4. ดึง Period เดียว (By ID)
  // =========================================================
  async getPeriodById(companyId: number, id: number) {
    const period = await this.prisma.hrEmploymentPeriod.findUnique({
      where: { id,companyId },
      include: { 
        // ✅ Include ชื่อพนักงานมาด้วย
        employee: {
            select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                companyId: true // เอาไว้เช็คสิทธิ์
            }
        } 
      }
    });

    if (!period) {
      throw new NotFoundException(`Employment Period ID ${id} not found`);
    }

    if (period.employee.companyId !== companyId) {
        throw new ForbiddenException('You do not have permission to access this resource');
    }

    return period;
  }

  // =========================================================
  // 5. แก้ไข (Update)
  // =========================================================
  async updatePeriod(companyId: number, id: number, dto: UpdateEmploymentPeriodDto) {
    const existing = await this.getPeriodById(companyId, id);

    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const endDate = dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : existing.endDate;

    if (endDate && endDate < startDate) {
      throw new BadRequestException('End date cannot be before start date');
    }

    return this.prisma.hrEmploymentPeriod.update({
      where: { id },
      data: {
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : (dto.endDate === null ? null : undefined),
        reason: dto.reason,
        isDeductible: dto.isDeductible,
      },
    });
  }

  // =========================================================
  // 6. ลบ (Delete)
  // =========================================================
  async deletePeriod(companyId: number, id: number) {
    await this.getPeriodById(companyId, id);
    return this.prisma.hrEmploymentPeriod.delete({
      where: { id },
    });
  }
}