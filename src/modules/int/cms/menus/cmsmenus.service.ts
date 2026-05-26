import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service'; // ปรับ path ตามโครงสร้างจริง
import { CreateMenuDto } from './dto/create-cmsmenu.dto';

@Injectable()
export class CmsMenusService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 1. สร้างเมนูใหม่ (รองรับฟิลด์ Mega Menu อัตโนมัติ)
  // =========================================================
  async create(companyId: number, dto: CreateMenuDto) {
    return this.prisma.cmsMenu.create({
      data: { ...dto, companyId },
    });
  }

  // =========================================================
  // 2. ดึงข้อมูลแบบโครงสร้างต้นไม้ (Tree) สำหรับหน้าบ้านเอาไปโชว์ Navbar
  // =========================================================
  async findTree(companyId: number) {
    const allMenus = await this.prisma.cmsMenu.findMany({
      where: { companyId },
      orderBy: { sortOrder: 'asc' }, // เรียงตามลำดับที่ลาก (Drag & Drop) ไว้
    });

    // ลอจิกแปลงข้อมูลแบนๆ ให้กลายเป็น Tree (เมนูหลัก -> เมนูย่อย)
    const menuMap = new Map();
    const tree: any[] = [];

    // จำลองโครงสร้างรอไว้ก่อน
    allMenus.forEach((menu) => {
      menuMap.set(menu.id, { ...menu, children: [] });
    });

    // จับเมนูย่อยยัดเข้าไปใน children ของเมนูหลัก
    allMenus.forEach((menu) => {
      if (menu.parentId) {
        const parent = menuMap.get(menu.parentId);
        if (parent) parent.children.push(menuMap.get(menu.id));
      } else {
        tree.push(menuMap.get(menu.id));
      }
    });

    return tree;
  }

  // =========================================================
  // 3. ฟังก์ชันสำหรับเซฟลำดับใหม่ (ตอนแอดมินลาก Drag & Drop)
  // =========================================================
  async updateBulkOrder(companyId: number, items: { id: number; sortOrder: number; parentId: number | null }[]) {
    return this.prisma.$transaction(
      items.map((item) =>
        this.prisma.cmsMenu.updateMany({
          where: { id: item.id, companyId }, // ป้องกันการเผลอไปแก้ข้อมูลของบริษัทอื่น
          data: { sortOrder: item.sortOrder, parentId: item.parentId },
        })
      )
    );
  }

  // =========================================================
  // 4. ลบเมนู (Cascade Delete จะลบเมนูย่อยที่อยู่ข้างใต้ทิ้งให้อัตโนมัติ)
  // =========================================================
  async remove(id: number, companyId: number) {
    return this.prisma.cmsMenu.deleteMany({
      where: { id, companyId },
    });
  }
}