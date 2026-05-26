import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll(queryCompanyId: number | undefined, currentUser: any) {
    const userId = Number(currentUser.userId || currentUser.sub);

    // 🌟 1. หาว่าคนคนนี้มีสิทธิ์อยู่ในบริษัทไหนบ้าง
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId: userId },
      include: { company: true, role: true }
    });

    const directCompanyIds = userRoles.map(ur => ur.companyId).filter(id => id !== null) as number[];

    // 🌟 2. แยกแยะสิทธิ์: เช็คว่าเป็น HQ ของแท้หรือไม่?
    const isHQ = userRoles.some(ur => ur.company?.licenseHolderId === null);
    const hasSuperAdminRole = userRoles.some(ur => ur.role?.name?.toUpperCase() === 'SUPER_ADMIN');
    const isGlobalAdmin = isHQ && hasSuperAdminRole;

    // 🌟 3. หาขอบเขตบริษัทที่อนุญาตให้ดูได้ (Licensed Group)
    let allowedCompanyIds: number[] = [];

    if (!isGlobalAdmin) {
      const directCompanies = await this.prisma.orgCompany.findMany({
        where: { id: { in: directCompanyIds } },
        select: { id: true, licenseHolderId: true }
      });

      const rootIds = Array.from(new Set(directCompanies.map(c => c.licenseHolderId || c.id)));

      const networkCompanies = await this.prisma.orgCompany.findMany({
         where: {
           OR: [
             { id: { in: rootIds } },
             { licenseHolderId: { in: rootIds } },
             { parentId: { in: directCompanyIds } }
           ]
         },
         select: { id: true }
      });

      allowedCompanyIds = networkCompanies.map(c => c.id);
    }

    // 🌟 4. สร้างเงื่อนไขการดึงข้อมูล (Where)
    const whereCondition: any = { OR: [] };
    
    // 4.1 Role ของระบบส่วนกลางจริงๆ ต้องติดมาให้ดูเสมอ (แต่ห้ามลบ/แก้)
    whereCondition.OR.push({ AND: [{ isSystem: true }, { companyId: null }] });

    if (queryCompanyId) {
      // 🔹 กรณีเลือก 1 บริษัท
      const targetIds = (!isGlobalAdmin && !allowedCompanyIds.includes(queryCompanyId)) 
          ? allowedCompanyIds  // ถ้าแอบดูคนอื่น บังคับให้ดูเฉพาะเครือตัวเอง
          : [queryCompanyId];
      
      whereCondition.OR.push({ companyId: { in: targetIds } });
      whereCondition.OR.push({ users: { some: { companyId: { in: targetIds } } } });

    } else {
      // 🔹 กรณีเลือก "All Companies"
      if (!isGlobalAdmin) {
          whereCondition.OR.push({ companyId: { in: allowedCompanyIds } });
          whereCondition.OR.push({ users: { some: { companyId: { in: allowedCompanyIds } } } });
      } else {
          // ถ้าเป็น Global Admin ของ HQ จะลบเงื่อนไข OR ออกทั้งหมด (แปลว่าดึงทุก Role ทั้งระบบ)
          delete whereCondition.OR; 
      }
    }

    // 🌟 5. ดึงข้อมูล
    return this.prisma.secRole.findMany({
      where: whereCondition,
      include: {
        permissions: { include: { permission: true } },
        menus: { include: { menu: true } },
        _count: { select: { users: true } },
        company: { select: { name: true } } // 🌟 ดึงชื่อบริษัทไปเผื่อให้หน้าบ้านโชว์ด้วย
      }
    });
  }

  async updateRoleMenus(roleId: number, menuIds: number[]) {
  return this.prisma.$transaction(async (tx) => {
    // 1. ตรวจสอบว่า Role มีอยู่จริงหรือไม่
    await this.findOne(roleId); 

    // 2. ลบความสัมพันธ์เมนูเดิมทั้งหมดของ Role นี้
    await tx.secRoleMenu.deleteMany({ 
      where: { roleId: roleId } 
    });

    // 3. สร้างความสัมพันธ์ใหม่ตามรายการ id ที่ส่งมา
    return tx.secRole.update({
      where: { id: roleId },
      data: {
        menus: {
          create: menuIds.map(menuId => ({ menuId }))
        }
      },
      include: { menus: { include: { menu: true } } }
    });
  });
  }

  async findOne(id: number) {
    const role = await this.prisma.secRole.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        menus: { include: { menu: true } }
      }
    });
    if (!role) throw new NotFoundException(`Role ID ${id} not found`);
    return role;
  }

  // ✅ เพิ่มฟังก์ชันนี้: ดึงรายชื่อ User ที่มี Role นี้
  async getUsersByRole(roleId: number) {
    return this.prisma.secUserRole.findMany({
      where: { roleId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            isActive: true,
            avatarUrl: true
          }
        }
      }
    });
  }

  async create(dto: CreateRoleDto) {
    const { permissionIds, menuIds, ...roleData } = dto;
    
    return this.prisma.secRole.create({
      data: {
        ...roleData,
        permissions: {
          create: permissionIds?.map(id => ({ permissionId: id })) 
        },
        menus: {
          create: menuIds?.map(id => ({ menuId: id }))
        }
      },
      include: { permissions: true, menus: true }
    });
  }

  async update(id: number, dto: UpdateRoleDto) {
    const { permissionIds, menuIds, ...roleData } = dto;

    return this.prisma.$transaction(async (tx) => {
      await this.findOne(id); // Check exists

      // ลบความสัมพันธ์เดิม
      if (permissionIds) {
        await tx.secRolePermission.deleteMany({ where: { roleId: id } });
      }
      if (menuIds) {
        await tx.secRoleMenu.deleteMany({ where: { roleId: id } });
      }

      // อัปเดตข้อมูลใหม่
      return tx.secRole.update({
        where: { id },
        data: {
          ...roleData,
          permissions: permissionIds ? {
            create: permissionIds.map(permId => ({ permissionId: permId }))
          } : undefined,
          menus: menuIds ? {
            create: menuIds.map(menuId => ({ menuId }))
          } : undefined
        },
        include: { permissions: true, menus: true }
      });
    });
  }

  async remove(id: number) {
    const role = await this.findOne(id);
    if (role.isSystem) throw new Error('Cannot delete system roles');
    return this.prisma.secRole.delete({ where: { id } });
  }
}