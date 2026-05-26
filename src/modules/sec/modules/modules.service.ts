import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; 
import { CreateModuleDto, UpdateModuleDto } from './modules.dto';

@Injectable()
export class ModulesService {
  constructor(private prisma: PrismaService) {}

  // ============================================================================
  // 🛡️ Helper: ตรวจสอบสิทธิ์ (ต้องเป็น Super Admin หรืออยู่บริษัท HQ)
  // ============================================================================
  private async validateHqOrSuperAdmin(user: any) {
    // 1. ถ้ามีสถานะ Super Admin (God Mode) ให้ผ่านได้เลย
    if (user.isSuperAdmin) return true; 

    if (!user.companyId) {
      throw new ForbiddenException('ไม่พบข้อมูลบริษัทของคุณ');
    }

    // 2. ถ้าไม่ใช่ Super Admin ต้องเช็คว่าเป็นบริษัทสำนักงานใหญ่ (HQ) หรือไม่
    const company = await this.prisma.orgCompany.findUnique({
      where: { id: Number(user.companyId) },
      select: { licenseHolderId: true }
    });

    // ถ้า licenseHolderId ไม่ใช่ null แสดงว่าเป็นบริษัทลูก/ตัวแทน -> บล็อกทันที
    if (company?.licenseHolderId !== null) {
      throw new ForbiddenException('เฉพาะบริษัทสำนักงานใหญ่ (HQ) หรือ Super Admin เท่านั้นที่สามารถจัดการข้อมูลส่วนกลางได้');
    }
    
    return true;
  }

  async findAll(user: any, targetCompanyId?: number) {
    let providerCompanyId: number | null = null;

    if (targetCompanyId) {
      const targetComp = await this.prisma.orgCompany.findUnique({
        where: { id: targetCompanyId },
        select: { id: true, licenseHolderId: true }
      });
      if (!targetComp) throw new NotFoundException('ไม่พบข้อมูลบริษัทเป้าหมาย');

      // 🌟 หัวใจสำคัญที่แก้ปัญหา: ใครคือ "ผู้ขาย (Provider)" ตัวจริง?
      if (targetComp.licenseHolderId === null || targetComp.licenseHolderId === targetComp.id) {
        // ถ้าเป้าหมายคือ HQ (null) หรือเป็น ตัวแทนหัวหน้ากลุ่ม (licenseHolderId เป็น ID ตัวเอง)
        // แสดงว่าผู้ขายที่จ่ายโมดูลให้คนกลุ่มนี้ คือ HQ (ส่วนกลาง)
        providerCompanyId = null; 
      } else {
        // ถ้าเป็นลูกข่าย (licenseHolderId ชี้ไปที่บริษัทอื่น) -> ผู้ขายคือ "ตัวแทน"
        providerCompanyId = targetComp.licenseHolderId;
      }
    } else {
      providerCompanyId = Number(user.companyId);
    }

    // 🌟 2. เช็คว่า Provider คนนี้เป็น HQ หรือไม่
    let isHqProvider = false;
    if (providerCompanyId === null) {
      isHqProvider = true;
    } else {
      const providerComp = await this.prisma.orgCompany.findUnique({
        where: { id: providerCompanyId },
        select: { licenseHolderId: true }
      });
      if (providerComp?.licenseHolderId === null) {
        isHqProvider = true;
      }
    }

    // 🌟 3. ดึงข้อมูลโมดูลกลับไป
    if (isHqProvider) {
      // 🟢 ผู้ขายคือ HQ: เห็น Module ทั้งหมดในระบบ
      return this.prisma.sysModule.findMany({
        orderBy: { sortOrder: 'asc' }, 
        include: { _count: { select: { permissions: true, menus: true } } }
      });
    } else {
      // 🛡️ ผู้ขายคือ ตัวแทน: เห็นเฉพาะ Module ที่ตัวแทนซื้อมาแล้ว
      const activeSubs = await this.prisma.orgSubscription.findMany({
        where: { 
          companyId: providerCompanyId as number,
          status: 'ACTIVE' 
        },
        select: { moduleId: true }
      });

      const allowedModuleIds = activeSubs.map(sub => sub.moduleId);

      return this.prisma.sysModule.findMany({
        where: { id: { in: allowedModuleIds } },
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { permissions: true, menus: true } } }
      });
    }
  }

  async findOne(id: number) {
    const module = await this.prisma.sysModule.findUnique({
      where: { id },
      include: {
        permissions: true, 
        menus: true        
      }
    });
    if (!module) throw new NotFoundException(`Module ID ${id} not found`);
    return module;
  }

  async create(dto: CreateModuleDto, user: any) {
    await this.validateHqOrSuperAdmin(user); // 🛡️ ตรวจสิทธิ์ก่อนทำงาน

    const existing = await this.prisma.sysModule.findUnique({
      where: { code: dto.code }
    });
    if (existing) throw new ConflictException('รหัส Module นี้มีอยู่ในระบบแล้ว');

    return this.prisma.sysModule.create({ data: dto });
  }

  async update(id: number, dto: UpdateModuleDto, user: any) {
    await this.validateHqOrSuperAdmin(user); // 🛡️ ตรวจสิทธิ์ก่อนทำงาน

    const module = await this.prisma.sysModule.findUnique({ where: { id } });
    if (!module) throw new NotFoundException(`ไม่พบข้อมูล Module ID ${id}`);

    if (dto.code && dto.code !== module.code) {
      const existing = await this.prisma.sysModule.findUnique({
        where: { code: dto.code }
      });
      if (existing) throw new ConflictException('รหัส Module นี้มีอยู่ในระบบแล้ว');
    }

    return this.prisma.sysModule.update({
      where: { id },
      data: dto
    });
  }

  async remove(id: number, user: any) {
    await this.validateHqOrSuperAdmin(user); // 🛡️ ตรวจสิทธิ์ก่อนทำงาน

    const module = await this.prisma.sysModule.findUnique({
      where: { id },
      include: {
        _count: {
          select: { permissions: true, menus: true }
        }
      }
    });

    if (!module) throw new NotFoundException(`ไม่พบข้อมูล Module ID ${id}`);

    // 🛡️ ป้องกันการลบโมดูลที่มีข้อมูลเชื่อมโยงอยู่
    if (module._count.permissions > 0 || module._count.menus > 0) {
      throw new BadRequestException(`ไม่สามารถลบโมดูลได้ เนื่องจากมีสิทธิ์ (${module._count.permissions}) หรือเมนู (${module._count.menus}) ผูกอยู่`);
    }

    return this.prisma.sysModule.delete({ where: { id } });
  }
}