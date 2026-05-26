import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWfModuleMappingDto, UpdateWfModuleMappingDto } from './wf-module-mapping.dto';


@Injectable()
export class WfModuleMappingService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. สร้างการจับคู่ใหม่
  async create(companyId: number, dto: CreateWfModuleMappingDto) {
    // เช็คก่อนว่าโมดูลนี้ถูกจับคู่ไปหรือยังในบริษัทนี้ (ถ้าไม่มี condition ถือว่าห้ามซ้ำ)
    if (!dto.condition) {
      const existing = await this.prisma.wfModuleMapping.findFirst({
        where: { companyId, moduleCode: dto.moduleCode, condition: null },
      });
      if (existing) {
        throw new ConflictException(`โมดูล ${dto.moduleCode} มีการจับคู่สายอนุมัติหลักไปแล้ว`);
      }
    }

    return this.prisma.wfModuleMapping.create({
      data: {
        companyId,
        moduleCode: dto.moduleCode,
        workflowId: dto.workflowId,
        condition: dto.condition,
        isActive: dto.isActive ?? true,
      },
      include: { workflow: true }, // ดึงข้อมูลสายอนุมัติกลับไปโชว์ด้วย
    });
  }

  // 2. ดึงข้อมูลทั้งหมดของบริษัทนั้นๆ
  async findAll(companyId: number) {
    return this.prisma.wfModuleMapping.findMany({
      where: { companyId },
      include: { workflow: true },
      orderBy: { moduleCode: 'asc' },
    });
  }

  // 3. ดึงข้อมูลรายอัน
  async findOne(companyId: number, id: number) {
    const mapping = await this.prisma.wfModuleMapping.findFirst({
      where: { id, companyId },
      include: { workflow: true },
    });

    if (!mapping) throw new NotFoundException(`ไม่พบข้อมูล Mapping ID: ${id}`);
    return mapping;
  }

 
  // ฟังก์ชัน update ที่สมบูรณ์
async update(companyId: number, id: number, dto: UpdateWfModuleMappingDto) {
  // 1. เช็คว่ารายการมีอยู่จริงและเป็นของบริษัทนี้ไหม (findOne ทำหน้าที่นี้อยู่แล้ว)
  await this.findOne(companyId, id); 

  // 2. ถ้ามีการแก้ไข moduleCode และไม่มี condition ต้องเช็ค Duplicate ด้วย
  if (dto.moduleCode && !dto.condition) {
    const existing = await this.prisma.wfModuleMapping.findFirst({
      where: { 
        companyId, 
        moduleCode: dto.moduleCode, 
        condition: null,
        id: { not: id } // ต้องไม่ใช่รายการตัวเอง
      },
    });
    if (existing) {
      throw new ConflictException(`โมดูล ${dto.moduleCode} แบบไม่มีเงื่อนไขถูกใช้งานในรายการอื่นแล้ว`);
    }
  }

  // 3. ทำการอัปเดต
  return this.prisma.wfModuleMapping.update({
    where: { id },
    data: dto,
    include: { workflow: true }
  });
}

  // 5. ลบข้อมูล
  async remove(companyId: number, id: number) {
    await this.findOne(companyId, id); // เช็คว่ามีตัวตนจริง

    return this.prisma.wfModuleMapping.delete({
      where: { id },
    });
  }
}