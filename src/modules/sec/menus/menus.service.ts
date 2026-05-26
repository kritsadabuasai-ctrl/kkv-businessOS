import { Injectable, NotFoundException, BadRequestException ,ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMenuDto, UpdateMenuDto } from './menus.dto';

@Injectable()
export class MenusService {
  constructor(private prisma: PrismaService) {}

  // ============================================================================
  // 🌟 Helper: เช็คว่าเป็น HQ (บริษัทเจ้าของระบบ) หรือไม่
  // ============================================================================
  private async isHqCompany(companyId: number): Promise<boolean> {
    const company = await this.prisma.orgCompany.findUnique({
      where: { id: companyId },
      select: { licenseHolderId: true }
    });
    return company?.licenseHolderId === null; // ถ้าเป็น null แปลว่าเป็น HQ
  }

  // ============================================================================
  // 1. ดึงเมนูแบบ Tree Structure พร้อมระบบ Security & Multi-Tenant
  // ============================================================================
  async findAllTree(targetCompanyId: number, reqUser: any) {
    // 🛡️ SECURITY CHECK: ถ้าไม่ใช่ HQ และพยายามขอดูเมนูของบริษัทอื่น -> เตะออก
    if (targetCompanyId !== reqUser.companyId && !reqUser.isSuperAdmin) {
      const isHq = await this.isHqCompany(reqUser.companyId);
      if (!isHq) {
         throw new ForbiddenException('ไม่มีสิทธิ์จัดการเมนูของบริษัทอื่น');
      }
    }

    // 1.1 ดึงรายการเมนูทั้งหมด พร้อม Config ของบริษัทนี้ (targetCompanyId)
    const allMenus = await this.prisma.secMenu.findMany({
      include: {
        module: { select: { id: true, code: true } },
        securityConfigs: { where: { companyId: targetCompanyId } },
        displayConfigs: { where: { companyId: targetCompanyId }, take: 1 }
      },
      orderBy: { sortOrder: 'asc' }
    });

    // 1.2 ดึงสิทธิ์การเช่าใช้งาน (Subscription)
    const activeSubs = await this.prisma.orgSubscription.findMany({
      where: {
        companyId: targetCompanyId, // ใช้ targetCompanyId
        status: 'ACTIVE',
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } }
        ]
      },
      select: { moduleId: true }
    });

    const allowedModuleIds = new Set(activeSubs.map(s => s.moduleId));

    // 1.3 ประมวลผล: Filter & Merge Config
    const processedMenus = allMenus.reduce((acc: any[], menu) => {
      // Logic A: กรอง Module (ถ้ามี Module ผูกอยู่ และบริษัทไม่ได้ Subscribe ให้ข้ามไป)
      if (menu.moduleId && !allowedModuleIds.has(menu.moduleId)) {
        return acc;
      }

      // Logic B: Merge Config เฉพาะของบริษัทนั้นๆ
      const userConfig = menu.displayConfigs[0];

      const mergedMenu = {
        id: menu.id,
        name: userConfig?.customLabel || menu.name,
        path: menu.path,
        icon: userConfig?.customIcon || menu.icon,
        parentId: menu.parentId,
        moduleId: menu.moduleId,
        sortOrder: userConfig?.sortOrder ?? menu.sortOrder,
        isVisible: userConfig ? userConfig.showInSidebar : menu.isVisible,
        isSystem: menu.isSystem,
        isShortcut: userConfig?.isShortcut || false,
        showInNavbar: userConfig?.showInNavbar || false,
        security: menu.securityConfigs[0] ? {
          requireReAuth: menu.securityConfigs[0].requireReAuth,
          requireMfa: menu.securityConfigs[0].requireMfa
        } : null,
        children: []
      };

      // ถ้าเมนูถูกตั้งให้มองเห็นได้ จึงจะนำไปใส่ใน Tree
      if (mergedMenu.isVisible) {
        acc.push(mergedMenu);
      }

      return acc;
    }, [] as any[]);

    // 1.4 เรียงลำดับใหม่ตาม sortOrder
    processedMenus.sort((a, b) => a.sortOrder - b.sortOrder);

    // 1.5 ประกอบร่างเป็น Tree
    return this.buildTree(processedMenus);
  }

  // ============================================================================
  // 2. CRUD พื้นฐาน
  // ============================================================================

  async findOne(id: number) {
    const menu = await this.prisma.secMenu.findUnique({
      where: { id },
      include: { module: true }
    });
    if (!menu) throw new NotFoundException(`Menu ID ${id} not found`);
    return menu;
  }

  async create(dto: CreateMenuDto) {
    return this.prisma.secMenu.create({ data: dto });
  }

  async update(id: number, dto: UpdateMenuDto) {
    await this.findOne(id);
    return this.prisma.secMenu.update({
      where: { id },
      data: dto
    });
  }

  async remove(id: number) {
    const menu = await this.findOne(id);
    
    // 🌟 เพิ่ม: ป้องกันการลบเมนูระบบ
    if (menu.isSystem) {
      throw new BadRequestException('ไม่สามารถลบเมนูหลักของระบบได้ (System Menu)');
    }
    
    return this.prisma.secMenu.delete({ where: { id } });
  }

  // ============================================================================
  // 3. Helper: Import & Tree Builder
  // ============================================================================

  async importMenus(menuJson: any[]) {
    let count = 0;
    
    const saveRecursive = async (items: any[], parentId: number | null = null) => {
      for (const item of items) {
        let menu = await this.prisma.secMenu.findFirst({
            where: { name: item.name, parentId: parentId }
        });

        if (!menu) {
            menu = await this.prisma.secMenu.create({
                data: {
                    name: item.name,
                    path: item.path,
                    icon: item.icon,
                    sortOrder: item.sortOrder || 0,
                    parentId: parentId,
                    isVisible: item.isVisible ?? true,
                    moduleId: item.moduleId || null,
                    isSystem: item.isSystem ?? false // 🌟 เพิ่ม: กำหนด isSystem ตอน Import
                }
            });
            count++;
        } else {
            await this.prisma.secMenu.update({
                where: { id: menu.id },
                data: { 
                    moduleId: item.moduleId || menu.moduleId,
                    path: item.path
                }
            });
        }
        
        if (item.children && item.children.length > 0) {
            await saveRecursive(item.children, menu.id);
        }
      }
    };

    await saveRecursive(menuJson);
    return { success: true, importedCount: count };
  }

  private buildTree(items: any[], parentId: number | null = null): any[] {
    return items
      .filter(item => item.parentId === parentId)
      .map(item => ({
        ...item,
        children: this.buildTree(items, item.id)
      }));
  }
}