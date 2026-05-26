import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateMenuConfigDto } from './menu-configs.dto';

@Injectable()
export class MenuConfigsService {
  constructor(private prisma: PrismaService) {}

  // 1. ดึง Shortcut สำหรับแสดงบน Dashboard
  async findShortcuts(companyId: number) {
    const configs = await this.prisma.secCompanyMenuConfig.findMany({
      where: {
        companyId,
        isShortcut: true, // ✅ เอาเฉพาะที่ติ๊กเป็น Shortcut
      },
      include: {
        menu: true, // Join เอา Path กับ Icon เดิมมาด้วย
      },
      orderBy: {
        sortOrder: 'asc', // เรียงตามที่บริษัทตั้ง (ถ้ามี)
      },
    });

    // Map ข้อมูลให้ Frontend ใช้ง่ายๆ
    return configs.map(cfg => ({
      id: cfg.menuId,
      name: cfg.customLabel || cfg.menu.name, // ถ้ามีชื่อตั้งเอง ให้ใช้ชื่อตั้งเอง
      path: cfg.menu.path,
      icon: cfg.customIcon || cfg.menu.icon,
      type: 'shortcut'
    }));
  }

  // 2. บันทึก/แก้ไข Config ของเมนู
  async upsertConfig(companyId: number, menuId: number, dto: UpdateMenuConfigDto) {
    // 🛡️ เช็คก่อนว่าเมนูหลักในระบบ (secMenu) มีอยู่จริงไหม ป้องกัน Database Error 500
    const menuExists = await this.prisma.secMenu.findUnique({
      where: { id: menuId }
    });
    
    if (!menuExists) {
      throw new NotFoundException(`ไม่พบเมนูระบบ (ID: ${menuId}) ที่ต้องการตั้งค่า`);
    }

    // ทำการสร้างใหม่ หรือ อัปเดตข้อมูล (Upsert) อย่างปลอดภัยภายใต้ขอบเขต companyId
    return this.prisma.secCompanyMenuConfig.upsert({
      where: {
        companyId_menuId: {
          companyId,
          menuId,
        },
      },
      update: {
        customLabel: dto.customLabel,
        customIcon: dto.customIcon,
        sortOrder: dto.sortOrder,
        showInSidebar: dto.showInSidebar,
        showInNavbar: dto.showInNavbar,
        isShortcut: dto.isShortcut,
      },
      create: {
        companyId,
        menuId,
        customLabel: dto.customLabel,
        customIcon: dto.customIcon,
        sortOrder: dto.sortOrder,
        showInSidebar: dto.showInSidebar ?? true,
        showInNavbar: dto.showInNavbar ?? false,
        isShortcut: dto.isShortcut ?? false,
      },
    });
  }
}