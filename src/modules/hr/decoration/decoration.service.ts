import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDecorationClassDto, CreateDecorationRecordDto } from './decoration.dto';

@Injectable()
export class DecorationService {
  constructor(private prisma: PrismaService) {}

  // --- Master Management ---
  async createClass(companyId: number, dto: CreateDecorationClassDto) {
    return this.prisma.hrRoyalDecoration.create({ // ✅ เปลี่ยนเป็นชื่อตาม Schema
      data: { ...dto, companyId }
    });
  }

  async findAllClasses(companyId: number) {
    return this.prisma.hrRoyalDecoration.findMany({
      where: { companyId, isActive: true },
      orderBy: { classLevel: 'asc' } // เรียงตามระดับชั้น 
    });
  }

  // --- Transaction Management ---
  async createRecord(companyId: number, dto: CreateDecorationRecordDto) {
    return this.prisma.hrEmployeeDecoration.create({ // ✅ เปลี่ยนเป็นชื่อตาม Schema
      data: {
        ...dto,
        companyId,
        gazetteDate: dto.gazetteDate ? new Date(dto.gazetteDate) : null,
        receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : null,
        returnedDate: dto.returnedDate ? new Date(dto.returnedDate) : null,
      },
      include: {
        decoration: true, // ตามชื่อ Relation ใน Schema 
        employee: { select: { firstName: true, lastName: true, employeeCode: true } }
      }
    });
  }

  async findEmployeeHistory(companyId: number, employeeId: number) {
    return this.prisma.hrEmployeeDecoration.findMany({
      where: { companyId, employeeId },
      include: { decoration: true },
      orderBy: { gazetteDate: 'desc' }
    });
  }

  async findAllRecords(companyId: number, year?: number) {
    return this.prisma.hrEmployeeDecoration.findMany({
      where: {
        companyId,
        // ✅ ถ้ามีการส่งปีมา ให้กรองจากช่วงวันที่ของปีนั้นใน gazetteDate
        ...(year ? {
          gazetteDate: {
            gte: new Date(`${year}-01-01`),
            lte: new Date(`${year}-12-31`),
          }
        } : {})
      },
      include: {
        employee: { 
          select: { 
            employeeCode: true, 
            firstName: true, 
            lastName: true 
          } 
        },
        decoration: true // เชื่อมไปยังตาราง HrRoyalDecoration [cite: 1365]
      },
      orderBy: { 
        gazetteDate: 'desc' 
      }
    });
  }
}