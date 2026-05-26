import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AddPackageModuleDto } from './package-modules.dto';

@Injectable()
export class PackageModulesService {
  constructor(private prisma: PrismaService) {}

  // ============================================================================
  // 🛡️ Helper: ตรวจสอบสิทธิ์ว่ามีสิทธิ์แก้ไขแพ็กเกจนี้หรือไม่?
  // ============================================================================
  private async validatePackageOwnership(packageId: number, user: any) {
    // 1. ถ้ามีสถานะ Super Admin (God Mode) ให้ผ่านได้เลย
    if (user.isSuperAdmin) return true;

    // 2. หาข้อมูลแพ็กเกจที่ต้องการจะแก้
    const pkg = await this.prisma.sysPackage.findUnique({
      where: { id: packageId }
    });
    if (!pkg) throw new NotFoundException(`ไม่พบข้อมูล Package ID ${packageId}`);

    // 3. หาข้อมูลบริษัทของคนที่ Login เข้ามาว่าเป็น HQ หรือตัวแทน
    const company = await this.prisma.orgCompany.findUnique({
      where: { id: Number(user.companyId) },
      select: { licenseHolderId: true }
    });

    const isHq = company?.licenseHolderId === null;

    // 4. ตัดสินสิทธิ์: 
    // ถ้าไม่ใช่ HQ (แปลว่าเป็นตัวแทน) ตัวแทนจะมีสิทธิ์แก้ได้ "เฉพาะแพ็กเกจของตัวเอง" เท่านั้น
    if (!isHq) {
      if (pkg.companyId === null || pkg.companyId !== Number(user.companyId)) {
        throw new ForbiddenException('คุณไม่มีสิทธิ์จัดการส่วนประกอบของแพ็กเกจนี้ (เนื่องจากไม่ใช่แพ็กเกจของบริษัทคุณ)');
      }
    }

    return pkg;
  }

  // ============================================================================

  // เพิ่ม Module เข้าไปใน Package
  async add(dto: AddPackageModuleDto, user: any) {
    // 🛡️ 1. ตรวจสิทธิ์ก่อนเลย
    await this.validatePackageOwnership(dto.packageId, user);

    // 2. เช็คว่ามี Module จริงไหม
    const mod = await this.prisma.sysModule.findUnique({ where: { id: dto.moduleId } });
    if (!mod) throw new NotFoundException(`ไม่พบข้อมูล Module ID ${dto.moduleId}`);

    // 3. เช็คว่าซ้ำไหม
    const existing = await this.prisma.sysPackageModule.findUnique({
      where: {
        packageId_moduleId: {
          packageId: dto.packageId,
          moduleId: dto.moduleId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Module นี้อยู่ใน Package นี้อยู่แล้ว');
    }

    // 4. บันทึก
    return this.prisma.sysPackageModule.create({
      data: {
        packageId: dto.packageId,
        moduleId: dto.moduleId,
      },
      include: { module: true }, 
    });
  }

  // ดึงรายชื่อ Module ทั้งหมดใน Package หนึ่งๆ (ไม่ต้องตรวจสิทธิ์ เพราะดึงไปดูเฉยๆ)
  async findByPackage(packageId: number) {
    return this.prisma.sysPackageModule.findMany({
      where: { packageId },
      include: {
        module: true, 
      },
    });
  }

  // ลบ Module ออกจาก Package
  async remove(packageId: number, moduleId: number, user: any) {
    // 🛡️ 1. ตรวจสิทธิ์ก่อนลบทิ้ง
    await this.validatePackageOwnership(packageId, user);

    try {
      return await this.prisma.sysPackageModule.delete({
        where: {
          packageId_moduleId: {
            packageId: packageId,
            moduleId: moduleId,
          },
        },
      });
    } catch (error) {
      throw new NotFoundException('ไม่พบข้อมูลการจับคู่นี้ในระบบ');
    }
  }
}