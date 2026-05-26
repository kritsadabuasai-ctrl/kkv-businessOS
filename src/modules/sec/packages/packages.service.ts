import { Injectable, BadRequestException, NotFoundException ,ForbiddenException , Logger} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; 
import { CreatePackageDto, UpdatePackageDto  ,SetCustomPriceDto } from './packages.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PackagesService {
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

  private readonly logger = new Logger(PackagesService.name);

 /**
   * 1. สร้าง Package ใหม่ พร้อมผูก Module และตั้งค่าโควตา AI
   */
  async create(dto: CreatePackageDto, reqCompanyId: number) {
    // ❌ เอาโค้ดที่เตะ (Throw Error) ตัวแทนจำหน่ายออกไป เพื่อให้ทุกคนสร้าง Package ได้

    const existing = await this.prisma.sysPackage.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Package code '${dto.code}' already exists`);
    }

    const { moduleIds, aiTokenLimit, ...data } = dto;

    // 🌟 เช็คว่าเป็น HQ ไหม
    const isHq = await this.isHqCompany(reqCompanyId);

    return this.prisma.sysPackage.create({
      data: {
        ...data,
        // 🌟 ลอจิกสำคัญ: 
        // ถ้าเป็น HQ สร้าง -> ให้ companyId เป็น null (แปลว่าเป็น Package กลาง)
        // ถ้าตัวแทน (Reseller) สร้าง -> ให้บันทึก companyId เป็นรหัสบริษัทตัวเอง
        companyId: isHq ? null : reqCompanyId, 
        
        aiTokenLimit: aiTokenLimit ? BigInt(aiTokenLimit) : null,
        defaultModules: (moduleIds && moduleIds.length > 0) ? {
          create: moduleIds.map((moduleId) => ({
            moduleId: moduleId,
          })),
        } : undefined,
      },
      include: {
        defaultModules: { include: { module: true } }, 
      },
    });
  }

/**
   * 🌟 2. ดึงรายการ Package ทั้งหมด (สืบทอดตามสายงาน Multi-tier Reseller)
   */
  async findAll(user: any, intent?: string) { 
    const userCompanyId = Number(user.companyId);

    const company = await this.prisma.orgCompany.findUnique({
      where: { id: userCompanyId },
      select: { licenseHolderId: true, packageId: true }
    });

    if (!company) throw new NotFoundException('ไม่พบข้อมูลบริษัทของคุณในระบบ');

    const isHq = company.licenseHolderId === null; 
    let whereCondition: any = { isActive: true };

    if (isHq) {
      // 👑 HQ: เห็นเฉพาะแพ็กเกจกลางของตัวเองเท่านั้น
      whereCondition.companyId = null; 
    } else {
      // =========================================================
      // 🌳 ลอจิกใหม่: หาต้นขั้วแพ็กเกจ (Nearest Master Package Owner)
      // =========================================================
      let masterPackageCompanyId: number | null = null;
      let currentHolderId: number | null = company.licenseHolderId;

      // ปีนขึ้นไปตามสายงานเพื่อหาว่า ใครคือแม่ทีมที่สร้างแพ็กเกจให้เราขาย?
      while (currentHolderId !== null) {
        const pkgCount = await this.prisma.sysPackage.count({
          where: { companyId: currentHolderId, isActive: true }
        });
        
        if (pkgCount > 0) {
          masterPackageCompanyId = currentHolderId; // เจอตัวแทนชั้นบนที่สร้างแพ็กเกจเองแล้ว! หยุดค้นหา
          break;
        }
        
        // ถ้าคนข้างบนไม่ได้สร้างแพ็กเกจเอง ให้ปีนไปหาหัวหน้าของเขาต่อ (จนกว่าจะถึง HQ คือ null)
        const parentCompany = await this.prisma.orgCompany.findUnique({
          where: { id: currentHolderId },
          select: { licenseHolderId: true }
        });
        
        if (!parentCompany) break;
        currentHolderId = parentCompany.licenseHolderId;
      }

      // =========================================================
      // 🎯 กรองข้อมูลตามสายงานที่หาเจอ
      // =========================================================
      if (intent === 'resale') {
        const myCustomPackagesCount = await this.prisma.sysPackage.count({
          where: { companyId: userCompanyId, isActive: true }
        });

        if (myCustomPackagesCount > 0) {
          whereCondition.companyId = userCompanyId; // ขายของตัวเอง
        } else {
          whereCondition.companyId = masterPackageCompanyId; // ขายของแม่ทีม
        }
      } else {
        whereCondition.OR = [
          { companyId: masterPackageCompanyId }, // ดูของแม่ทีม (เป็นฐาน)
          { companyId: userCompanyId } // ดูของตัวเอง (ที่สร้างเพิ่ม)
        ];
      }
    }

    const packages = await this.prisma.sysPackage.findMany({
      where: whereCondition,
      include: {
        defaultModules: { include: { module: true } },
        _count: { select: { companies: true } }
      },
      orderBy: { price: 'asc' },
    });

    if (isHq) {
      return packages.map(pkg => ({
        ...pkg,
        isEditableByMe: true 
      }));
    }

    // =========================================================
    // 🪄 ระบบสวมรอยราคา (Price Masking) สำหรับสายงานลูกข่าย
    // =========================================================
    const customPrices = await this.prisma.orgPackagePrice.findMany({
      where: { companyId: userCompanyId }
    });

    return packages.map(pkg => {
      const custom = customPrices.find(cp => cp.packageId === pkg.id);
      const isMyOwnPackage = pkg.companyId === userCompanyId;

      if (isMyOwnPackage) {
         // ✅ แพ็กเกจที่สร้างเอง แก้ไขได้
        return {
           ...pkg,
           isEditableByMe: true 
        }; 
      }

      // ⚠️ แพ็กเกจของแม่ทีม ให้สวมรอยราคา และ ห้ามแก้ไข
      if (custom) {
        return {
          ...pkg,
          price: custom.customPrice,               
          resellerPrice: custom.customResellerPrice,
          isEditableByMe: false 
        };
      }
      
      return {
        ...pkg,
        price: pkg.resellerPrice !== null ? pkg.resellerPrice : pkg.price, 
        isEditableByMe: false 
      };
    });
  }
  /**
   * 3. ดูรายละเอียด Package รายตัว
   */
  async findOne(id: number) {
    const pkg = await this.prisma.sysPackage.findUnique({
      where: { id },
      include: {
        defaultModules: { include: { module: true } },
      },
    });
    if (!pkg) throw new NotFoundException(`Package ID ${id} not found`);
    return pkg;
  }

  /**
   * 4. แก้ไขข้อมูล Package
   */
 /**
   * 4. แก้ไขข้อมูล Package
   */
  async update(id: number, dto: UpdatePackageDto, reqCompanyId: number) { 
    const { moduleIds, aiTokenLimit, ...data } = dto;
    const pkg = await this.findOne(id);

    // 🛡️ 2. ป้องกันตัวแทนจำหน่าย (Reseller) แอบแก้ไขแพ็กเกจกลาง
    const isHq = await this.isHqCompany(reqCompanyId);
    if (!isHq) {
      if (pkg.companyId === null || pkg.companyId !== reqCompanyId) {
        throw new ForbiddenException('เฉพาะบริษัทสำนักงานใหญ่ (HQ) เท่านั้นที่สามารถแก้ไขแพ็กเกจนี้ได้');
      }
    }

    return this.prisma.sysPackage.update({
      where: { id },
      data: {
        ...data,
        aiTokenLimit: aiTokenLimit !== undefined && aiTokenLimit !== null ? BigInt(aiTokenLimit) : null,
        defaultModules: moduleIds ? {
          deleteMany: {},
          create: moduleIds.map((moduleId) => ({ moduleId: moduleId })),
        } : undefined,
      },
      include: {
        defaultModules: { include: { module: true } },
      },
    });
  }

  /**
   * 5. ลบ Package (อนุญาตเฉพาะเมื่อไม่มีบริษัทผูกอยู่)
   */
  async remove(id: number, reqCompanyId: number) { 
    const pkg = await this.prisma.sysPackage.findUnique({
      where: { id },
      include: { _count: { select: { companies: true } } }
    });

    if (!pkg) throw new NotFoundException(`Package ID ${id} not found`);

    // 🛡️ 3. ป้องกันตัวแทนจำหน่ายแอบลบแพ็กเกจ
    const isHq = await this.isHqCompany(reqCompanyId);
    if (!isHq) {
      if (pkg.companyId === null || pkg.companyId !== reqCompanyId) {
         throw new ForbiddenException('เฉพาะบริษัทสำนักงานใหญ่ (HQ) เท่านั้นที่สามารถลบแพ็กเกจนี้ได้');
      }
    }

    if (pkg._count.companies > 0) {
      throw new BadRequestException(`ไม่สามารถลบ Package นี้ได้ เนื่องจากมี ${pkg._count.companies} บริษัทกำลังใช้งานอยู่`);
    }

    return this.prisma.sysPackage.delete({ where: { id } });
  }

  /**
   * 🌟 6. Package Analytics สำหรับหน้า Dashboard (อัปเกรด: Infinite Tiers)
   */
  async getPackageAnalytics(currentUser: any) {
    const now = new Date();
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(now.getMonth() + 3);

    const userCompany = await this.prisma.orgCompany.findUnique({
      where: { id: Number(currentUser.companyId) }
    });

    const isHQ = userCompany?.licenseHolderId === null;
    let companyWhereCondition: any = {};

    // 🌟 2. ถ้าไม่ใช่ HQ (เป็นตัวแทน) ให้ตีกรอบเครือข่ายแบบลึกไม่จำกัดชั้น
    if (!isHQ) {
      const networkSet = new Set<number>([Number(currentUser.companyId)]);
      let currentLevelIds = [Number(currentUser.companyId)];

      // ลูปหาบริษัทในเครือข่ายทั้งหมด (ตัวเอง -> ลูก -> หลาน -> เหลน)
      while (currentLevelIds.length > 0) {
        const children = await this.prisma.orgCompany.findMany({
          where: { licenseHolderId: { in: currentLevelIds } },
          select: { id: true }
        });

        const childIds = children.map(c => c.id).filter(id => !networkSet.has(id));
        if (childIds.length === 0) break;

        childIds.forEach(id => networkSet.add(id));
        currentLevelIds = childIds;
      }

      companyWhereCondition = {
        id: { in: Array.from(networkSet) }
      };
    }

    // 🌟 3. ดึงข้อมูลบริษัททั้งหมดตามเงื่อนไขเครือข่าย
    const companies = await this.prisma.orgCompany.findMany({
      where: companyWhereCondition,
      include: { 
        package: true,
        licenseHolder: true 
      },
    });

    // 🌟 4. คำนวณรายได้/ต้นทุน (Financials) จาก Package
    let totalRetailValue = 0;   
    let totalWholesaleValue = 0; 

    companies.forEach(company => {
      if (company.package) {
        totalRetailValue += Number(company.package.price || 0);

        // คำนวณราคาส่ง เฉพาะบริษัทที่มีตัวแทนดูแล
        if (company.licenseHolderId !== null) {
          totalWholesaleValue += Number((company.package as any).resellerPrice || 0);
        }
      }
    });

    // 🌟 5. เงื่อนไขนับจำนวนแพ็กเกจสำหรับ Dashboard
    const packageWhereCondition: any = isHQ 
      ? { isActive: true } 
      : { 
          isActive: true, 
          OR: [{ companyId: Number(currentUser.companyId) }, { companyId: null }] 
        };

    // 🌟 6. ส่งข้อมูลกลับไป
    return {
      summary: {
        totalCompanies: companies.length,
        activePackages: await this.prisma.sysPackage.count({ where: packageWhereCondition }),
      },
      financials: {
        totalRetailValue,       
        totalWholesaleValue,    
        estimatedProfitMargin: isHQ 
          ? totalRetailValue 
          : (totalRetailValue - totalWholesaleValue)
      },
      statusGroups: {
        expiringSoon: companies.filter(c => 
          c.packageExpiresAt && 
          c.packageExpiresAt <= threeMonthsFromNow && 
          c.packageExpiresAt > now
        ),
        expired: companies.filter(c => 
          c.packageExpiresAt && 
          c.packageExpiresAt <= now
        ),
        healthy: companies.filter(c => 
          !c.packageExpiresAt || 
          c.packageExpiresAt > threeMonthsFromNow
        )
      },
      packageDistribution: await this.prisma.orgCompany.groupBy({
        by: ['packageId'],
        _count: { id: true },
        where: { 
          packageId: { not: null },
          ...companyWhereCondition
        }
      })
    };
  }

  /**
   * 🌟 8. ให้ตัวแทน (Reseller) บันทึกราคาแพ็กเกจของตัวเอง (Upsert)
   */
  async setCustomPrice(companyId: number, dto: SetCustomPriceDto) {
    // 1. เช็คว่ามี Package กลางนี้อยู่จริงไหม
    const pkg = await this.prisma.sysPackage.findUnique({
      where: { id: dto.packageId }
    });
    if (!pkg) throw new NotFoundException('ไม่พบแพ็กเกจที่ต้องการตั้งราคา');

    // 2. ใช้ Upsert: ถ้าเคยตั้งราคาไว้แล้วให้อัปเดต ถ้ายังไม่เคยให้สร้างใหม่
    return this.prisma.orgPackagePrice.upsert({
      where: {
        companyId_packageId: {
          companyId: companyId,
          packageId: dto.packageId
        }
      },
      update: {
        customPrice: dto.customPrice,
        customResellerPrice: dto.customResellerPrice
      },
      create: {
        companyId: companyId,
        packageId: dto.packageId,
        customPrice: dto.customPrice,
        customResellerPrice: dto.customResellerPrice
      }
    });
  }

  

  /**
   * 🤖 7. Automated Maintenance: ระบบตรวจสอบรายวัน (Cron Job)
   * รันทุกวันเวลาเที่ยงคืนเพื่อจัดการสถานะ Trial, Grace Period, Suspended และ Scheduled Upgrades
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionChecks() {
    const now = new Date();
    this.logger.log(`[CRON] เริ่มตรวจสอบสถานะ Subscription ประจำวันที่ ${now.toISOString()}`);

    // ==========================================
    // ⏳ เฟส 1: หมดเวลาทดลองใช้ (TRIAL) หรือ ใช้งานปกติ (ACTIVE) -> เข้าสู่ระยะผ่อนผัน (GRACE_PERIOD)
    // ==========================================
    const newlyExpired = await this.prisma.orgSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] },
        endDate: { lt: now } // วันสิ้นสุดน้อยกว่าวันนี้ (คือหมดอายุแล้ว)
      }
    });

    if (newlyExpired.length > 0) {
      await this.prisma.orgSubscription.updateMany({
        where: { id: { in: newlyExpired.map(s => s.id) } },
        data: { 
          status: 'GRACE_PERIOD',
          updatedAt: new Date()
        }
      });
      this.logger.log(`[CRON] เปลี่ยนสถานะ ${newlyExpired.length} รายการเป็น GRACE_PERIOD (ผ่อนผัน 7 วัน)`);
    }

    // ==========================================
    // 🚫 เฟส 2: หมดระยะเวลาผ่อนผัน (เกิน 7 วัน) -> ระงับการใช้งาน (SUSPENDED)
    // ==========================================
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7); // ย้อนหลังไป 7 วัน

    const overGracePeriod = await this.prisma.orgSubscription.findMany({
      where: {
        status: 'GRACE_PERIOD',
        endDate: { lt: sevenDaysAgo } // หมดอายุมาแล้วเกิน 7 วัน
      }
    });

    if (overGracePeriod.length > 0) {
      await this.prisma.orgSubscription.updateMany({
        where: { id: { in: overGracePeriod.map(s => s.id) } },
        data: { 
          status: 'SUSPENDED',
          updatedAt: new Date()
        }
      });
      this.logger.log(`[CRON] เปลี่ยนสถานะ ${overGracePeriod.length} รายการเป็น SUSPENDED (ระงับการใช้งาน)`);
    }

    // ==========================================
    // ⚠️ เฟส 3: ตรวจสอบเพื่อแจ้งเตือนล่วงหน้า (30 วัน / 7 วัน)
    // ==========================================
    const warn30 = new Date(); warn30.setDate(now.getDate() + 30);
    const expiringIn30Days = await this.prisma.orgSubscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: new Date(warn30.setHours(0,0,0,0)),
          lte: new Date(warn30.setHours(23,59,59,999))
        }
      },
      include: { company: true }
    });

    expiringIn30Days.forEach(sub => {
      // 🌟 อนาคตสามารถเขียนโค้ดส่ง Email หรือสร้าง Notification แจ้งลูกค้าตรงนี้ได้เลยครับ
      this.logger.log(`[CRON-WARN] บริษัท ${sub.company.name} จะหมดอายุในอีก 30 วัน`);
    });

    // ==========================================
    // 🌟 เฟส 4: เปิดใช้งาน Subscription ที่ตั้งเวลาไว้ล่วงหน้า (Scheduled Upgrade)
    // ==========================================
    const pendingToActive = await this.prisma.orgSubscription.findMany({
      where: {
        status: 'PENDING', // สถานะรอเปิดใช้งาน
        startDate: { lte: now } // ถ้า startDate น้อยกว่าหรือเท่ากับเวลาปัจจุบัน (ถึงเวลาแล้ว)
      }
    });

    if (pendingToActive.length > 0) {
      await this.prisma.orgSubscription.updateMany({
        where: { id: { in: pendingToActive.map(s => s.id) } },
        data: { 
          status: 'ACTIVE', 
          updatedAt: new Date() 
        }
      });
      this.logger.log(`[CRON] เปิดใช้งาน Subscription ล่วงหน้าอัตโนมัติจำนวน ${pendingToActive.length} รายการ`);
    }
  }
}