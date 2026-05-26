import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './department.dto';

@Injectable()
export class DepartmentService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 1. สร้างแผนกใหม่
  // =========================================================
  async createDepartment(dto: CreateDepartmentDto) {
    if (!dto.companyId) {
      throw new BadRequestException('Company ID is required');
    }
    const companyId = dto.companyId;

    const existing = await this.prisma.hrDepartment.findUnique({
      where: {
        companyId_code: { companyId, code: dto.code },
      },
    });

    if (existing) {
      throw new ConflictException(`รหัสแผนก '${dto.code}' มีอยู่แล้วในระบบ`);
    }

    return this.prisma.hrDepartment.create({
      data: {
        companyId: companyId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        parentId: dto.parentId || null,
        sortOrder: dto.sortOrder || 0,
        allowedPositions: dto.positions && dto.positions.length > 0 ? {
          create: dto.positions.map(p => ({
            companyId: companyId, // 🌟 เพิ่ม companyId ตามที่ Prisma ร้องขอ
            positionId: p.positionId,
            maxHeadcount: p.maxHeadcount
          }))
        } : undefined
      },
    });
  }

  // =========================================================
  // 2. ดึงทั้งหมด (พร้อมรองรับการประกอบ Tree)
  // =========================================================
  async getAllDepartments(companyId: number, withTree: boolean = false) {
    const departments = await this.prisma.hrDepartment.findMany({
      where: { companyId },
      include: {
        allowedPositions: {
          include: { position: true }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    if (withTree) {
      return this.buildTree(departments);
    }
    return departments;
  }

  private buildTree(departments: any[], parentId: number | null = null): any[] {
    return departments
      .filter(dept => dept.parentId === parentId)
      .map(dept => ({
        ...dept,
        children: this.buildTree(departments, dept.id)
      }));
  }

  // =========================================================
  // 3. ดึงรายข้อมูลแผนกเดียว
  // =========================================================
  async getDepartmentById(companyId: number, id: number) {
    const dept = await this.prisma.hrDepartment.findFirst({
      where: { id, companyId },
      include: {
        parent: true,
        children: {
          orderBy: { sortOrder: 'asc' }
        },
        _count: {
          select: { employees: true }
        },
        allowedPositions: {
          include: { position: true }
        }
      },
    });

    if (!dept) {
      throw new NotFoundException(`ไม่พบข้อมูลแผนก ID: ${id}`);
    }
    return dept;
  }

  // =========================================================
  // 4. แก้ไขแผนกปกติ
  // =========================================================
  async updateDepartment(companyId: number, id: number, dto: UpdateDepartmentDto) {
    if (dto.parentId === id) {
      throw new ConflictException('ไม่สามารถตั้งค่าแผนกหลักเป็นตัวมันเองได้');
    }

    if (dto.code) {
      const existing = await this.prisma.hrDepartment.findFirst({
        where: { 
          companyId, 
          code: dto.code,
          id: { not: id }
        }
      });
      if (existing) {
        throw new ConflictException(`รหัสแผนก '${dto.code}' มีการใช้งานแล้วในระบบ`);
      }
    }

    return this.prisma.hrDepartment.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        parentId: dto.parentId !== undefined ? dto.parentId : undefined,
        sortOrder: dto.sortOrder,
        allowedPositions: dto.positions !== undefined ? {
          deleteMany: {}, 
          create: dto.positions.map(p => ({
            companyId: companyId, // 🌟 เพิ่ม companyId
            positionId: p.positionId,
            maxHeadcount: p.maxHeadcount
          }))
        } : undefined
      },
    });
  }

  // =========================================================
  // 5. อัปเดตโครงสร้าง Tree (เปลี่ยน parentId และ sortOrder ทีละหลายตัว)
  // =========================================================
  async updateDepartmentTree(companyId: number, updates: { id: number; parentId?: number; sortOrder: number }[]) {
    return this.prisma.$transaction(
      updates.map(update =>
        this.prisma.hrDepartment.update({
          where: { id: update.id, companyId },
          data: {
            parentId: update.parentId || null,
            sortOrder: update.sortOrder,
          },
        })
      )
    );
  }

  // =========================================================
  // 6. ลบ (Delete) พร้อมเงื่อนไขใหม่
  // =========================================================
  async deleteDepartment(companyId: number, id: number) {
    const dept = await this.prisma.hrDepartment.findFirst({
      where: { id, companyId },
      include: { 
        employees: true, 
        children: true   
      }
    });
    
    if (!dept) throw new NotFoundException('ไม่พบแผนกที่ต้องการลบ');

    if (dept.employees && dept.employees.length > 0) {
       throw new BadRequestException(`ไม่สามารถลบแผนกได้ เนื่องจากมีพนักงานสังกัดอยู่ (${dept.employees.length} คน)`);
    }

    if (dept.children && dept.children.length > 0) {
      await this.prisma.hrDepartment.updateMany({
        where: { parentId: id },
        data: { parentId: null }
      });
    }

    return this.prisma.hrDepartment.delete({ 
      where: { id } 
    });
  }

  // =========================================================
  // 7. อัปเดตเฉพาะอัตรากำลัง (Positions/Headcount) ในแผนก
  // =========================================================
  async updateDepartmentPositions(
    companyId: number, 
    departmentId: number, 
    positions: any[] 
  ) {
    await this.getDepartmentById(companyId, departmentId);

    const safePositions = Array.isArray(positions) ? positions : [];

    return this.prisma.hrDepartment.update({
      where: { id: departmentId },
      data: {
        allowedPositions: {
          deleteMany: {}, 
          create: safePositions.map(p => ({
            companyId: companyId, // 🌟 เพิ่ม companyId
            positionId: Number(p.positionId), 
            maxHeadcount: p.maxHeadcount ? Number(p.maxHeadcount) : null 
          }))
        }
      }
    });
  }

  // =========================================================
  // 8. ดึงข้อมูลอัตรากำลัง (Positions) ของแผนก
  // =========================================================
  async getDepartmentPositions(companyId: number, departmentId: number) {
    const dept = await this.prisma.hrDepartment.findFirst({
      where: { id: departmentId, companyId },
      include: {
        allowedPositions: {
          include: { position: true }
        }
      }
    });

    if (!dept) {
      throw new NotFoundException('ไม่พบข้อมูลแผนก');
    }

    return dept.allowedPositions;
  }
}