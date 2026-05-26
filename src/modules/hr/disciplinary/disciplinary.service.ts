import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { 
  CreateOffenseTypeDto, 
  CreateDisciplinaryIncidentDto, 
  CreateDisciplinaryActionDto 
} from './disciplinary.dto';

@Injectable()
export class DisciplinaryService {
  constructor(private prisma: PrismaService) {}

  // --- Offense Types (Master) ---
  async findAllOffenseTypes(companyId: number) {
    return this.prisma.hrOffenseType.findMany({
      where: { companyId, isActive: true },
    });
  }

  // --- Penalty Types (Master) ---
  async findAllPenaltyTypes(companyId: number) {
    return this.prisma.hrPenaltyType.findMany({
      where: { companyId, isActive: true },
    });
  }

  // --- Incident Management ---
  async createIncident(companyId: number, reporterId: number, dto: CreateDisciplinaryIncidentDto) {
    // 1. สร้าง docNo อัตโนมัติ (เช่น DIS-2026-0001)
    const year = new Date().getFullYear() + 543; // พ.ศ.
    const count = await this.prisma.hrDisciplinaryIncident.count({ where: { companyId } });
    const docNo = `DIS-${year}-${(count + 1).toString().padStart(4, '0')}`;

    return this.prisma.hrDisciplinaryIncident.create({
      data: {
        companyId,
        docNo,
        reporterId, // คนที่ Login อยู่
        employeeId: dto.employeeId,
        offenseTypeId: dto.offenseTypeId,
        incidentDate: new Date(dto.incidentDate),
        location: dto.location,
        description: dto.description,
        evidenceUrls: dto.evidenceUrls,
        status: 'DRAFT',
      },
    });
  }

  async findAllIncidents(companyId: number, query: any) {
    return this.prisma.hrDisciplinaryIncident.findMany({
      where: { companyId },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        offenseType: true,
        actions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Action Management (บันทึกผลการลงโทษ) ---
  async recordAction(companyId: number, approverId: number, dto: CreateDisciplinaryActionDto) {
    return this.prisma.hrDisciplinaryAction.create({
      data: {
        companyId,
        incidentId: dto.incidentId,
        penaltyTypeId: dto.penaltyTypeId,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        remark: dto.remark,
        approvedById: approverId,
      },
    });
  }
}