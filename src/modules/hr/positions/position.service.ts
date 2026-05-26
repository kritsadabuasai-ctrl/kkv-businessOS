import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePositionDto, UpdatePositionDto } from './position.dto';

@Injectable()
export class PositionService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 1. สร้างตำแหน่งงานใหม่
  // =========================================================
  async createPosition(dto: CreatePositionDto) {
    if (!dto.companyId) {
      throw new BadRequestException('Company ID is required');
    }
    const companyId = dto.companyId;

    const existing = await this.prisma.hrPosition.findUnique({
      where: {
        companyId_code: { companyId, code: dto.code },
      },
    });

    if (existing) {
      throw new ConflictException(`รหัสตำแหน่ง '${dto.code}' มีใช้งานอยู่แล้วในระบบ`);
    }

    return this.prisma.hrPosition.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        level: dto.level || 1, 
      },
    });
  }

  // =========================================================
  // 2. ดึงทั้งหมด (List)
  // =========================================================
  async getAllPositions(companyId: number) {
    return this.prisma.hrPosition.findMany({
      where: { companyId },
      include: {
        _count: { select: { employees: true } }
      },
      orderBy: { level: 'asc' }, 
    });
  }

  // =========================================================
  // 3. ดึงตาม ID (Detail)
  // =========================================================
  async getPositionById(companyId: number, id: number) {
    const position = await this.prisma.hrPosition.findFirst({
      where: { id, companyId },
      include: {
        employees: {
            select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                status: true,
                department: { select: { name: true } }
            },
            orderBy: { employeeCode: 'asc' }
        }
      }
    });

    if (!position) {
      throw new NotFoundException(`ไม่พบตำแหน่งงาน (ID: ${id}) ในระบบ`);
    }

    return position;
  }

  // =========================================================
  // 4. แก้ไขข้อมูล (Update)
  // =========================================================
  async updatePosition(companyId: number, id: number, dto: UpdatePositionDto) {
    await this.getPositionById(companyId, id); // เช็คสิทธิ์และตรวจสอบว่ามีข้อมูลก่อน

    // 🛡️ เช็คว่า Code ที่จะเปลี่ยนไปซ้ำกับตำแหน่งอื่นในบริษัทตัวเองหรือไม่
    if (dto.code) {
      const existing = await this.prisma.hrPosition.findFirst({
        where: { 
          companyId, 
          code: dto.code,
          id: { not: id } // ไม่เช็คซ้ำกับตัวเอง
        }
      });
      if (existing) {
        throw new ConflictException(`รหัสตำแหน่ง '${dto.code}' มีการใช้งานแล้วในระบบ`);
      }
    }

    return this.prisma.hrPosition.update({
      where: { id },
      data: dto,
    });
  }

  // =========================================================
  // 5. ลบข้อมูล (Delete)
  // =========================================================
  async deletePosition(companyId: number, id: number) {
    const position = await this.prisma.hrPosition.findFirst({
        where: { id, companyId },
        include: { _count: { select: { employees: true } } }
    });

    if (!position) {
        throw new NotFoundException(`ไม่พบตำแหน่งงาน (ID: ${id}) ในระบบ`);
    }

    // 🛡️ ถ้ามีคนครองตำแหน่งอยู่ ห้ามลบ! (อันนี้คุณกฤษฎาเขียนมาได้เยี่ยมมากครับ)
    if (position._count.employees > 0) {
        throw new BadRequestException(`ไม่สามารถลบตำแหน่ง '${position.name}' ได้ เนื่องจากมีพนักงานใช้งานอยู่ ${position._count.employees} คน`);
    }
    
    return this.prisma.hrPosition.delete({
      where: { id },
    });
  }
}