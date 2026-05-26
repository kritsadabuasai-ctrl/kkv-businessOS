import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  ForbiddenException,
  Logger
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './companies.dto';
import { Prisma } from '@prisma/client';




@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 🛡️ Helper: ฟังก์ชันตรวจสอบสิทธิ์ก่อนทำรายการ (ป้องกัน IDOR)
  // =========================================================
 private async verifyAccess(targetCompanyId: number, userId: number) {
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId },
      include: { role: true, company: true }
    });

    const isGlobalAdmin = userRoles.some(ur => 
      ur.company?.licenseHolderId === null && 
      ur.role?.name?.toUpperCase() === 'SUPER_ADMIN'
    );

    if (isGlobalAdmin) return true;

    const userCompanyIds = userRoles.map(ur => ur.companyId);
    
    // ตรวจสอบว่า targetCompanyId อยู่ใต้สายงาน (licenseHolderId) ของ user นี้หรือไม่
    const targetCompany = await this.prisma.orgCompany.findUnique({
      where: { id: targetCompanyId },
      select: { licenseHolderId: true, id: true }
    });

    if (!targetCompany) throw new NotFoundException('ไม่พบข้อมูลบริษัทเป้าหมาย');

    const isOwnCompany = userCompanyIds.includes(targetCompany.id);
    const isUnderReseller = targetCompany.licenseHolderId && userCompanyIds.includes(targetCompany.licenseHolderId);

    if (!isOwnCompany && !isUnderReseller) {
      throw new ForbiddenException('❌ คุณไม่มีสิทธิ์จัดการข้อมูลบริษัทนี้');
    }

    return true;
  }

// =========================================================
  // ✨ 3. READ ALL (ดึงข้อมูลโครงสร้างองค์กรแบบ Hybrid Network - เวอร์ชัน Clean)
  // =========================================================
  async findAll(userId: number) { 
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId: userId },
      include: { role: true, company: true }
    });

    const directCompanyIds = userRoles
      .map(ur => ur.companyId)
      .filter(id => id !== null) as number[];

    if (directCompanyIds.length === 0) return [];

    const hqRole = userRoles.find(ur => ur.company?.licenseHolderId === null);
    const isHQ = !!hqRole;
    const hasSuperAdminRole = userRoles.some(ur => ur.role?.name?.toUpperCase() === 'SUPER_ADMIN');
    const isGlobalAdmin = isHQ && hasSuperAdminRole;
    
    let whereCondition: Prisma.OrgCompanyWhereInput = { isActive: true };

    if (isGlobalAdmin) {
      whereCondition = {
        ...whereCondition,
        OR: [
          { id: { in: directCompanyIds } }, 
          { parentId: { in: directCompanyIds } }, 
          { licenseHolderId: { in: directCompanyIds } } 
        ]
      };
    } else {
      const networkSet = new Set<number>(directCompanyIds);
      let currentLevelIds = [...directCompanyIds];

      while (currentLevelIds.length > 0) {
        const childCompanies = await this.prisma.orgCompany.findMany({
          where: { 
            OR: [
              { licenseHolderId: { in: currentLevelIds } },
              { parentId: { in: currentLevelIds } } 
            ]
          },
          select: { id: true }
        });

        const childIds = childCompanies.map(c => c.id).filter(id => !networkSet.has(id));
        if (childIds.length === 0) break;

        childIds.forEach(id => networkSet.add(id));
        currentLevelIds = childIds;
      }

      whereCondition = {
        ...whereCondition,
        id: { in: Array.from(networkSet) }
      };
    }

    const companies = await this.prisma.orgCompany.findMany({
      where: whereCondition,
      include: {
        package: true,
        companyInfo: {
          include: {
            logoMedia: true, 
            documents: {
              include: { media: true } 
            }
          }
        },
        licenseHolder: { select: { id: true, name: true, code: true } },
        parent: { select: { id: true, name: true, code: true } }, 
        licensedGroup: { select: { id: true } },
        children: { select: { id: true } }       
      },
      orderBy: [
        { licenseHolderId: 'asc' }, 
        { parentId: 'asc' },        
        { id: 'asc' }
      ],
    });

    return companies.map(c => {
      return {
        ...c,
        phone: c.companyInfo?.phone || '',
        email: c.companyInfo?.email || '',
        website: c.companyInfo?.website || '',
        address: c.companyInfo?.address || '',
        taxId: c.companyInfo?.taxId || c.taxId || '', 
        
        // 🟢 ดึงข้อมูลจากโครงสร้างหลัก (Single Source of Truth) โดยตรง
        logoMediaId: c.companyInfo?.logoMediaId || null,
        logoMedia: c.companyInfo?.logoMedia || null, 
        logoUrl: c.companyInfo?.logoMedia?.url || null,
        
        branchCode: c.companyInfo?.branchCode || '',
        registeredName: c.companyInfo?.registeredName || '',
        fax: c.companyInfo?.fax || '',
        subDistrict: c.companyInfo?.subDistrict || '',
        district: c.companyInfo?.district || '',
        province: c.companyInfo?.province || '',
        zipCode: c.companyInfo?.zipCode || '',
        documents: c.companyInfo?.documents || [],
      };
    });
  }

// =======================================================================
  // 🏢 3. สร้างบริษัทใหม่ (Create - รองรับ Multi-level Reseller & Quota Enforcement)
  // =======================================================================
  async create(dto: CreateCompanyDto, creatorUserId: number) {
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId: creatorUserId },
      include: { role: true, company: true }
    });

    const isHQ = userRoles.some(ur => ur.company?.licenseHolderId === null);
    const hasSuperAdminRole = userRoles.some(ur => 
      ur.role && ur.role.name && ur.role.name.toUpperCase() === 'SUPER_ADMIN'
    );
    const isGlobalAdmin = isHQ && hasSuperAdminRole;
    
    const userCompanyId = userRoles.find(ur => ur.companyId !== null)?.companyId;

    // ✨ [แกะตัวแปรสกัดคีย์สีและธีมฟอนต์] แยกออกจากกลุ่มข้อมูลหลักเพื่อความเป็นระเบียบและปลอดภัย
    const {
      primaryColor,
      secondaryColor,
      buttonColor,
      fontFamily,
      fontHeadingFamily,
      fontSizeBase,
      taxId,
      branchCode,
      registeredName,
      phone,
      fax,
      email,
      website,
      address,
      subDistrict,
      district,
      province,
      zipCode,
      customDomain,
      logoMediaId,
      documents,
      ...companyData
    } = dto;


    // 🌐 [เพิ่มใหม่] ตรวจสอบโดเมนซ้ำระดับบริษัท
    if (dto.customDomain) {
      const existingDomain = await this.prisma.orgCompany.findUnique({
        where: { customDomain: dto.customDomain },
      });
      if (existingDomain) {
        throw new BadRequestException('โดเมนนี้ถูกใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let finalParentId: number | null = null;
      let finalLicenseHolderId: number | null = null;
      let targetPackageId: number | null = dto.packageId || null;

      if (isGlobalAdmin) {
        finalParentId = dto.parentId || userCompanyId || null;
      } else {
        if (!userCompanyId) throw new ForbiddenException('User ไม่มีสังกัดบริษัทหลัก ไม่สามารถสร้างบริษัทลูกได้');
        finalParentId = userCompanyId;
      }

      if (finalParentId) {
        const parent = await tx.orgCompany.findUnique({
          where: { id: finalParentId },
          include: { package: true }
        });
        if (!parent) throw new NotFoundException('Parent company not found');
        
        finalLicenseHolderId = parent.id; 
        
        if (!targetPackageId) targetPackageId = parent.packageId;

        if (parent?.package) {
          const maxAllowed = parent.package.maxCompanies;
          const currentCount = await tx.orgCompany.count({
            where: { licenseHolderId: parent.id }
          });
          if (currentCount >= maxAllowed) {
            throw new BadRequestException(`❌ เกินโควตาแพ็กเกจของคุณ (สร้างได้สูงสุด ${maxAllowed} แห่ง)`);
          }
        }
      }

      if (!targetPackageId) {
        throw new BadRequestException('❌ การสร้างบริษัทต้องระบุ Package (packageId) เสมอ');
      }

      const packageInfo = await tx.sysPackage.findUnique({
        where: { id: targetPackageId }
      });
      if (!packageInfo) throw new BadRequestException('ไม่พบข้อมูลแพ็กเกจที่เลือก');

      if (finalLicenseHolderId && !isGlobalAdmin) {
        const parentQuota = await tx.intAiQuota.findUnique({
          where: { companyId: finalLicenseHolderId }
        });

        if (parentQuota) {
          const childrenQuotas = await tx.intAiQuota.aggregate({
            where: { company: { licenseHolderId: finalLicenseHolderId } },
            _sum: { monthlyLimit: true, maxStorageBytes: true }
          });

          const allocatedTokens = childrenQuotas._sum.monthlyLimit || BigInt(0);
          const allocatedStorage = childrenQuotas._sum.maxStorageBytes || BigInt(0);

          const requestedTokens = BigInt(packageInfo.aiTokenLimit || 0);
          const requestedStorageBytes = BigInt(packageInfo.maxStorageMB || 500) * BigInt(1024 * 1024);

          if ((allocatedTokens + requestedTokens) > parentQuota.monthlyLimit) {
            throw new BadRequestException(`❌ โควตา AI Token ของคุณไม่เพียงพอ`);
          }

          if ((allocatedStorage + requestedStorageBytes) > parentQuota.maxStorageBytes) {
            throw new BadRequestException(`❌ พื้นที่เก็บข้อมูล (Storage) ของคุณไม่เพียงพอ`);
          }
        }
      }

      // --- 3. สร้างบริษัทใหม่ ---
      const newCompany = await tx.orgCompany.create({
         data: {
           code: companyData.code,
           name: companyData.name,
           customDomain: customDomain,
           parentId: finalParentId,
           // 🚩 บังคับ Type ด้วย as any เพื่อแก้ Error Type 'string' is not assignable to type 'CompanyType'
           companyType: (companyData.companyType || (finalParentId ? 'BRANCH' : 'CORPORATE')) as any, 
           licenseHolderId: finalLicenseHolderId,
           packageId: targetPackageId,

           // ✨ บันทึกข้อมูลสี และ สไตล์ธีม เข้าสู่ตารางหลักของบริษัทโดยตรง
           primaryColor: primaryColor || '#4F46E5',
           secondaryColor: secondaryColor,
           buttonColor: buttonColor || '#10B981',
           isReseller: companyData.isReseller || false, 
           fontFamily: fontFamily || 'Kanit',
           fontHeadingFamily: fontHeadingFamily || 'Kanit',
           fontSizeBase: fontSizeBase || 16,

          companyInfo: { 
             create: {
               taxId, branchCode, registeredName, phone, fax, email, website,
               address, subDistrict, district, province, zipCode,
               ...(logoMediaId && { logoMedia: { connect: { id: logoMediaId } } })
             } 
           },
           aiQuota: { 
             create: { 
               tier: packageInfo.name,
               monthlyLimit: packageInfo.aiTokenLimit || BigInt(0),
               maxStorageBytes: BigInt(packageInfo.maxStorageMB || 500) * BigInt(1024 * 1024)
             } 
           }
         },
         include: { 
           // ✨ ปรับปรุง include ให้ดึง logoMedia กลับมาด้วย
           companyInfo: {
             include: {
               logoMedia: true
             }
           } 
         }
      });

      // --- 📌 สร้างเอกสาร (Company Documents) ---
      // 🚩 ใช้ as any ในการเข้าถึง companyInfo ชั่วคราวเผื่อ Prisma Client ของคุณยังไม่อัปเดต
      const companyInfoData = (newCompany as any).companyInfo; 
      
      if (documents && documents.length > 0 && companyInfoData) {
        for (const doc of documents) {
          await tx.orgCompanyDocument.create({
            data: {
              docType: doc.documentType,
              company: { connect: { id: newCompany.id } },
              companyInfo: { connect: { id: companyInfoData.id } },
              media: { connect: { id: doc.mediaId } }
            }
          });
        }
      }

      // --- 4. COPY AI BOTS ---
      const hqBots = await tx.intAiBot.findMany({
        where: { company: { licenseHolderId: null }, isActive: true }
      });

      if (hqBots.length > 0) {
        const botsToCreate = hqBots.map(bot => ({
          companyId: newCompany.id,
          isSystem: bot.isSystem, 
          code: bot.code,                
          name: bot.name,                
          description: bot.description,
          provider: bot.provider,
          modelName: bot.modelName,
          temperature: bot.temperature,
          systemPrompt: bot.systemPrompt,
          greetingMessage: bot.greetingMessage,
          canUseTools: bot.canUseTools,
          isActive: bot.isActive
        }));
        await tx.intAiBot.createMany({ data: botsToCreate });
      }

      // --- 5. คำนวณราคา & บิล ---
      const isResellerAction = finalLicenseHolderId && !isGlobalAdmin;
      const currentPriceType = isResellerAction ? 'RESELLER' : 'NORMAL';
      
      let finalPaidPrice = packageInfo.price; 

      if (isResellerAction) {
        const customPrice = await (tx as any).orgPackagePrice.findUnique({
          where: { 
            companyId_packageId: { 
              companyId: finalLicenseHolderId, 
              packageId: targetPackageId 
            } 
          }
        });

        if (customPrice) {
          finalPaidPrice = customPrice.customPrice;
        } else {
          finalPaidPrice = packageInfo.resellerPrice ?? packageInfo.price;
        } 
      }

      const billingHistory = await tx.orgBillingHistory.create({
        data: {
          companyId: newCompany.id,
          action: 'NEW_PACKAGE',
          packageId: targetPackageId!, 
          price: !isResellerAction ? finalPaidPrice : null,
          resellerPrice: isResellerAction ? finalPaidPrice : null,
          operatorId: creatorUserId, 
          note: `Activated via Internal Creation`
        }
      });

      // --- 6. สิทธิ์, เมนู, Subscription ---
      const newAdminRole = await tx.secRole.create({
        data: { companyId: newCompany.id, name: 'ADMIN', displayName: 'ผู้ดูแลระบบ (Admin)' }
      });

      const coreModules = await tx.sysModule.findMany({
        where: { code: { in: ['MOD_CORE', 'MOD_ORG'] } },
        select: { id: true }
      });
      
      const packageModules = await tx.sysPackageModule.findMany({
        where: { packageId: targetPackageId },
        select: { moduleId: true }
      });
      
      const allowedModuleIds = Array.from(new Set([
        ...coreModules.map(m => m.id), 
        ...packageModules.map(m => m.moduleId)
      ]));

      if (allowedModuleIds.length > 0) {
        const subscriptionData = allowedModuleIds.map(modId => ({
          companyId: newCompany.id,
          moduleId: modId,
          status: 'ACTIVE',
          startDate: new Date(),
          paidAmount: finalPaidPrice,
          priceType: currentPriceType,
          lastBillingId: billingHistory.id
        }));
        await tx.orgSubscription.createMany({ data: subscriptionData });
      }

      const [allowedPermissions, allowedMenus] = await Promise.all([
        tx.secPermission.findMany({ where: { OR: [{ moduleId: null }, { moduleId: { in: allowedModuleIds } }] } }),
        tx.secMenu.findMany({ where: { OR: [{ isSystem: false }, { moduleId: null }, { moduleId: { in: allowedModuleIds } }] } })
      ]);

      if (allowedPermissions.length > 0) {
        await tx.secRolePermission.createMany({
          data: allowedPermissions.map(p => ({ roleId: newAdminRole.id, permissionId: p.id }))
        });
      }
      if (allowedMenus.length > 0) {
        await tx.secRoleMenu.createMany({
          data: allowedMenus.map(m => ({ roleId: newAdminRole.id, menuId: m.id, sortOrder: m.sortOrder }))
        });
      }

      await tx.secUserRole.create({
        data: { userId: creatorUserId, companyId: newCompany.id, roleId: newAdminRole.id }
      });

      return {
        ...newCompany,
        phone: companyInfoData?.phone || '',
        email: companyInfoData?.email || '',
        website: companyInfoData?.website || '',
        address: companyInfoData?.address || '',
        taxId: companyInfoData?.taxId || (newCompany as any).taxId || '',
        logoMediaId: companyInfoData?.logoMediaId || null,
        logoMedia: companyInfoData?.logoMedia || null, // 🟢 คืนรูปโลโก้ให้หน้าบ้าน
        branchCode: companyInfoData?.branchCode || '',
        registeredName: companyInfoData?.registeredName || '',
        fax: companyInfoData?.fax || '',
        subDistrict: companyInfoData?.subDistrict || '',
        district: companyInfoData?.district || '',
        province: companyInfoData?.province || '',
        zipCode: companyInfoData?.zipCode || '',
        documents: documents || [],
      };
    });
  }

// =======================================================================
  // 2. GET COMPANY BY ID (เวอร์ชัน Clean)
  // =======================================================================
  async findOne(id: number, userId: number) {
    await this.verifyAccess(id, userId);

    const company = await this.prisma.orgCompany.findUnique({
      where: { id },
      include: {
        companyInfo: {
          include: {
            logoMedia: true 
          }
        },
        package: true,
      },
    });

    if (!company) {
      throw new NotFoundException(`ไม่พบข้อมูลบริษัทรหัส ${id}`);
    }

    const documents = await this.prisma.orgCompanyDocument.findMany({
      where: { companyId: id },
    });

    const info = company.companyInfo;
    
    return {
      ...company,
      phone: info?.phone || '',
      email: info?.email || '',
      website: info?.website || '',
      address: info?.address || '',
      taxId: info?.taxId || company.taxId || '',
      
      logoMediaId: info?.logoMediaId || null,
      logoMedia: info?.logoMedia || null, 
      logoUrl: info?.logoMedia?.url || null, 
      
      branchCode: info?.branchCode || '',
      registeredName: info?.registeredName || '',
      fax: info?.fax || '',
      subDistrict: info?.subDistrict || '',
      district: info?.district || '',
      province: info?.province || '',
      zipCode: info?.zipCode || '',
      documents: documents || [], 
    };
  }

 
// =======================================================================
// 🏢 4. UPDATE COMPANY (อัปเดตข้อมูล + ระบบ Auto-Bind โลโก้)
// =======================================================================
async update(id: number, dto: UpdateCompanyDto, userId: number) {
  await this.verifyAccess(id, userId);

  const currentCompany = await this.prisma.orgCompany.findUnique({
    where: { id },
    select: { packageId: true }
  });

  if (!currentCompany) {
    throw new NotFoundException(`ไม่พบข้อมูลบริษัทรหัส ${id}`);
  }

  const { 
    phone, email, website, address, taxId, isReseller, 
    fontFamily, fontHeadingFamily, fontSizeBase, logoMediaId,
    branchCode, registeredName, fax, subDistrict, district, province, zipCode,
    primaryColor, secondaryColor, buttonColor, 
    documents, customDomain,
    companyType, 
    ...companyData 
  } = dto;

  if (dto.customDomain) {
    const existingDomain = await this.prisma.orgCompany.findUnique({
      where: { customDomain: dto.customDomain },
    });
    if (existingDomain && existingDomain.id !== id) {
      throw new BadRequestException('โดเมนนี้ถูกใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ');
    }
  }

  // 🛡️ [ระบบ Auto-Bind]: ค้นหา ID โลโก้ที่ถูกต้องที่สุด
  let finalLogoMediaId = logoMediaId;

  // 1. ถ้าหน้าบ้านส่งมา เช็กก่อนว่ามีใน DB ชุดปัจจุบันไหม
  if (finalLogoMediaId) {
    const mediaExists = await this.prisma.sysMedia.findUnique({
      where: { id: finalLogoMediaId },
      select: { id: true }
    });
    if (!mediaExists) {
      this.logger.warn(`⚠️ [Update Company] logoMediaId: ${finalLogoMediaId} หาไม่เจอในระบบ (อาจเป็น ID เก่า) กำลังจะใช้ระบบค้นหาอัตโนมัติ`);
      finalLogoMediaId = undefined;
    }
  }

  // 🌟 2. [หัวใจสำคัญ]: ถ้าหน้าบ้านไม่ได้ส่งมา หรือส่ง ID ผิด (จาก State เก่า)
  // ให้หลังบ้านควานหารูปโลโก้ล่าสุดที่เพิ่งอัปโหลดเข้ามาที่บริษัทนี้โดยตรง
  if (!finalLogoMediaId) {
    const latestLogo = await this.prisma.sysMedia.findFirst({
      where: { companyId: id, module: 'COMPANY_LOGO' },
      orderBy: { createdAt: 'desc' }
    });
    if (latestLogo) {
      finalLogoMediaId = latestLogo.id;
    }
  }

  return this.prisma.$transaction(async (tx) => {
    // อัปเดตข้อมูลตารางหลัก (OrgCompany)
    const updatedCompany = await tx.orgCompany.update({ 
      where: { id }, 
      data: {
        ...companyData, 
        isReseller: isReseller !== undefined ? isReseller : undefined,
        primaryColor, secondaryColor, buttonColor,
        fontFamily, fontHeadingFamily, fontSizeBase,
        taxId, customDomain
      }
    });

    const existingInfo = await tx.orgCompanyInfo.findUnique({
      where: { companyId: id }
    });

    let companyInfoData;

    // จัดการ OrgCompanyInfo พร้อมผูกโลโก้
    if (existingInfo) {
      companyInfoData = await tx.orgCompanyInfo.update({
        where: { companyId: id },
        data: {
          phone, email, website, address, taxId,
          branchCode, registeredName, fax, subDistrict, district, province, zipCode,
          ...(finalLogoMediaId !== undefined ? {
            logoMedia: finalLogoMediaId 
              ? { connect: { id: finalLogoMediaId } } 
              : (existingInfo.logoMediaId ? { disconnect: true } : {}) 
          } : {})
        },
        include: { logoMedia: true }
      });
    } else {
      companyInfoData = await tx.orgCompanyInfo.create({
        data: {
          company: { connect: { id: id } }, 
          phone, email, website, address, taxId,
          branchCode, registeredName, fax, subDistrict, district, province, zipCode,
          ...(finalLogoMediaId ? { logoMedia: { connect: { id: finalLogoMediaId } } } : {}) 
        },
        include: { logoMedia: true }
      });
    }

    // จัดการเอกสารแนบ
    if (documents && companyInfoData) {
      await tx.orgCompanyDocument.deleteMany({
        where: { companyId: id }
      });

      if (documents.length > 0) {
        for (const doc of documents) {
          const docMediaExists = await tx.sysMedia.findUnique({
            where: { id: doc.mediaId },
            select: { id: true }
          });

          if (docMediaExists) {
            await tx.orgCompanyDocument.create({
              data: {
                docType: doc.documentType,
                company: { connect: { id: id } },
                companyInfo: { connect: { id: companyInfoData.id } },
                media: { connect: { id: doc.mediaId } }
              }
            });
          }
        }
      }
    }

    // Sync สิทธิ์
    if (dto.packageId && currentCompany.packageId !== dto.packageId) {
      await this.syncCompanyPermissionsAndMenus(id, dto.packageId, tx);
    }

    // 🌟 ดึงข้อมูลรูปภาพเต็มๆ เพื่อส่งกลับหน้าบ้านให้แสดงผลได้ทันที
    let resolvedLogo = companyInfoData?.logoMedia || null;
    if (!resolvedLogo && finalLogoMediaId) {
       resolvedLogo = await tx.sysMedia.findUnique({ where: { id: finalLogoMediaId } }) as any;
    }

    // ส่งข้อมูลกลับ
    return {
      ...updatedCompany,
      phone: companyInfoData?.phone || '',
      email: companyInfoData?.email || '',
      website: companyInfoData?.website || '',
      address: companyInfoData?.address || '',
      taxId: companyInfoData?.taxId || (updatedCompany as any).taxId || '',
      
      // 🚩 ส่งข้อมูลโลโก้ที่ได้รับการ Auto-Bind กลับไปให้หน้าบ้านอย่างครบถ้วน
      logoMediaId: finalLogoMediaId || null,
      logoMedia: resolvedLogo || null, 
      logoUrl: resolvedLogo?.url || null, 
      
      branchCode: companyInfoData?.branchCode || '',
      registeredName: companyInfoData?.registeredName || '',
      fax: companyInfoData?.fax || '',
      subDistrict: companyInfoData?.subDistrict || '',
      district: companyInfoData?.district || '',
      province: companyInfoData?.province || '',
      zipCode: companyInfoData?.zipCode || '',
      documents: documents || [], 
    };
  });
}

  

  // =========================================================
  // 🔄 HELPER: ฟังก์ชัน Sync สิทธิ์และเมนูใหม่ (ใช้ตอนเปลี่ยน Package)
  // =========================================================
  private async syncCompanyPermissionsAndMenus(companyId: number, newPackageId: number, tx: Prisma.TransactionClient) {
    
    // 1. หา Role 'ADMIN' ของบริษัทนี้ (เราจะอัปเดตให้เฉพาะแอดมินหลักก่อน)
    const adminRole = await tx.secRole.findFirst({
      where: { companyId, name: 'ADMIN' }
    });

    if (!adminRole) return; // ถ้าหาไม่เจอให้ข้ามไป

    // 2. คำนวณโควตาโมดูลใหม่ทั้งหมด (เหมือนตอนสร้างบริษัท)
    const coreModules = await tx.sysModule.findMany({
      where: { code: { in: ['MOD_CORE', 'MOD_ORG'] } },
      select: { id: true }
    });
    let allowedModuleIds = coreModules.map(m => m.id);

    const packageModules = await tx.sysPackageModule.findMany({
      where: { packageId: newPackageId },
      select: { moduleId: true }
    });
    
    const pkgModuleIds = packageModules.map(m => m.moduleId);
    allowedModuleIds = Array.from(new Set([...allowedModuleIds, ...pkgModuleIds]));

    // 3. เตรียมข้อมูลสิทธิ์และเมนูชุดใหม่
    const permissionFilter: Prisma.SecPermissionWhereInput = {
      OR: [{ moduleId: { equals: null } }, { moduleId: { in: allowedModuleIds } }]
    };
    const menuFilter: Prisma.SecMenuWhereInput = {
      OR: [{ isSystem: false }, { moduleId: { equals: null } }, { moduleId: { in: allowedModuleIds } }]
    };

    const [newPermissions, newMenus] = await Promise.all([
      tx.secPermission.findMany({ where: permissionFilter }),
      tx.secMenu.findMany({ where: menuFilter })
    ]);

    // 🌟 4. ล้างของเก่าทิ้งทั้งหมด (สำหรับ Role ADMIN)
    await tx.secRolePermission.deleteMany({ where: { roleId: adminRole.id } });
    await tx.secRoleMenu.deleteMany({ where: { roleId: adminRole.id } });

    // 🌟 5. ยัดชุดใหม่ที่คำนวณแล้วเข้าไปแทนที่
    if (newPermissions.length > 0) {
      await tx.secRolePermission.createMany({
        data: newPermissions.map(p => ({ roleId: adminRole.id, permissionId: p.id }))
      });
    }

    if (newMenus.length > 0) {
      await tx.secRoleMenu.createMany({
        data: newMenus.map(m => ({ roleId: adminRole.id, menuId: m.id, sortOrder: m.sortOrder }))
      });
    }

    // 6.1 ปิดจบประวัติเก่า: ค้นหา Subscription เดิมที่กำลัง ACTIVE อยู่ 
    // แล้วเปลี่ยนสถานะเป็น 'EXPIRED' พร้อมลงวันที่ endDate เป็นวินาทีนี้
    await tx.orgSubscription.updateMany({ 
      where: { 
        companyId: companyId,
        status: 'ACTIVE'
      },
      data: {
        status: 'EXPIRED',
        endDate: new Date()
      }
    });

    // 6.2 สร้างประวัติใหม่: เปิดบิล Subscription รอบใหม่ตามโควตาของแพ็กเกจใหม่
    if (allowedModuleIds.length > 0) {
      const subscriptionData = allowedModuleIds.map(modId => ({
        companyId: companyId,
        moduleId: modId,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: null 
      }));

      await tx.orgSubscription.createMany({
        data: subscriptionData
      });
    }

     
  }

 // =========================================================
  // 6. DELETE COMPANY (ลบบริษัท - รองรับ HQ และ Reseller/Parent)
  // =========================================================
  async remove(id: number, userId: number) {
    // 1. ตรวจสิทธิ์พื้นฐานก่อนว่าอยู่ในสายงานที่มองเห็นกันได้หรือไม่
    await this.verifyAccess(id, userId);

    // 2. ดึงข้อมูล User และดึง Company ID ที่ User สังกัดอยู่
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId },
      include: { company: true, role: true }
    });

    const userCompanyIds = userRoles.map(ur => ur.companyId).filter(cId => cId !== null);
    
    // ตรวจสอบว่าเป็น HQ (Global Admin) หรือไม่
    const isGlobalAdmin = userRoles.some(ur => 
      ur.company?.licenseHolderId === null && 
      ur.role?.name?.toUpperCase() === 'SUPER_ADMIN'
    );

    // 3. ดึงข้อมูลบริษัทเป้าหมายที่กำลังจะถูกลบ
    const targetCompany = await this.prisma.orgCompany.findUnique({
      where: { id },
      select: { id: true, parentId: true, licenseHolderId: true }
    });

    if (!targetCompany) {
      throw new NotFoundException('ไม่พบข้อมูลบริษัทที่ต้องการลบ');
    }

    // 4. 🛡️ ตรวจสอบเงื่อนไขการลบ (Business Logic)
    // เช็กว่า User คนนี้เป็น "บริษัทแม่" หรือ "ตัวแทนจำหน่าย" ของบริษัทเป้าหมายหรือไม่
    const isParentOrReseller = userCompanyIds.some(cId => 
      cId === targetCompany.licenseHolderId || cId === targetCompany.parentId
    );

    if (!isGlobalAdmin && !isParentOrReseller) {
      throw new ForbiddenException('❌ คุณไม่มีสิทธิ์ลบบริษัทนี้ (ต้องเป็นสำนักงานใหญ่ หรือบริษัทตัวแทนจำหน่ายดูแลบริษัทนี้เท่านั้น)');
    }

    // 🛡️ ป้องกันความผิดพลาด: ห้าม User กดลบบริษัทของตัวเอง (ป้องกันการลบตัวเองทิ้งจนเข้าใช้งานไม่ได้)
    if (userCompanyIds.includes(id) && !isGlobalAdmin) {
      throw new ForbiddenException('❌ ไม่อนุญาตให้ลบบริษัทที่ตนเองสังกัดอยู่ กรุณาติดต่อตัวแทนจำหน่ายหรือสำนักงานใหญ่หากต้องการยกเลิกการใช้งาน');
    }

    // 5. 🗑️ ดำเนินการลบแบบ Cascade ภายใน Transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.secUserRole.deleteMany({ where: { companyId: id } });
      await tx.secRoleMenu.deleteMany({ where: { role: { companyId: id } } });
      await tx.secRolePermission.deleteMany({ where: { role: { companyId: id } } });
      await tx.secRole.deleteMany({ where: { companyId: id } });
      
      // ลบข้อมูลการสมัครแพ็กเกจและบิล
      await tx.orgSubscription.deleteMany({ where: { companyId: id } });
      await tx.orgBillingHistory.deleteMany({ where: { companyId: id } });
      
      // ลบข้อมูลระบบ AI
      await tx.intAiBot.deleteMany({ where: { companyId: id } });
      await tx.intAiQuota.deleteMany({ where: { companyId: id } });
      
      // ลบข้อมูลเอกสารและข้อมูลนิติบุคคล
      await tx.orgCompanyDocument.deleteMany({ where: { companyId: id } });
      await tx.orgCompanyInfo.deleteMany({ where: { companyId: id } });
      
      // ✨ [เพิ่มตรงนี้] ลบข้อมูลตัวเลือกย่อยที่บริษัทนี้สร้างขึ้นเองในระบบ Master Data
      await tx.cfgMasterData.deleteMany({ where: { companyId: id } });

      
      // ลบบันทึกข้อมูลบริษัทจากตารางหลักเป็นขั้นตอนสุดท้าย
      return tx.orgCompany.delete({ where: { id } });
    });
  }

 // =======================================================================
  // 🌐 PUBLIC API: ดึงข้อมูล Branding สำหรับหน้า Login (เวอร์ชัน Clean)
  // =======================================================================
  async getPublicBranding(cid?: number, shopId?: number) {
    
    // 🏪 [STEP 1] ระดับร้านค้า (Shop Level)
    if (shopId && !isNaN(shopId)) {
      const shop = await this.prisma.comShopProfile.findUnique({
        where: { id: shopId },
        include: { logoMedia: true }
      });

      if (shop) {
        const parentCompany = shop.companyId 
          ? await this.prisma.orgCompany.findUnique({ where: { id: shop.companyId } }) 
          : null;

        return {
          level: 'SHOP',
          id: shop.id,
          name: shop.shopName, 
          registeredName: shop.shopName,
          primaryColor: shop.primaryColor || parentCompany?.primaryColor || '#4F46E5',
          secondaryColor: shop.secondaryColor || parentCompany?.secondaryColor || '#303169',
          buttonColor: parentCompany?.buttonColor || shop.primaryColor || '#10B981',
          fontFamily: shop.bodyFont || parentCompany?.fontFamily || 'Kanit',
          fontHeadingFamily: shop.headingFont || parentCompany?.fontHeadingFamily || 'Kanit',
          fontSizeBase: parentCompany?.fontSizeBase || 16,
          logoUrl: shop.logoMedia?.url || null,
        };
      }
    }

    // 🏢 [STEP 2] ระดับบริษัท (Company / HQ Level)
    let whereCondition: Prisma.OrgCompanyWhereInput = { isActive: true };

    if (cid && !isNaN(cid)) {
      whereCondition.id = cid;
    } else {
      whereCondition.licenseHolderId = null;
      whereCondition.parentId = null; 
    }

    const company = await this.prisma.orgCompany.findFirst({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        primaryColor: true,
        secondaryColor: true,
        buttonColor: true,
        fontFamily: true,
        fontHeadingFamily: true,
        fontSizeBase: true,
        companyInfo: {
          select: {
            logoMedia: true, 
            registeredName: true
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    if (!company) {
      throw new NotFoundException('ไม่พบข้อมูลระบบของบริษัทนี้');
    }

    return {
      level: 'COMPANY',
      id: company.id,
      name: company.name,
      registeredName: company.companyInfo?.registeredName || '',
      primaryColor: company.primaryColor || '#4F46E5',
      secondaryColor: company.secondaryColor || '#303169',
      buttonColor: company.buttonColor || '#10B981',
      fontFamily: company.fontFamily || 'Kanit',
      fontHeadingFamily: company.fontHeadingFamily || 'Kanit',
      fontSizeBase: company.fontSizeBase || 16,
      logoUrl: company.companyInfo?.logoMedia?.url || null, // 🟢 ดึงตรง ๆ จากตารางที่ถูกต้อง
    };
  }

  // =========================================================
  // 7. TOP UP
  // =========================================================
  async topUpCredits(id: number, amount: number, userId: number) {
    await this.verifyAccess(id, userId); // 🛡️ ตรวจสิทธิ์
    return this.prisma.orgCompany.update({
      where: { id },
      data: { paidCredits: { increment: amount } }
    });
  }

  // =========================================================
  // 8. GET SUBSCRIPTIONS (ดึงรายการโมดูลของบริษัท)
  // =========================================================
  async getSubscriptions(companyId: number, userId: number) {
    await this.verifyAccess(companyId, userId); // 🛡️ ตรวจสิทธิ์ก่อนว่าดูได้ไหม

    // ดึงข้อมูล Subscription ทั้งหมดของบริษัทนี้ พร้อมชื่อโมดูล
    return this.prisma.orgSubscription.findMany({
      where: { companyId: companyId },
      include: { 
        module: true // 🚩 ดึงรายละเอียดของ Module (เช่น ชื่อ, โค้ด) ติดมาด้วย
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}