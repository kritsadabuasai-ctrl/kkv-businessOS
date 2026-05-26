import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; // [cite: 10]
import { CreateCrmConfigDto } from './dto/create-crm-config.dto';
import { UpdateCrmConfigDto } from './dto/update-crm-config.dto';

@Injectable()
export class CompanyConfigsService {
  constructor(private prisma: PrismaService) {}

  // 1. ดึงข้อมูลการตั้งค่า (ถ้าไม่มีให้สร้าง Default) 
  async findOne(companyId: number) {
    return this.prisma.crmCompanyConfig.upsert({
      where: { companyId },
      update: {}, // ไม่แก้ไขอะไรถ้ามีอยู่แล้ว
      create: {
        companyId,
        isPointEnabled: true,
        earnRatio: 100,
        pointName: 'Point',
      },
    });
  }

  // 2. อัปเดตการตั้งค่า 
  async update(companyId: number, dto: UpdateCrmConfigDto) {
    return this.prisma.crmCompanyConfig.update({
      where: { companyId },
      data: dto,
    });
  }
}