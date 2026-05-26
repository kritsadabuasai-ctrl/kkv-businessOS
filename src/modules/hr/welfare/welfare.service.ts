import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWelfareTypeDto, CreateWelfarePolicyDto, CreateWelfareRequestDto } from './welfare.dto';

@Injectable()
export class WelfareService {
  constructor(private prisma: PrismaService) {}

  // --- Master: Welfare Types ---
  async createType(companyId: number, dto: CreateWelfareTypeDto) {
    return this.prisma.hrWelfareType.create({
      data: { ...dto, companyId } // [cite: 663]
    });
  }

  async findAllTypes(companyId: number) {
    return this.prisma.hrWelfareType.findMany({
      where: { companyId, isActive: true }
    });
  }

  // --- Config: Welfare Policies ---
  async createPolicy(companyId: number, dto: CreateWelfarePolicyDto) {
    return this.prisma.hrWelfarePolicy.create({
      data: { ...dto, companyId } // [cite: 665]
    });
  }

  async findPolicies(companyId: number, year: number) {
    return this.prisma.hrWelfarePolicy.findMany({
      where: { companyId, calendarYear: year },
      include: { welfareType: true }
    });
  }

  // --- Transaction: Welfare Requests ---
  async createRequest(companyId: number, dto: CreateWelfareRequestDto) {
    // บันทึกคำขอเบิกสวัสดิการ [cite: 668]
    return this.prisma.hrWelfareRequest.create({
      data: {
        ...dto,
        companyId,
        receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : null,
        status: 'DRAFT', // [cite: 662]
      },
      include: {
        policy: { include: { welfareType: true } },
        employee: { select: { firstName: true, lastName: true } }
      }
    });
  }

  async findAllRequests(companyId: number) {
    return this.prisma.hrWelfareRequest.findMany({
      where: { companyId },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        policy: { include: { welfareType: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}