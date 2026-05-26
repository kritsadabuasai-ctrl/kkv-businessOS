import { Injectable, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; 
import { MailService } from '../../int/mail/mail.service'; 
import { CreateTenantDto } from './onboarding.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService, 
  ) {}

  private generateRandomPassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async onboardNewTenant(dto: CreateTenantDto) {
    // 1. เช็คข้อมูลซ้ำ (รหัสบริษัท)
    const existingCompany = await this.prisma.orgCompany.findFirst({ 
      where: { code: dto.companyCode } 
    });
    if (existingCompany) throw new BadRequestException('รหัสบริษัทนี้มีผู้ใช้งานแล้ว');

    // 🌟 2. เช็ค User ว่ามีอยู่แล้วหรือไม่
    const existingUser = await this.prisma.secUser.findFirst({
      where: { OR: [{ username: dto.adminUsername }, { email: dto.adminEmail }] }
    });

    if (existingUser && !(dto as any).isConfirmLink) {
      throw new HttpException({
        status: 'USER_EXISTS_CONFIRMATION_REQUIRED',
        message: 'อีเมลหรือชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว คุณต้องการใช้บัญชีเดิมเพื่อเป็นผู้ดูแลระบบของบริษัทใหม่หรือไม่?'
      }, HttpStatus.CONFLICT); 
    }

    const packageInfo = await this.prisma.sysPackage.findUnique({
      where: { id: dto.packageId }
    });
    if (!packageInfo) throw new BadRequestException('ไม่พบข้อมูลแพ็กเกจที่เลือก');

    // 3. สุ่มรหัสผ่านและ Hash
    const plainPassword = this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // 4. ดึงข้อมูลบริษัทแม่ (HQ) เพื่อเอามาเป็น License Holder ให้กับลูกค้าที่สมัครเอง
    // 💡 ค้นหา HQ ตัวจริง (คนที่ไม่มีใครเป็นนาย licenseHolderId: null)
    const hqCompany = await this.prisma.orgCompany.findFirst({
      where: { licenseHolderId: null },
      orderBy: { id: 'asc' }, 
    });

    let welcomeTemplate: any = null; 
    if (hqCompany) {
      welcomeTemplate = await this.prisma.comTemplate.findFirst({
        where: { 
          code: 'WELCOME_EMAIL', 
          channel: 'EMAIL',
          companyId: hqCompany.id 
        }
      });
    }

    // 5. เริ่ม Transaction สร้างบ้านให้ลูกค้า
    return this.prisma.$transaction(async (tx) => {
        
      // 🌟🌟 ลอจิกใหม่: คำนวณหา License Holder และ Parent อย่างถูกต้อง
      let finalLicenseHolderId = dto.licenseHolderId || null;

      if (!finalLicenseHolderId) {
        if (hqCompany) {
          // กรณีมี HQ ในระบบแล้ว และลูกค้าสมัครผ่านหน้าเว็บตรงๆ (ไม่มีตัวแทน)
          // ให้ลูกค้าคนนี้ตกเป็น "สายตรงของ HQ" ทันที
          finalLicenseHolderId = hqCompany.id;
        } else {
          // กรณีเพิ่งลงระบบใหม่เอี่ยม (Database ว่างเปล่า)
          // ให้บริษัทที่เพิ่งสมัครนี้ กลายเป็น HQ ทันที! (licenseHolderId = null)
          finalLicenseHolderId = null;
        }
      }

      // 5.1 สร้างบริษัทพร้อมผูกสายงาน (Licensed Group)
      const company = await tx.orgCompany.create({
        data: {
          code: dto.companyCode,
          name: dto.companyName,
          companyType: 'CORPORATE',
          packageId: dto.packageId,
          licenseHolderId: finalLicenseHolderId, 
          parentId: finalLicenseHolderId, // ให้คนที่ถือลิขสิทธิ์ เป็นพ่อไปเลย
          isReseller: dto.isReseller || false, // 🌟 บันทึกสถานะตัวแทนจำหน่ายด้วย
          fontFamily: 'Kanit',        // ค่าเริ่มต้นสำหรับภาษาไทยที่อ่านง่าย
          fontHeadingFamily: 'Kanit', // ค่าเริ่มต้นสำหรับหัวข้อ
          fontSizeBase: 16,           // ขนาดมาตรฐาน 16px
        },
      });

      // =======================================================
      // 🤖 5.1.5 COPY AI BOTS จาก HQ มาให้บริษัทใหม่
      // =======================================================
      const hqBots = await tx.intAiBot.findMany({
        where: { 
          company: { licenseHolderId: null }, // 🌟 บังคับดึงจาก HQ ตัวจริงเสมอ!
          isActive: true 
        }
      });

      // ถ้า HQ มีบอท ให้ทำการคัดลอก (Copy) ข้อมูลมาสร้างใหม่ให้บริษัทนี้
      if (hqBots.length > 0) {
        const botsToCreate = hqBots.map(bot => ({
          companyId: company.id,          // 🌟 เปลี่ยนเจ้าของเป็นบริษัทที่เพิ่งสมัครใหม่
          isSystem: bot.isSystem,         // 🌟 [NEW] สำคัญมาก! ต้องก๊อปปี้สถานะ System Bot มาด้วย
          code: bot.code,                 // รหัสบอท (เช่น PRODUCT_AUTO_TAG)
          name: bot.name,                 // ชื่อบอท
          description: bot.description,
          provider: bot.provider,
          modelName: bot.modelName,
          temperature: bot.temperature,
          systemPrompt: bot.systemPrompt,
          greetingMessage: bot.greetingMessage,
          canUseTools: bot.canUseTools,
          isActive: bot.isActive
          
        }));

        // ใช้ createMany เพื่อ Insert ลง Database ทีเดียวรวด
        await tx.intAiBot.createMany({
          data: botsToCreate
        });
        
        this.logger.log(`[Onboarding] คัดลอก AI Bots จำนวน ${hqBots.length} ตัว จาก HQ สำเร็จ`);
      }

      // 5.3 สร้างสาขาหลัก (Shop)
      const shop = await tx.comShopProfile.create({
        data: {
          companyId: company.id,
          shopCode: `${dto.companyCode}-MAIN`,
          shopName: `${dto.companyName} (สาขาหลัก)`,
          isMainShop: true,
        },
      });

      // 🌟 5.4 ตรวจสอบและสร้าง/ผูก User
      let user = await tx.secUser.findFirst({
        where: { OR: [{ username: dto.adminUsername }, { email: dto.adminEmail }] }
      });
      let isNewUser = false;

      if (!user) {
        user = await tx.secUser.create({
          data: {
            username: dto.adminUsername,
            email: dto.adminEmail,
            passwordHash: hashedPassword, 
            fullName: dto.adminFullName,
          },
        });
        isNewUser = true;
      }

      const role = await tx.secRole.create({
        data: {
          companyId: company.id,
          name: 'SUPER_ADMIN', 
          displayName: 'ผู้ดูแลระบบสูงสุด', 
          isSystem: true,
        },
      });

      await tx.secUserRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
          companyId: company.id,
        },
      });

      await tx.intAiQuota.create({
        data: {
          companyId: company.id,
          tier: packageInfo.name, // 🚩 เปลี่ยนเป็นชื่อแพ็กเกจเลย เช่น "Starter Pack", "Enterprise"
          
          // 🚩 ดึงโควตา Token จากแพ็กเกจ ถ้าไม่ได้ใส่ไว้ให้ Default ที่ 0
          monthlyLimit: packageInfo.aiTokenLimit ? packageInfo.aiTokenLimit : BigInt(0), 
          
          // 🚩 ดึงพื้นที่เก็บข้อมูลมาคำนวณ (แปลงจาก Megabytes เป็น Bytes)
          maxStorageBytes: BigInt(packageInfo.maxStorageMB || 500) * BigInt(1024 * 1024), 
        },
      });


      // =======================================================
      // 💰 คำนวณราคา และสร้างบิล (Billing History)
      // =======================================================
      // เงื่อนไขได้ราคาส่ง (Wholesale): สมัครเป็นตัวแทน(isReseller) หรือ ตัวแทนเป็นคนสมัครให้ลูกข่าย (มี licenseHolderId ที่ไม่ใช่ HQ)
      const isWholesale = dto.isReseller || (finalLicenseHolderId && hqCompany && finalLicenseHolderId !== hqCompany.id);
      const currentPriceType = isWholesale ? 'RESELLER' : 'NORMAL';
      
      // ถ้าระบบมองว่าเป็น Wholesale ให้ดึง resellerPrice มาใช้ (ถ้าไม่มีให้ใช้ราคาปกติ) หรือยึดตาม dto.paidAmount ที่ส่งมา
      const finalPaidPrice = dto.paidAmount !== undefined 
          ? dto.paidAmount 
          : (isWholesale ? (packageInfo.resellerPrice ?? packageInfo.price) : packageInfo.price);

      // 🌟 สร้างใบเสร็จ/บิล ก่อน เพื่อเอา ID ไปผูกกับ Subscription
      const billingHistory = await tx.orgBillingHistory.create({
        data: {
          companyId: company.id,
          action: 'NEW_PACKAGE', 
          packageId: dto.packageId,
          price: !isWholesale ? finalPaidPrice : null,                 
          resellerPrice: isWholesale ? finalPaidPrice : null, 
          operatorId: user.id, 
          note: `Initial activation (${isWholesale ? 'Reseller/Wholesale' : 'Retail'} Price: ฿${finalPaidPrice})` 
        }
      });


      // =======================================================
      // 🌟🌟 จัดการเรื่อง Subscription, สิทธิ์ (Permission) และเมนู (Menu)
      // =======================================================
      
      const coreModules = await tx.sysModule.findMany({
        where: { code: { in: ['MOD_CORE', 'MOD_ORG'] } },
        select: { id: true }
      });
      let allowedModuleIds = coreModules.map(m => m.id);

      const packageModules = await tx.sysPackageModule.findMany({
        where: { packageId: dto.packageId },
        select: { moduleId: true }
      });
      
      const pkgModuleIds = packageModules.map(m => m.moduleId);
      allowedModuleIds = [...allowedModuleIds, ...pkgModuleIds];
      allowedModuleIds = Array.from(new Set(allowedModuleIds));

      if (allowedModuleIds.length > 0) {
        // 🌟 สร้าง Subscription พร้อมฝังข้อมูลราคาและลิงก์บิล
        const subscriptionData = allowedModuleIds.map(modId => ({
          companyId: company.id,
          moduleId: modId,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: null,
          paidAmount: finalPaidPrice,           // 💸 ผูกข้อมูลการเงิน
          priceType: currentPriceType,          // 💸 ผูกประเภทราคา
          lastBillingId: billingHistory.id      // 🔗 ผูกใบเสร็จ
        }));
        await tx.orgSubscription.createMany({ data: subscriptionData });
      }

      const permissionFilter = {
        OR: [{ moduleId: { equals: null } }, { moduleId: { in: allowedModuleIds } }]
      };
      
      const menuFilter = {
        AND: [
          {
            OR: [
              { isSystem: false }, 
              { moduleId: { equals: null } }, 
              { moduleId: { in: allowedModuleIds } } 
            ]
          },
          { 
            path: { 
              not: { contains: '/onboarding' } 
            } 
          } 
        ]
      };

      const [allowedPermissions, allowedMenus] = await Promise.all([
        tx.secPermission.findMany({ where: permissionFilter }),
        tx.secMenu.findMany({ where: menuFilter })
      ]);

      if (allowedPermissions.length > 0) {
        await tx.secRolePermission.createMany({
          data: allowedPermissions.map(p => ({ roleId: role.id, permissionId: p.id }))
        });
      }

      if (allowedMenus.length > 0) {
        await tx.secRoleMenu.createMany({
          data: allowedMenus.map(m => ({ roleId: role.id, menuId: m.id, sortOrder: m.sortOrder }))
        });
      }

      // 🌟 6. กระบวนการแทนที่คำใน Template และส่งอีเมล
      if (welcomeTemplate) {
        try {
          let emailHtml = welcomeTemplate.content;
          emailHtml = emailHtml.replace(/{{adminFullName}}/g, dto.adminFullName);
          emailHtml = emailHtml.replace(/{{companyName}}/g, dto.companyName);
          emailHtml = emailHtml.replace(/{{adminUsername}}/g, dto.adminUsername);
          
          const displayPassword = isNewUser ? plainPassword : '(ใช้รหัสผ่านเดิมของบัญชีคุณ)';
          emailHtml = emailHtml.replace(/{{password}}/g, displayPassword);
          
          let finalLoginUrl = 'http://localhost:5555/login';

          if (process.env.FRONTEND_ADMIN) {
            finalLoginUrl = process.env.FRONTEND_ADMIN;
          }

          try {
            const dbConfig = await tx.cfgSystem.findUnique({ 
              where: { key: 'FRONTEND_ADMIN' } 
            });
            
            if (dbConfig && dbConfig.value) {
              finalLoginUrl = dbConfig.value;
            }
          } catch (error) {
            this.logger.warn(`[Onboarding] ไม่พบค่า FRONTEND_ADMIN ใน SysConfig, สลับไปใช้ค่าตั้งต้นแทน`);
          }
          
          emailHtml = emailHtml.replace(/{{loginUrl}}/g, finalLoginUrl);

          await this.mailService.sendEmail({
            to: dto.adminEmail,
            subject: welcomeTemplate.subject, 
            html: emailHtml, 
          } as any); 

          this.logger.log(`[Onboarding] Welcome email sent to ${dto.adminEmail} using HQ template.`);
        } catch (mailError: any) {
          this.logger.error(`[Onboarding] Failed to send welcome email`, mailError.stack);
        }
      } else {
        this.logger.warn(`[Onboarding] Template 'WELCOME_EMAIL' for HQ not found. Skip sending email.`);
      }

      return {
        message: isNewUser 
          ? 'สร้างบริษัทสำเร็จ (พร้อมผูกสิทธิ์ตามแพ็กเกจเรียบร้อยแล้ว)'
          : 'สร้างบริษัทสำเร็จ (และผูกบัญชีเดิมของคุณเรียบร้อยแล้ว)',
        companyId: company.id,
        shopId: shop.id,
        userId: user.id,
      };
    });
  }
}