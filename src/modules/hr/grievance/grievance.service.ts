import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateGrievanceTypeDto, CreateGrievanceTicketDto, ResolveGrievanceDto } from './grievance.dto';

@Injectable()
export class GrievanceService {
  constructor(private prisma: PrismaService) {}

  // --- Master: Grievance Types ---
  async createType(companyId: number, dto: CreateGrievanceTypeDto) {
    return this.prisma.hrGrievanceType.create({
      data: { ...dto, companyId }
    });
  }

  async findAllTypes(companyId: number) {
    return this.prisma.hrGrievanceType.findMany({
      where: { companyId, isActive: true }
    });
  }

  // --- Transaction: Grievance Tickets ---
  async createTicket(companyId: number, dto: CreateGrievanceTicketDto) {
    // 1. สร้าง docNo อัตโนมัติ (เช่น GRV-2569-0001)
    const year = new Date().getFullYear() + 543;
    const count = await this.prisma.hrGrievanceTicket.count({ where: { companyId } });
    const docNo = `GRV-${year}-${(count + 1).toString().padStart(4, '0')}`;

    return this.prisma.hrGrievanceTicket.create({
      data: {
        ...dto,
        companyId,
        docNo,
        incidentDate: dto.incidentDate ? new Date(dto.incidentDate) : null,
        status: 'SUBMITTED',
      },
      include: { type: true, requester: { select: { firstName: true, lastName: true } } }
    });
  }

  async findAllTickets(companyId: number, query: any) {
    return this.prisma.hrGrievanceTicket.findMany({
      where: { 
        companyId,
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        type: true,
        requester: { select: { firstName: true, lastName: true, employeeCode: true } },
        accused: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async resolveTicket(companyId: number, id: number, dto: ResolveGrievanceDto) {
    return this.prisma.hrGrievanceTicket.update({
      where: { id, companyId },
      data: {
        status: dto.status,
        resolutionSummary: dto.resolutionSummary,
        resolvedAt: new Date(),
      }
    });
  }
}