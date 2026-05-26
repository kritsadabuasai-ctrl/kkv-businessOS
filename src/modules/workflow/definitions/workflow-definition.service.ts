import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWorkflowDefinitionDto, UpdateWorkflowDefinitionDto } from './workflow-definition.dto';

@Injectable()
export class WorkflowDefinitionService {
  constructor(private prisma: PrismaService) {}

  // ✅ สร้าง Workflow (ผูกกับบริษัทและรองรับฟิลด์ใหม่)
  async create(companyId: number, dto: CreateWorkflowDefinitionDto) {
    // ตรวจสอบ Code ซ้ำภายในบริษัทเดียวกัน (ตาม @@unique ใน Schema)
    const existing = await this.prisma.wfDefinition.findFirst({
      where: { 
        companyId, 
        code: dto.code 
      },
    });

    if (existing) {
      throw new ConflictException(`รหัส Workflow '${dto.code}' มีการใช้งานแล้วในบริษัทนี้`);
    }

    return this.prisma.wfDefinition.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  // ✅ ดึงทั้งหมด (เรียงตามวันที่สร้างล่าสุด)
  async findAll(companyId: number, isActiveOnly: boolean = false) {
    return this.prisma.wfDefinition.findMany({
      where: {
        companyId, 
        ...(isActiveOnly ? { isActive: true } : {}),
      },
      include: {
        _count: {
          select: { nodes: true } // นับจำนวนขั้นตอนที่มีในแต่ละสาย
        }
      },
      // 🌟 ใช้ createdAt ที่เพิ่มใหม่ในการเรียงลำดับ
      orderBy: { createdAt: 'desc' } 
    });
  }

  // ✅ ดึงรายละเอียด (เช็คความเป็นเจ้าของ)
  async findOne(id: number, companyId: number) {
    const definition = await this.prisma.wfDefinition.findFirst({
      where: { id, companyId },
      include: {
        nodes: {
          orderBy: { stepOrder: 'asc' }
        }
      }
    });

    if (!definition) {
      throw new NotFoundException(`ไม่พบข้อมูล Workflow ID ${id} หรือคุณไม่มีสิทธิ์เข้าถึง`);
    }

    return definition;
  }

  // ✅ แก้ไขข้อมูล (รองรับฟิลด์ใหม่)
  async update(id: number, companyId: number, dto: UpdateWorkflowDefinitionDto) {
    await this.findOne(id, companyId); // ตรวจสอบสิทธิ์ก่อนแก้ไข

    // ถ้ามีการเปลี่ยน Code ต้องเช็คว่าไปซ้ำกับอันอื่นในบริษัทเดียวกันไหม
    if (dto.code) {
      const duplicate = await this.prisma.wfDefinition.findFirst({
        where: { 
          companyId,
          code: dto.code,
          NOT: { id }
        },
      });
      if (duplicate) {
        throw new ConflictException(`ไม่สามารถใช้รหัส '${dto.code}' ได้ เนื่องจากถูกใช้งานแล้ว`);
      }
    }

    return this.prisma.wfDefinition.update({
      where: { id },
      data: dto,
    });
  }

  // ✅ ลบสายอนุมัติ
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId); // ตรวจสอบสิทธิ์ก่อน

    try {
      return await this.prisma.wfDefinition.delete({
        where: { id },
      });
    } catch (error: any) {
      // ป้องกันการลบสายอนุมัติที่ยังมีการใช้งานค้างอยู่ใน WfRequest
      if (error.code === 'P2003') {
        throw new BadRequestException('ไม่สามารถลบได้: มีรายการคำขอที่กำลังใช้งานสายอนุมัตินี้อยู่');
      }
      throw error;
    }
  }
}