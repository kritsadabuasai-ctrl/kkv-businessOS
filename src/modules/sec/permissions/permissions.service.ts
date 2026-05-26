import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePermissionDto, UpdatePermissionDto } from './permissions.dto';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.secPermission.findMany({
      include: { module: true }, // ✅ ดึงข้อมูล Module มาแสดงผล
      orderBy: [
        { resource: 'asc' },   // ✅ เรียงตามทรัพยากร (เช่น company ก่อน user)
        { action: 'asc' }      // ✅ เรียงตามการกระทำ (เช่น create ก่อน view)
      ]
    });
  }

  async create(dto: CreatePermissionDto) {
    // ตรวจสอบ Resource + Action ซ้ำ
    const existing = await this.prisma.secPermission.findUnique({
      where: {
        resource_action: {
          resource: dto.resource,
          action: dto.action
        }
      }
    });
    if (existing) throw new ConflictException('สิทธิ์นี้มีอยู่ในระบบแล้ว');

    return this.prisma.secPermission.create({ data: dto });
  }

  async update(id: number, dto: UpdatePermissionDto) {
    return this.prisma.secPermission.update({
      where: { id },
      data: dto
    });
  }

  // =========================================================
  // 🛡️ Helper: ฟังก์ชันตรวจสอบสิทธิ์ความเป็นเจ้าของ Role (ป้องกัน IDOR)
  // =========================================================
  private async verifyRoleOwnership(roleId: number, companyId: number, isSuperAdmin: boolean) {
    const role = await this.prisma.secRole.findUnique({
      where: { id: roleId }
    });

    if (!role) {
      throw new NotFoundException('ไม่พบบทบาท (Role) ที่ระบุ');
    }

    // ถ้าไม่ใช่ Super Admin และพยายามยุ่งกับ Role ที่ไม่ใช่ของบริษัทตัวเอง
    if (!isSuperAdmin && role.companyId !== companyId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์จัดการสิทธิ์ของบทบาทในบริษัทอื่น');
    }

    return role;
  }

  // =========================================================
  // ✅ การทำงานหลัก: ผูก/ยกเลิกสิทธิ์
  // =========================================================

  // การผูกสิทธิ์เข้ากับ Role (Junction Table)
  async assignToRole(roleId: number, permissionId: number, companyId: number, isSuperAdmin: boolean) {
    // 🛡️ 1. ตรวจสอบสิทธิ์ก่อน
    await this.verifyRoleOwnership(roleId, companyId, isSuperAdmin);

    // 2. ถ้าผ่าน ให้ทำรายการ
    return this.prisma.secRolePermission.upsert({
      where: {
        roleId_permissionId: { roleId, permissionId }
      },
      update: {},
      create: { roleId, permissionId }
    });
  }

  // การยกเลิกสิทธิ์ออกจาก Role
  async removeFromRole(roleId: number, permissionId: number, companyId: number, isSuperAdmin: boolean) {
    // 🛡️ 1. ตรวจสอบสิทธิ์ก่อน
    await this.verifyRoleOwnership(roleId, companyId, isSuperAdmin);

    // 2. ถ้าผ่าน ให้ทำรายการ
    return this.prisma.secRolePermission.delete({
      where: {
        roleId_permissionId: { roleId, permissionId }
      }
    });
  }

  async remove(id: number) {
    const perm = await this.prisma.secPermission.findUnique({ where: { id } });
    if (!perm) throw new NotFoundException('ไม่พบสิทธิ์ที่ต้องการลบ');
    
    return this.prisma.secPermission.delete({ where: { id } });
  }
}