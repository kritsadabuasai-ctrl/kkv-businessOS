import { PrismaClient ,ResetCriteria } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🔥 Cloud Database: Force cleaning all tables (Deep Clean)...');

  // =========================================================
  // 🧹 1. CLEANUP SECTION (Child -> Parent)
  // =========================================================
  try {
    await prisma.sysPackageModule.deleteMany({}); // ✅ ลบการจับคู่ Package เก่า
    await prisma.sysAiModelConfig.deleteMany({}); // ✅ เพิ่มบรรทัดนี้: ลบเรทราคา AI เก่า
    await prisma.sysPackage.deleteMany({});       // ✅ ลบ Package เก่า
  
    await prisma.comTemplate.deleteMany({});
    await prisma.cfgRunningFormat.deleteMany({});
    await prisma.cfgBank.deleteMany({});
    await prisma.cfgSystem.deleteMany({});
    await prisma.orgSubscription.deleteMany({});
    await prisma.secUserRole.deleteMany({});
    await prisma.secRolePermission.deleteMany({});
    await prisma.secRoleMenu.deleteMany({});
    await prisma.secUser.deleteMany({});
    await prisma.secRole.deleteMany({});
    await prisma.secPermission.deleteMany({});
    await prisma.secMenu.deleteMany({});
    await prisma.intMessageQueue.deleteMany({}); 
    // ลบข้อมูลที่เกี่ยวข้องกับ E-Commerce ก่อน เพราะมีการเชื่อมโยงกัน
    await prisma.comProduct.deleteMany({});
    await prisma.intAiQuota.deleteMany({});
    // 🌟 เพิ่มการลบ Master Data (ลบลูกก่อน)
    await prisma.cfgMasterData.deleteMany({}); 
    // 🌟 แล้วค่อยลบกลุ่มแม่
    await prisma.cfgMasterGroup.deleteMany({});
    await prisma.orgCompany.deleteMany({});
    await prisma.sysModule.deleteMany({});

    console.log('✨ Cleanup Success!');
  } catch (error) {
    console.warn('⚠️ Cleanup warning: Some tables might be empty.', error);
  }

  console.log('🌱 Starting Seed for kkv-Mainservice...');

  await seedProductCategories();
  await seedBoxSizes();
  await seedProductUnits();
  await seedRoundingTypes();
  await seedCompanyTypes();
  
  // =========================================================
  // 2. สร้าง MODULES
  // =========================================================
  console.log('📦 Seeding Modules...');
  const modulesData = [
    { code: 'MOD_CORE', name: 'Core System', sortOrder: 1 },
    { code: 'MOD_ORG', name: 'Organization Management', sortOrder: 2 },
    { code: 'MOD_HR', name: 'Human Resources', sortOrder: 3 },
    { code: 'MOD_CRM', name: 'Customer Relationship', sortOrder: 4 },
    { code: 'MOD_COM', name: 'E-Commerce & Sales', sortOrder: 5 },
    { code: 'MOD_INT', name: 'Integration & AI', sortOrder: 6 },
  ];

  const moduleMap: Record<string, any> = {};
  for (const m of modulesData) {
    moduleMap[m.code] = await prisma.sysModule.upsert({
      where: { code: m.code },
      update: { name: m.name, sortOrder: m.sortOrder },
      create: { code: m.code, name: m.name, sortOrder: m.sortOrder, isActive: true }
    });
  }

  // =========================================================
  // 🆕 2.1 สร้าง PACKAGES (และผูก Module)
  // =========================================================
  console.log('📦 Seeding Packages & Linking Modules...');

  const packagesData = [
    {
      code: 'STARTER',
      name: 'Starter Pack',
      price: 0,
      maxCompanies: 1,
      maxUsers: 5,
      maxStorageMB: 500,
      // แพ็กเกจเริ่มต้น ได้แค่ระบบพื้นฐาน + HR
      modules: ['MOD_CORE', 'MOD_ORG', 'MOD_HR'] 
    },
    {
      code: 'PRO',
      name: 'Professional',
      price: 1590,
      maxCompanies: 3,
      maxUsers: 20,
      maxStorageMB: 5000,
      // แพ็กเกจโปร ได้ CRM และ ระบบขายเพิ่มมา
      modules: ['MOD_CORE', 'MOD_ORG', 'MOD_HR', 'MOD_CRM', 'MOD_COM']
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      price: 4990,
      maxCompanies: 10,
      maxUsers: 100,
      maxStorageMB: 50000,
      // แพ็กเกจใหญ่ ได้ครบทุกอย่างรวมถึง AI
      modules: ['MOD_CORE', 'MOD_ORG', 'MOD_HR', 'MOD_CRM', 'MOD_COM', 'MOD_INT']
    }
  ];

  const packageMap: Record<string, any> = {};

  for (const p of packagesData) {
    // 1. สร้าง Package
    const pkg = await prisma.sysPackage.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        price: p.price,
        maxCompanies: p.maxCompanies,
        maxUsers: p.maxUsers,
        maxStorageMB: p.maxStorageMB
      },
      create: {
        code: p.code,
        name: p.name,
        price: p.price,
        maxCompanies: p.maxCompanies,
        maxUsers: p.maxUsers,
        maxStorageMB: p.maxStorageMB,
        isActive: true
      }
    });
    
    packageMap[p.code] = pkg;

    // 2. ผูก Module เข้ากับ Package (SysPackageModule)
    // ลบของเก่าก่อนกันเบิ้ล (กรณีรันซ้ำ)
    await prisma.sysPackageModule.deleteMany({ where: { packageId: pkg.id } });

    // หา ID ของ Module ตาม Code ที่ระบุไว้ใน packagesData
    const moduleIdsToLink = p.modules
      .map(mCode => moduleMap[mCode]?.id)
      .filter(id => id !== undefined);

    if (moduleIdsToLink.length > 0) {
      await prisma.sysPackageModule.createMany({
        data: moduleIdsToLink.map(mid => ({
          packageId: pkg.id,
          moduleId: mid
        }))
      });
      console.log(`   Linked ${moduleIdsToLink.length} modules to package ${p.code}`);
    }
  }

  // =========================================================
  // 3. สร้าง COMPANY (HQ)
  // =========================================================
  console.log('🏢 Creating HQ Company...');
  
  const compHQ = await prisma.orgCompany.upsert({
    where: { code: 'HQ' },
    update: {
      // อัปเดตให้ HQ ใช้แพ็กเกจ Enterprise เสมอ
      packageId: packageMap['ENTERPRISE']?.id,
      paidCredits: 9999, // เติมเครดิตให้ด้วยเอาไว้เทส AI
    },
    create: { 
      code: 'HQ', 
      name: 'KKV business Officail', 
      companyType: 'CORPORATE',
      packageId: packageMap['ENTERPRISE']?.id, // ผูก Package Enterprise
      paidCredits: 500,
      companyInfo: {
        create: {
            registeredName: 'บริษัท เคเควี บิซิเนส จำกัด',
            branchCode: '00000',
            email: 'kritsada.b@kkvservice.com'
        }
      }
    }
  });

  // =========================================================
  // 3.1 สร้าง AI QUOTA ให้กับบริษัท HQ
  // =========================================================
  console.log('🤖 Creating AI Quota for KKV...');
  
  // แปลงค่าจาก MB ในแพ็กเกจ เป็น Bytes สำหรับฐานข้อมูล
  const enterpriseStorageMB = packageMap['ENTERPRISE']?.maxStorageMB || 50000;
  const maxStorageBytes = BigInt(enterpriseStorageMB * 1024 * 1024);
  
  // โควตา Token ต่อเดือน (ให้ HQ 5 แสน Token)
  const monthlyTokens = BigInt(500000);

  await prisma.intAiQuota.upsert({
    where: { companyId: compHQ.id },
    update: {
      tier: 'ENTERPRISE',
      monthlyLimit: monthlyTokens,
      maxStorageBytes: maxStorageBytes,
      extraCredit: BigInt(0)
    },
    create: {
      companyId: compHQ.id,
      tier: 'ENTERPRISE',
      monthlyLimit: monthlyTokens,
      maxStorageBytes: maxStorageBytes,
      usedThisMonth: BigInt(0),
      usedStorageBytes: BigInt(0),
      extraCredit: BigInt(0)
    }
  });
  console.log('✅ AI Quota created for KKV!');

 // =========================================================
  // 4. สร้าง SUBSCRIPTIONS (Legacy Support)
  // =========================================================
  // ยังคงสร้าง Subscription แยกไว้ด้วย เพื่อรองรับ Logic เก่าที่อาจจะยังเช็คจาก OrgSubscription
  console.log('📦 Activating Legacy Subscriptions for KKV...');
  for (const moduleCode in moduleMap) {
    
    // 1. ค้นหาดูว่ามี Subscription ของโมดูลนี้ที่ยัง 'ACTIVE' อยู่หรือไม่
    const existingSub = await prisma.orgSubscription.findFirst({
      where: { 
        companyId: compHQ.id, 
        moduleId: moduleMap[moduleCode].id,
        status: 'ACTIVE'
      }
    });

    // 2. ถ้ายังไม่มี (หรืออันเก่า EXPIRED ไปแล้ว) ให้สร้าง History ใหม่
    if (!existingSub) {
      await prisma.orgSubscription.create({
        data: {
          companyId: compHQ.id,
          moduleId: moduleMap[moduleCode].id,
          status: 'ACTIVE',
          startDate: new Date(),
        }
      });
    }
  }

  // =========================================================
  // 5. สร้าง PERMISSIONS
  // =========================================================
  const permissionsList = [
    // --- 🏢 Company & Organization ---
    { resource: 'company', action: 'view', desc: 'ดูข้อมูลบริษัท', mod: 'MOD_ORG' },
    { resource: 'company', action: 'create', desc: 'สร้างบริษัทใหม่', mod: 'MOD_ORG' },
    { resource: 'company', action: 'update', desc: 'แก้ไขข้อมูลบริษัท', mod: 'MOD_ORG' },
    { resource: 'company', action: 'delete', desc: 'ลบบริษัท', mod: 'MOD_ORG' },

    { resource: 'package', action: 'view', desc: 'ดูรายการ Package', mod: 'MOD_CORE' },
    { resource: 'package', action: 'create', desc: 'สร้าง Package ใหม่', mod: 'MOD_CORE' },
    { resource: 'package', action: 'update', desc: 'แก้ไข Package', mod: 'MOD_CORE' },
    { resource: 'package', action: 'delete', desc: 'ลบ Package ออกจากระบบ', mod: 'MOD_CORE' },

    // --- 🔑 Security & Roles ---
    { resource: 'role', action: 'view', desc: 'ดูรายการสิทธิ์และ Matrix', mod: 'MOD_CORE' },
    { resource: 'role', action: 'create', desc: 'สร้างระดับสิทธิ์ใหม่', mod: 'MOD_CORE' },
    { resource: 'role', action: 'update', desc: 'แก้ไขสิทธิ์/ติ๊ก Matrix', mod: 'MOD_CORE' },
    { resource: 'role', action: 'delete', desc: 'ลบระดับสิทธิ์', mod: 'MOD_CORE' },

    { resource: 'user', action: 'view', desc: 'ดูรายชื่อและโปรไฟล์พนักงาน', mod: 'MOD_CORE' },
    { resource: 'user', action: 'create', desc: 'เพิ่มพนักงานใหม่เข้าสู่ระบบ', mod: 'MOD_CORE' },
    { resource: 'user', action: 'update', desc: 'แก้ไขข้อมูลพนักงาน/เปลี่ยนรหัสผ่าน', mod: 'MOD_CORE' },
    { resource: 'user', action: 'delete', desc: 'ลบพนักงานออกจากระบบ', mod: 'MOD_CORE' },

    // --- 🛠️ System Config ---
    { resource: 'module', action: 'view', desc: 'ดูรายการโมดูลระบบ', mod: 'MOD_CORE' },
    { resource: 'module', action: 'update', desc: 'แก้ไขข้อมูลโมดูล', mod: 'MOD_CORE' },
    { resource: 'menu', action: 'view', desc: 'ดูโครงสร้างเมนูระบบ', mod: 'MOD_CORE' },
    { resource: 'menu', action: 'update', desc: 'แก้ไขลำดับหรือชื่อเมนู', mod: 'MOD_CORE' },
    { resource: 'auth', action: 'view', desc: 'ดูวิธีการเข้าสู่ระบบ', mod: 'MOD_CORE' },
    { resource: 'auth', action: 'update', desc: 'ตั้งค่า Social Login', mod: 'MOD_CORE' },

    { resource: 'audit', action: 'view', desc: 'ดูประวัติการใช้งานระบบ', mod: 'MOD_CORE' },
    { resource: 'audit', action: 'create', desc: 'เพิ่มข้อมูล Audit ใหม่', mod: 'MOD_CORE' },

    { resource: 'msg_log', action: 'view', desc: 'ดูประวัติการ message log', mod: 'MOD_CORE' },
    { resource: 'msg_log', action: 'create', desc: 'เพิ่มข้อมูล Message Log ใหม่', mod: 'MOD_CORE' },

    { resource: 'notifications', action: 'view', desc: 'ดูประวัติการส่งข้อความ', mod: 'MOD_CORE' },
    { resource: 'notifications', action: 'create', desc: 'สร้างข้อความแจ้งเตือนใหม่', mod: 'MOD_CORE' },
    { resource: 'notifications', action: 'update', desc: 'แก้ไขข้อความแจ้งเตือน', mod: 'MOD_CORE' },
   
    { resource: 'template', action: 'view', desc: 'ดูประวัติการใช้งาน Template', mod: 'MOD_CORE' },
    { resource: 'template', action: 'create', desc: 'สร้าง Template ใหม่', mod: 'MOD_CORE' },
    { resource: 'template', action: 'update', desc: 'แก้ไข Template', mod: 'MOD_CORE' },
    { resource: 'template', action: 'delete', desc: 'ลบ Template ออกจากระบบ', mod: 'MOD_CORE' },

    { resource: 'workflow', action: 'view', desc: 'ดูประวัติการใช้งาน Workflow', mod: 'MOD_CORE' },
    { resource: 'workflow', action: 'create', desc: 'สร้าง Workflow ใหม่', mod: 'MOD_CORE' },
    { resource: 'workflow', action: 'update', desc: 'แก้ไข Workflow', mod: 'MOD_CORE' },
    { resource: 'workflow', action: 'delete', desc: 'ลบ Workflow ออกจากระบบ', mod: 'MOD_CORE' },

    
    { resource: 'cfg:master', action: 'view', desc: 'ดูประวัติการใช้งาน Master Data', mod: 'MOD_CORE' },
    { resource: 'cfg:master', action: 'create', desc: 'สร้าง Master Data ใหม่', mod: 'MOD_CORE' },
    { resource: 'cfg:master', action: 'update', desc: 'แก้ไข Master Data', mod: 'MOD_CORE' },
    { resource: 'cfg:master', action: 'delete', desc: 'ลบ Master Data ออกจากระบบ', mod: 'MOD_CORE' },

    { resource: 'cfg:running', action: 'view', desc: 'ดูประวัติการใช้งาน Running Data', mod: 'MOD_CORE' },
    { resource: 'cfg:running', action: 'create', desc: 'สร้าง Running Data ใหม่', mod: 'MOD_CORE' },
    { resource: 'cfg:running', action: 'update', desc: 'แก้ไข Running Data', mod: 'MOD_CORE' },
    { resource: 'cfg:running', action: 'delete', desc: 'ลบ Running Data ออกจากระบบ', mod: 'MOD_CORE' },

    { resource: 'cfg:rounding', action: 'view', desc: 'ดูประวัติการใช้งาน Rounding Data', mod: 'MOD_CORE' },
    { resource: 'cfg:rounding', action: 'create', desc: 'สร้าง Rounding Data ใหม่', mod: 'MOD_CORE' },
    { resource: 'cfg:rounding', action: 'update', desc: 'แก้ไข Rounding Data', mod: 'MOD_CORE' },
    { resource: 'cfg:rounding', action: 'delete', desc: 'ลบ Rounding Data ออกจากระบบ', mod: 'MOD_CORE' },

    

    { resource: 'cfg:system', action: 'view', desc: 'ดูประวัติการใช้งาน System Data', mod: 'MOD_CORE' },
    { resource: 'cfg:system', action: 'update', desc: 'แก้ไข System Data', mod: 'MOD_CORE' },
    { resource: 'cfg:system', action: 'delete', desc: 'ลบ System Data ออกจากระบบ', mod: 'MOD_CORE' },

    { resource: 'password-policy', action: 'update', desc: 'แก้ไข Password Policy', mod: 'MOD_CORE' },
    { resource: 'password-policy', action: 'view', desc: 'ดูข้อมูล Password Policy', mod: 'MOD_CORE' },

    { resource: 'company-security', action: 'update', desc: 'แก้ไข company-security', mod: 'MOD_CORE' },
    { resource: 'company-security', action: 'view', desc: 'ดูข้อมูล company-security', mod: 'MOD_CORE' },
    

    { resource: 'delegation', action: 'view', desc: 'ดูประวัติการใช้งาน Rounding Data', mod: 'MOD_CORE' },
    { resource: 'delegation', action: 'create', desc: 'สร้าง Rounding Data ใหม่', mod: 'MOD_CORE' },
    { resource: 'delegation', action: 'update', desc: 'แก้ไข Rounding Data', mod: 'MOD_CORE' },
    { resource: 'delegation', action: 'delete', desc: 'ลบ Rounding Data ออกจากระบบ', mod: 'MOD_CORE' },
    
    { resource: 'subscription', action: 'view', desc: 'ดูประวัติการใช้งาน subcription', mod: 'MOD_CORE' },
    { resource: 'subscription', action: 'update', desc: 'แก้ไข subcription', mod: 'MOD_CORE' },
   
  

    { resource: 'bank-account', action: 'view', desc: 'ดู/ใช้งานบัญชีธนาคาร', mod: 'MOD_INT' },
    { resource: 'bank-account', action: 'create', desc: 'สร้างบัญชีธนาคารใหม่', mod: 'MOD_INT' },
    { resource: 'bank-account', action: 'update', desc: 'แก้ไขข้อมูลบัญชีธนาคาร', mod: 'MOD_INT' },
    { resource: 'bank-account', action: 'delete', desc: 'ลบบัญชีธนาคารออกจากระบบ', mod: 'MOD_INT' },

    { resource: 'int:ai-batch', action: 'view', desc: 'ดูระบบ batch', mod: 'MOD_INT' },
    { resource: 'int:ai-batch', action: 'create', desc: 'สร้าง ai batch', mod: 'MOD_INT' },
    { resource: 'int:ai-batch', action: 'update', desc: 'แก้ไข ai batch', mod: 'MOD_INT' },
    { resource: 'int:ai-batch', action: 'delete', desc: 'ลบ ai batch', mod: 'MOD_INT' },

    { resource: 'shop-profile', action: 'view', desc: 'ดู/ใช้งานข้อมูลร้านค้า', mod: 'MOD_COM' },
    { resource: 'shop-profile', action: 'create', desc: 'สร้างข้อมูลร้านค้าใหม่', mod: 'MOD_COM' },
    { resource: 'shop-profile', action: 'update', desc: 'แก้ไขข้อมูลร้านค้า', mod: 'MOD_COM' },
    { resource: 'shop-profile', action: 'delete', desc: 'ลบข้อมูลร้านค้าออกจากระบบ', mod: 'MOD_COM' },

    { resource: 'shop-product', action: 'view', desc: 'ดู/ใช้งานข้อมูลสินค้าในร้าน', mod: 'MOD_COM' },
    { resource: 'shop-product', action: 'create', desc: 'สร้างข้อมูลสินค้าในร้านใหม่', mod: 'MOD_COM' },
    { resource: 'shop-product', action: 'update', desc: 'แก้ไขข้อมูลสินค้าในร้าน', mod: 'MOD_COM' },
    { resource: 'shop-product', action: 'delete', desc: 'ลบข้อมูลสินค้าในร้านออกจากระบบ', mod: 'MOD_COM' },

    { resource: 'shipping-rule', action: 'view', desc: 'ดู/ใช้งานข้อมูลกฎการจัดส่ง', mod: 'MOD_COM' },
    { resource: 'shipping-rule', action: 'create', desc: 'สร้างกฎการจัดส่งใหม่', mod: 'MOD_COM' },
    { resource: 'shipping-rule', action: 'update', desc: 'แก้ไขข้อมูลกฎการจัดส่ง', mod: 'MOD_COM' },
    { resource: 'shipping-rule', action: 'delete', desc: 'ลบกฎการจัดส่งออกจากระบบ', mod: 'MOD_COM' },

    { resource: 'payment', action: 'view', desc: 'ดู/ใช้งานข้อมูลรายการธุรกรรม', mod: 'MOD_COM' },
    { resource: 'payment', action: 'create', desc: 'สร้างรายการธุรกรรมใหม่', mod: 'MOD_COM' },
    { resource: 'payment', action: 'update', desc: 'แก้ไขข้อมูลรายการธุรกรรม', mod: 'MOD_COM' },
    { resource: 'payment', action: 'delete', desc: 'ลบรายการธุรกรรมออกจากระบบ', mod: 'MOD_COM' },

    { resource: 'payment-method', action: 'view', desc: 'ดู/ใช้งานข้อมูลวิธีการชำระเงิน', mod: 'MOD_COM' },
    { resource: 'payment-method', action: 'create', desc: 'สร้างวิธีการชำระเงินใหม่', mod: 'MOD_COM' },
    { resource: 'payment-method', action: 'update', desc: 'แก้ไขข้อมูลวิธีการชำระเงิน', mod: 'MOD_COM' },
    { resource: 'payment-method', action: 'delete', desc: 'ลบวิธีการชำระเงินออกจากระบบ', mod: 'MOD_COM' },

    { resource: 'shipping-method', action: 'view', desc: 'ดู/ใช้งานข้อมูลกฎการจัดส่ง', mod: 'MOD_COM' },
    { resource: 'shipping-method', action: 'create', desc: 'สร้างกฎการจัดส่งใหม่', mod: 'MOD_COM' },
    { resource: 'shipping-method', action: 'update', desc: 'แก้ไขข้อมูลกฎการจัดส่ง', mod: 'MOD_COM' },
    { resource: 'shipping-method', action: 'delete', desc: 'ลบกฎการจัดส่งออกจากระบบ', mod: 'MOD_COM' },

    { resource: 'address', action: 'view', desc: 'ดู/ใช้งานข้อมูลที่อยู่', mod: 'MOD_CRM' },
    { resource: 'address', action: 'create', desc: 'สร้างที่อยู่ใหม่', mod: 'MOD_CRM' },
    { resource: 'address', action: 'update', desc: 'แก้ไขข้อมูลที่อยู่', mod: 'MOD_CRM' },
    { resource: 'address', action: 'delete', desc: 'ลบที่อยู่ออกจากระบบ', mod: 'MOD_CRM' },

    { resource: 'crm_member', action: 'view', desc: 'ดู/ใช้งานข้อมูลสมาชิก', mod: 'MOD_CRM' },
    { resource: 'crm_member', action: 'create', desc: 'สร้างสมาชิกใหม่', mod: 'MOD_CRM' },
    { resource: 'crm_member', action: 'update', desc: 'แก้ไขข้อมูลสมาชิก', mod: 'MOD_CRM' },
    { resource: 'crm_member', action: 'delete', desc: 'ลบสมาชิกออกจากระบบ', mod: 'MOD_CRM' },

    { resource: 'redemption', action: 'view', desc: 'ดู/ใช้งานข้อมูลการแลกคะแนน', mod: 'MOD_CRM' },
    { resource: 'redemption', action: 'update', desc: 'สร้างรายการแลกคะแนนใหม่', mod: 'MOD_CRM' },
    { resource: 'redemption', action: 'delete', desc: 'ลบรายการแลกคะแนนออกจากระบบ', mod: 'MOD_CRM' },

    { resource: 'reward', action: 'view', desc: 'ดู/ใช้งานข้อมูลรางวัล', mod: 'MOD_CRM' },
    { resource: 'reward', action: 'create', desc: 'สร้างรางวัลใหม่', mod: 'MOD_CRM' },
    { resource: 'reward', action: 'update', desc: 'แก้ไขข้อมูลรางวัล', mod: 'MOD_CRM' },
    { resource: 'reward', action: 'delete', desc: 'ลบรางวัลออกจากระบบ', mod: 'MOD_CRM' },

    { resource: 'wishlist', action: 'view', desc: 'ดู/ใช้งานข้อมูลรายการที่ต้องการ', mod: 'MOD_CRM' },
    { resource: 'wishlist', action: 'create', desc: 'สร้างรายการที่ต้องการใหม่', mod: 'MOD_CRM' },

    { resource: 'purchase-orders', action: 'view', desc: 'ดู/ใช้งานข้อมูลรายการสั่งซื้อ', mod: 'MOD_COM' },
    { resource: 'purchase-orders', action: 'create', desc: 'สร้างรายการสั่งซื้อใหม่', mod: 'MOD_COM' },
    { resource: 'purchase-orders', action: 'update', desc: 'แก้ไขข้อมูลรายการสั่งซื้อ', mod: 'MOD_COM' },

    { resource: 'purchase-items', action: 'update', desc: 'แก้ไขข้อมูลรายการสั่งซื้อ', mod: 'MOD_COM' },
    { resource: 'purchase-items', action: 'delete', desc: 'ลบรายการสั่งซื้อออกจากระบบ', mod: 'MOD_COM' },

    { resource: 'supplier', action: 'view', desc: 'ดู/ใช้งานข้อมูลซัพพลายเออร์', mod: 'MOD_COM' },
    { resource: 'supplier', action: 'create', desc: 'สร้างซัพพลายเออร์ใหม่', mod: 'MOD_COM' },
    { resource: 'supplier', action: 'update', desc: 'แก้ไขข้อมูลซัพพลายเออร์', mod: 'MOD_COM' },
    { resource: 'supplier', action: 'delete', desc: 'ลบซัพพลายเออร์ออกจากระบบ', mod: 'MOD_COM' },

 
    { resource: 'member', action: 'view', desc: 'ดู/ใช้งานข้อมูลสมาชิก', mod: 'MOD_CRM' },
    { resource: 'member', action: 'create', desc: 'สร้างสมาชิกใหม่', mod: 'MOD_CRM' },
    { resource: 'member', action: 'update', desc: 'แก้ไขข้อมูลสมาชิก', mod: 'MOD_CRM' },
    { resource: 'member', action: 'delete', desc: 'ลบสมาชิกออกจากระบบ', mod: 'MOD_CRM' },

    { resource: 'company-configs', action: 'view', desc: 'ดู/ใช้งานข้อมูลการตั้งค่าบริษัท', mod: 'MOD_CRM' },
    { resource: 'company-configs', action: 'update', desc: 'แก้ไขข้อมูลการตั้งค่าบริษัท', mod: 'MOD_CRM' },
    { resource: 'company-configs', action: 'delete', desc: 'ลบข้อมูลการตั้งค่าบริษัทออกจากระบบ', mod: 'MOD_CRM' },
    { resource: 'company-configs', action: 'create', desc: 'สร้างข้อมูลการตั้งค่าบริษัทใหม่', mod: 'MOD_CRM' },

    { resource: 'product', action: 'view', desc: 'ดู/ใช้งานข้อมูลสินค้า', mod: 'MOD_COM' },
    { resource: 'product', action: 'create', desc: 'สร้างสินค้าใหม่', mod: 'MOD_COM' },
    { resource: 'product', action: 'update', desc: 'แก้ไขข้อมูลสินค้า', mod: 'MOD_COM' },
    { resource: 'product', action: 'delete', desc: 'ลบสินค้าออกจากระบบ', mod: 'MOD_COM' },

    { resource: 'stock', action: 'view', desc: 'ดู/ใช้งานข้อมูลสต๊อกสินค้า', mod: 'MOD_COM' },
    { resource: 'stock', action: 'update', desc: 'แก้ไขข้อมูลสินค้า', mod: 'MOD_COM' },
    

    { resource: 'tag', action: 'view', desc: 'ดู/ใช้งานข้อมูลแท็ก', mod: 'MOD_COM' },
    { resource: 'tag', action: 'create', desc: 'สร้างแท็กใหม่', mod: 'MOD_COM' },
    { resource: 'tag', action: 'update', desc: 'แก้ไขข้อมูลแท็ก', mod: 'MOD_COM' },
    { resource: 'tag', action: 'delete', desc: 'ลบแท็กออกจากระบบ', mod: 'MOD_COM' },

    { resource: 'discount', action: 'view', desc: 'ดู/ใช้งานข้อมูลคูปอง', mod: 'MOD_COM' },
    { resource: 'discount', action: 'create', desc: 'สร้างคูปองใหม่', mod: 'MOD_COM' },
    { resource: 'discount', action: 'update', desc: 'แก้ไขข้อมูลคูปอง', mod: 'MOD_COM' },
    { resource: 'discount', action: 'delete', desc: 'ลบคูปองออกจากระบบ', mod: 'MOD_COM' },


    { resource: 'order', action: 'update', desc: 'แก้ไขข้อมูลรายการสั่งซื้อ', mod: 'MOD_COM' },
    { resource: 'order', action: 'view', desc: 'ดูรายการสั่งซื้อ', mod: 'MOD_COM' },
    { resource: 'order', action: 'create', desc: 'สร้างรายการสั่งซื้อใหม่', mod: 'MOD_COM' },
    

    { resource: 'return-requests', action: 'update', desc: 'แก้ไขข้อมูลรายการคืนสินค้า', mod: 'MOD_COM' },
    { resource: 'return-requests', action: 'view', desc: 'ดูรายการคืนสินค้า', mod: 'MOD_COM' },
    { resource: 'return-requests', action: 'create', desc: 'สร้างรายการคืนสินค้าใหม่', mod: 'MOD_COM' },
    { resource: 'return-items', action: 'update', desc: 'แก้ไขข้อมูลรายการคืนสินค้า', mod: 'MOD_COM' },
    { resource: 'return-items', action: 'delete', desc: 'ลบรายการคืนสินค้าออกจากระบบ', mod: 'MOD_COM' },


    { resource: 'reviews', action: 'view', desc: 'ดู/ใช้งานข้อมูลรีวิวสินค้า', mod: 'MOD_COM' },
    { resource: 'reviews', action: 'create', desc: 'สร้างรีวิวสินค้าใหม่', mod: 'MOD_COM' },
    { resource: 'reviews', action: 'update', desc: 'แก้ไขข้อมูลรีวิวสินค้า', mod: 'MOD_COM' },
    { resource: 'reviews', action: 'delete', desc: 'ลบรีวิวสินค้าออกจากระบบ', mod: 'MOD_COM' },




    // --- 🤖 AI & Integration ---
    { resource: 'ai_config', action: 'view', desc: 'ดู/ใช้งาน ข้อมูลคิด Token กลาง', mod: 'MOD_INT' },
    { resource: 'ai_config', action: 'create', desc: 'สร้าง ข้อมูลคิด Token กลางใหม่', mod: 'MOD_INT' },
    { resource: 'ai_config', action: 'update', desc: 'แก้ไขข้อมูลคิด Token กลาง', mod: 'MOD_INT' },
    { resource: 'ai_config', action: 'delete', desc: 'ลบ ข้อมูลคิด Token กลาง ออกจากระบบ', mod: 'MOD_INT' },

    { resource: 'smtp_config', action: 'view', desc: 'ดูข้อมูล ตั้งค่า smtp mail', mod: 'MOD_INT' },
    { resource: 'smtp_config', action: 'update', desc: 'แก้ไขข้อมูล smtp mail', mod: 'MOD_INT' },

    { resource: 'chat', action: 'view', desc: 'ดูข้อมูล ตั้งค่า smtp mail', mod: 'MOD_INT' },
    { resource: 'chat', action: 'create', desc: 'แก้ไขข้อมูล smtp mail', mod: 'MOD_INT' },
    { resource: 'chat', action: 'update', desc: 'แก้ไขข้อมูล smtp mail', mod: 'MOD_INT' },



    { resource: 'int:ai', action: 'view', desc: 'ดู/ใช้งาน AI Bot', mod: 'MOD_INT' },
    { resource: 'int:ai', action: 'create', desc: 'สร้าง AI Bot ใหม่', mod: 'MOD_INT' },
    { resource: 'int:ai', action: 'update', desc: 'แก้ไขข้อมูล AI Bot', mod: 'MOD_INT' },
    { resource: 'int:ai', action: 'delete', desc: 'ลบ AI Bot ออกจากระบบ', mod: 'MOD_INT' },

    { resource: 'int:knowledge-base', action: 'view', desc: 'ดูรายการ Knowledge Base', mod: 'MOD_INT' },
    { resource: 'int:knowledge-base', action: 'create', desc: 'สร้าง Knowledge Base ใหม่', mod: 'MOD_INT' },
    { resource: 'int:knowledge-base', action: 'update', desc: 'แก้ไขข้อมูล Knowledge Base', mod: 'MOD_INT' },
    { resource: 'int:knowledge-base', action: 'delete', desc: 'ลบ Knowledge Base ออกจากระบบ', mod: 'MOD_INT' },

    { resource: 'int:drive:view', action: 'view', desc: 'ดูรายการ Google Drive', mod: 'MOD_INT' },

    { resource: 'int:cloud', action: 'view', desc: 'ดูรายการ Cloud Storage', mod: 'MOD_INT' },
    { resource: 'int:cloud', action: 'create', desc: 'สร้าง Cloud Storage ใหม่', mod: 'MOD_INT' },
    { resource: 'int:cloud', action: 'update', desc: 'แก้ไขข้อมูล Cloud Storage', mod: 'MOD_INT' },
    { resource: 'int:cloud', action: 'delete', desc: 'ลบ Cloud Storage ออกจากระบบ', mod: 'MOD_INT' },

    { resource: 'int:facebook', action: 'view', desc: 'ดูรายการ Facebook Integration', mod: 'MOD_INT' },
    { resource: 'int:facebook', action: 'create', desc: 'สร้าง Facebook Integration ใหม่', mod: 'MOD_INT' },
    { resource: 'int:facebook', action: 'update', desc: 'แก้ไขข้อมูล Facebook Integration', mod: 'MOD_INT' },
    { resource: 'int:facebook', action: 'delete', desc: 'ลบ Facebook Integration ออกจากระบบ', mod: 'MOD_INT' },

    { resource: 'int:line', action: 'view', desc: 'ดูรายการ Line Integration', mod: 'MOD_INT' },
    { resource: 'int:line', action: 'create', desc: 'สร้าง Line Integration ใหม่', mod: 'MOD_INT' },
    { resource: 'int:line', action: 'update', desc: 'แก้ไขข้อมูล Line Integration', mod: 'MOD_INT' },
    { resource: 'int:line', action: 'delete', desc: 'ลบ Line Integration ออกจากระบบ', mod: 'MOD_INT' },

    { resource: 'cms:page', action: 'view', desc: 'ดูรายการ CMS Page', mod: 'MOD_INT' },
    { resource: 'cms:page', action: 'create', desc: 'สร้าง CMS Page ใหม่', mod: 'MOD_INT' },
    { resource: 'cms:page', action: 'update', desc: 'แก้ไขข้อมูล CMS Page', mod: 'MOD_INT' },
    { resource: 'cms:page', action: 'delete', desc: 'ลบ CMS Page ออกจากระบบ', mod: 'MOD_INT' },

    { resource: 'media', action: 'create', desc: 'สร้าง Media ใหม่', mod: 'MOD_INT' },

    { resource: 'announcement', action: 'view', desc: 'ดูรายการ Announcement', mod: 'MOD_COM' },
    { resource: 'announcement', action: 'create', desc: 'สร้าง Announcement ใหม่', mod: 'MOD_COM' },
    { resource: 'announcement', action: 'update', desc: 'แก้ไขข้อมูล Announcement', mod: 'MOD_COM' },
    { resource: 'announcement', action: 'delete', desc: 'ลบ Announcement ออกจากระบบ', mod: 'MOD_COM' },

    
    { resource: 'department', action: 'view', desc: 'ดู/ใช้งานแผนก', mod: 'MOD_HR' },
    { resource: 'department', action: 'create', desc: 'สร้างแผนกใหม่', mod: 'MOD_HR' },
    { resource: 'department', action: 'update', desc: 'แก้ไขข้อมูลแผนก', mod: 'MOD_HR' },
    { resource: 'department', action: 'delete', desc: 'ลบแผนกออกจากระบบ', mod: 'MOD_HR' },

    { resource: 'position', action: 'view', desc: 'ดู/ใช้งานตำแหน่งงาน', mod: 'MOD_HR' },
    { resource: 'position', action: 'create', desc: 'สร้างตำแหน่งงานใหม่', mod: 'MOD_HR' },
    { resource: 'position', action: 'update', desc: 'แก้ไขข้อมูลตำแหน่งงาน', mod: 'MOD_HR' },
    { resource: 'position', action: 'delete', desc: 'ลบตำแหน่งงานออกจากระบบ', mod: 'MOD_HR' },


    { resource: 'employee', action: 'view', desc: 'ดู/ใช้งานพนักงาน', mod: 'MOD_HR' },
    { resource: 'employee', action: 'create', desc: 'สร้างพนักงานใหม่', mod: 'MOD_HR' },
    { resource: 'employee', action: 'update', desc: 'แก้ไขข้อมูลพนักงาน', mod: 'MOD_HR' },



  ];

  const createdPermissions: any[] = [];
  for (const p of permissionsList) {
    const targetModule = moduleMap[p.mod];
    const perm = await prisma.secPermission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: { description: p.desc, moduleId: targetModule?.id },
      create: {
        resource: p.resource,
        action: p.action,
        description: p.desc,
        moduleId: targetModule?.id
      }
    });
    createdPermissions.push(perm);
  }

  // =========================================================
  // 6. สร้าง MENUS (รายการเมนูแบบ Flat - ระบบจัดกลุ่มตาม Module อัตโนมัติ)
  // =========================================================
  console.log('📋 Creating Flat System Menus...');
  
  const menusData = [
    // --- MOD_CORE ---
    { name: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', sortOrder: 1, mod: 'MOD_CORE' },
    { name: 'จัดการบทบาท(Role)', path: '/dashboard/admin/roles', icon: 'UserCheck', sortOrder: 2, mod: 'MOD_CORE' },
    { name: 'Monitor', path: '/dashboard/admin/monitor', icon: 'Monitor', sortOrder: 3, mod: 'MOD_CORE' },
    { name: 'สิทธิ์ระบบ (Permission)', path: '/dashboard/admin/permissions', icon: 'ShieldCheck', sortOrder: 4, mod: 'MOD_CORE' },
    { name: 'ตั้งค่าความปลอดภัย', path: '/dashboard/settings/security', icon: 'ShieldCheck', sortOrder: 5, mod: 'MOD_CORE' },
    { name: 'จัดการผู้ใช้งาน(User)', path: '/dashboard/admin/users', icon: 'User', sortOrder: 6, mod: 'MOD_CORE' },
    { name: 'ตั้งค่าระบบ', path: '/dashboard/settings/system', icon: 'ShieldCheck', sortOrder: 7, mod: 'MOD_CORE' },
    { name: 'จัดการเนื้อหา', path: '/dashboard/cms', icon: 'BookOpen', sortOrder: 8, mod: 'MOD_CORE' },
    { name: 'จัดการเมนู(Menu)', path: '/dashboard/admin/menus', icon: 'ShieldCheck', sortOrder: 9, mod: 'MOD_CORE' },
    { name: 'จัดการ workflow', path: '/dashboard/settings/workflow', icon: 'ShieldCheck', sortOrder: 10, mod: 'MOD_CORE' },
    { name: 'ตั้งค่ากฎการปัดเศษ', path: '/dashboard/settings/rounding-rules', icon: 'ShieldCheck', sortOrder: 11, mod: 'MOD_CORE' },

    // --- MOD_ORG ---
    { name: 'การตั้งค่า Subscription', path: '/dashboard/admin/subscriptions', icon: 'CreditCard', sortOrder: 1, mod: 'MOD_ORG' },
    { name: 'ตั้งค่าสิทธิ์ (RoleMene)', path: '/dashboard/admin/security', icon: 'ShieldCheck', sortOrder: 2, mod: 'MOD_ORG' },
    { name: 'ศูนย์สื่อสาร', path: '/dashboard/admin/communication', icon: 'MessageSquare', sortOrder: 3, mod: 'MOD_ORG' },
    { name: 'จัดการการเชื่อมต่อ Cloud Storage', path: '/dashboard/settings/cloud', icon: 'Server', sortOrder: 4, mod: 'MOD_ORG' },
    { name: 'จัดการโครงสร้างองค์กร', path: '/dashboard/admin/companies', icon: 'Building', sortOrder: 5, mod: 'MOD_ORG' }, 
    { name: 'จัดการบริษัท', path: '/dashboard/settings/business', icon: 'Building2', sortOrder: 6, mod: 'MOD_ORG' }, 
    { name: 'ลงทะเบียนบริษัทใหม่', path: '/dashboard/admin/onboarding', icon: 'Briefcase', sortOrder: 7, mod: 'MOD_ORG' }, 

    // --- MOD_COM ---
    { name: 'จัดการสินค้า', path: '/dashboard/products', icon: 'Package', sortOrder: 2, mod: 'MOD_COM' },
    { name: 'จัดการแท็กภาพ', path: '/dashboard/products/image-tags', icon: 'Image', sortOrder: 2, mod: 'MOD_COM' },
    { name: 'จัดการสนทนา', path: '/dashboard/chat', icon: 'chat', sortOrder: 3, mod: 'MOD_COM' },

    // ---- MOD_HR
    { name: 'แผนก (Depaartment)', path: '/dashboard/admin/departments', icon: 'User', sortOrder: 0, mod: 'MOD_HR' },
    { name: 'ตำแหน่ง (Position)', path: '/dashboard/admin/positions', icon: 'User', sortOrder: 1, mod: 'MOD_HR' },
    { name: 'บริหารงานบุคคล', path: '/dashboard/admin/hr', icon: 'User', sortOrder: 2, mod: 'MOD_HR' },
    

    // --- MOD_CRM --- 
    { name: 'สมาชิก', path: '/dashboard/admin/crm/members', icon: 'User', sortOrder: 1, mod: 'MOD_CRM' },
    { name: 'ระบบของรางวัล', path: '/dashboard/crm/rewards', icon: 'Trophy', sortOrder: 2, mod: 'MOD_CRM' },
    { name: 'ระบบแลกเปลี่ยนของรางวัล', path: '/dashboard/crm/redemptions', icon: 'Gift', sortOrder: 3, mod: 'MOD_CRM' },


    // --- MOD_INT ---
    { name: 'ตั้งค่าโมเดล AI', path: '/dashboard/admin/ai-model-configs', icon: 'Settings', sortOrder: 1, mod: 'MOD_INT' },
    { name: 'จัดการ AI Bots', path: '/dashboard/admin/ai-bots', icon: 'BrainCircuit', sortOrder: 2, mod: 'MOD_INT' },  
    { name: 'คลังความรู้', path: '/dashboard/knowledge', icon: 'Book', sortOrder: 3, mod: 'MOD_INT' },
    { name: 'การเชื่อมต่อกับ Social Channels', path: '/dashboard/admin/social-integrations', icon: 'MessageCircle', sortOrder: 4, mod: 'MOD_INT' },
  ];

  const createdMenus: any[] = [];

  for (const m of menusData) {
    const modId = moduleMap[m.mod]?.id;
    
    // สร้างเมนูเป็นระดับเดียวกันทั้งหมด (ไม่มี parentId)
    const menu = await prisma.secMenu.create({
      data: {
        name: m.name,
        path: m.path,
        icon: m.icon,
        sortOrder: m.sortOrder,
        moduleId: modId,
        isVisible: true,
        isSystem: true
      }
    });
    createdMenus.push(menu);
  }
  console.log(`✅ Created ${createdMenus.length} flat menus.`);

  // =========================================================
  // 7. สร้าง ROLE & USER (SUPER_ADMIN)
  // =========================================================
  const roleAdmin = await prisma.secRole.upsert({
    where: { companyId_name: { companyId: compHQ.id, name: 'SUPER_ADMIN' } },
    update: {},
    create: {
      companyId: compHQ.id,
      name: 'SUPER_ADMIN',
      displayName: 'ผู้ดูแลระบบสูงสุด (HQ)',
      isSystem: true,
    }
  });

  // 7.1 ผูก Permissions กับ Role
  await prisma.secRolePermission.deleteMany({ where: { roleId: roleAdmin.id } });
  await prisma.secRolePermission.createMany({
    data: createdPermissions.map(p => ({
      roleId: roleAdmin.id,
      permissionId: p.id
    }))
  });

  // 7.2 ผูก Menus กับ Role
  console.log('🔗 Assigning Menus to SUPER_ADMIN...');
  await prisma.secRoleMenu.deleteMany({ where: { roleId: roleAdmin.id } });
  await prisma.secRoleMenu.createMany({
    data: createdMenus.map(m => ({
      roleId: roleAdmin.id,
      menuId: m.id,
      sortOrder: m.sortOrder
    }))
  });


 // =========================================================
  // 10. สร้าง AI MODEL CONFIGS (Master Data เรทราคากลาง)
  // =========================================================
  console.log('🤖 Seeding AI Model Configs...');
  
  const aiModels = [
    // ------------------------------------
    // 🟢 GOOGLE GEMINI 3.x & LATEST (รุ่นใหม่ล่าสุด)
    // ------------------------------------
    {
      provider: 'GOOGLE',
      modelCode: 'models/gemini-3.1-pro-preview',
      modelName: 'Gemini 3.1 Pro Preview (ฉลาดที่สุด รองรับการคิดวิเคราะห์)',
      creditPer1kTokens: 2.5, 
      isVisionSupported: true,
      maxContextTokens: 1048576 
    },
    {
      provider: 'GOOGLE',
      modelCode: 'models/gemini-3-flash-preview',
      modelName: 'Gemini 3 Flash Preview (สมดุลความเร็วและความฉลาด)',
      creditPer1kTokens: 1.5, 
      isVisionSupported: true,
      maxContextTokens: 1048576 
    },
    {
      provider: 'GOOGLE',
      modelCode: 'models/gemini-flash-latest',
      modelName: 'Gemini Flash Latest (อัปเดตอัตโนมัติเป็นรุ่นล่าสุด ทำงานไว)',
      creditPer1kTokens: 1.0, 
      isVisionSupported: true,
      maxContextTokens: 1048576 
    },
    {
      provider: 'GOOGLE',
      modelCode: 'models/deep-research-pro-preview-12-2025',
      modelName: 'Deep Research Pro (สำหรับการค้นคว้าเชิงลึก)',
      creditPer1kTokens: 5.0, 
      isVisionSupported: true,
      maxContextTokens: 131072 
    },

    // ------------------------------------
    // 🟢 GOOGLE GEMINI 2.x (รุ่นเสถียรปัจจุบัน)
    // ------------------------------------
    {
      provider: 'GOOGLE',
      modelCode: 'models/gemini-2.5-pro',
      modelName: 'Gemini 2.5 Pro (รุ่นโปร เสถียรและแม่นยำสูง)',
      creditPer1kTokens: 2.0, 
      isVisionSupported: true,
      maxContextTokens: 1048576 
    },
    {
      provider: 'GOOGLE',
      modelCode: 'models/gemini-2.5-flash',
      modelName: 'Gemini 2.5 Flash (รุ่นแฟลช ทำงานไว ราคาประหยัด)',
      creditPer1kTokens: 1.0, 
      isVisionSupported: true,
      maxContextTokens: 1048576 
    },
    {
      provider: 'GOOGLE',
      modelCode: 'models/gemini-2.0-flash',
      modelName: 'Gemini 2.0 Flash (รุ่นยอดนิยม)',
      creditPer1kTokens: 1.0, 
      isVisionSupported: true,
      maxContextTokens: 1048576 
    },
    {
      provider: 'GOOGLE',
      modelCode: 'models/gemini-flash-lite-latest',
      modelName: 'Gemini Flash-Lite Latest (รุ่นประหยัดทรัพยากรที่สุด)',
      creditPer1kTokens: 0.5, 
      isVisionSupported: true,
      maxContextTokens: 1048576 
    },

    // ------------------------------------
    // 🟢 GOOGLE MULTIMEDIA (สร้างภาพ/วิดีโอ/เสียง)
    // ------------------------------------
    {
      provider: 'GOOGLE',
      modelCode: 'models/imagen-4.0-generate-001',
      modelName: 'Imagen 4 (สร้างและตัดต่อรูปภาพคุณภาพสูง)',
      creditPer1kTokens: 5.0, 
      isVisionSupported: true,
      maxContextTokens: 480 
    },
    {
      provider: 'GOOGLE',
      modelCode: 'models/veo-3.0-generate-001',
      modelName: 'Veo 3 (สร้างวิดีโอคุณภาพสูง)',
      creditPer1kTokens: 10.0, 
      isVisionSupported: true,
      maxContextTokens: 480 
    },
    {
      provider: 'GOOGLE',
      modelCode: 'models/gemini-2.5-flash-native-audio-latest',
      modelName: 'Gemini Native Audio (ฟังและพูดเสียงแบบเรียลไทม์)',
      creditPer1kTokens: 2.0, 
      isVisionSupported: false,
      maxContextTokens: 131072 
    },

    // ------------------------------------
    // 🟢 GOOGLE GEMMA (Open Weights)
    // ------------------------------------
    {
      provider: 'GOOGLE',
      modelCode: 'models/gemma-3-27b-it',
      modelName: 'Gemma 3 27B (โมเดล Open Weights ตัวท็อป)',
      creditPer1kTokens: 1.0, 
      isVisionSupported: false,
      maxContextTokens: 131072 
    },

    // ------------------------------------
    // 🔵 OPENAI MODELS (สำรองไว้ใช้ในอนาคต)
    // ------------------------------------
    {
      provider: 'OPENAI',
      modelCode: 'gpt-4o',
      modelName: 'GPT-4o (โมเดลตัวท็อป ฉลาดที่สุด รองรับรูปภาพ)',
      creditPer1kTokens: 5.0, 
      isVisionSupported: true,
      maxContextTokens: 128000
    },
    {
      provider: 'OPENAI',
      modelCode: 'gpt-4o-mini',
      modelName: 'GPT-4o Mini (ทำงานไว ราคาประหยัด)',
      creditPer1kTokens: 1.0, 
      isVisionSupported: true,
      maxContextTokens: 128000
    },
    // --- 🖼️ กลุ่มโมเดลจัดการรูปภาพ (Image / Background Removal) ---
    {
      provider: 'SELF_HOSTED', 
      modelCode: 'isnet-general', // 📍 เปลี่ยนให้ตรงกับชื่อ AI ที่เรารันใน Python
      modelName: 'KKV AI Bg-Removal (ลบพื้นหลังฟรี ไม่จำกัด)', // 📍 เปลี่ยนชื่อให้ดูเป็นแบรนด์ของเรา
      creditPer1kTokens: 0.1,  // 📍 ปรับให้ถูกลงได้อีกเพราะเราไม่ต้องเสียค่า License (เช่น หักแค่ 0.1 เครดิต)
      isVisionSupported: true,
      maxContextTokens: 0      
    },
    {
      provider: 'PHOTOROOM',   // ระบุว่าเป็น API ภายนอกที่จ่ายเงิน
      modelCode: 'photoroom-bg-removal',
      modelName: 'Photoroom API (ลบพื้นหลังระดับโปร เนียนกริ๊บ พร้อมเงา)',
      creditPer1kTokens: 10.0, // ต้องตั้งราคาแพงขึ้นมาหน่อยเพราะมีต้นทุน API ต่อรูป
      isVisionSupported: true,
      maxContextTokens: 0      // ไม่ได้ใช้ Token แบบข้อความ
    }
  ];

  for (const model of aiModels) {
    // ใช้ findFirst คู่กับ update/create เพราะค่า companyId เป็น Null (Global Rate)
    const existing = await prisma.sysAiModelConfig.findFirst({
      where: { companyId: null, modelCode: model.modelCode }
    });

    if (existing) {
      await prisma.sysAiModelConfig.update({
        where: { id: existing.id },
        data: model
      });
    } else {
      await prisma.sysAiModelConfig.create({
        data: {
          ...model,
          companyId: null // สำคัญมาก! บ่งบอกว่านี่คือ "ราคากลาง" ของระบบ KKV
        }
      });
    }
  }
  console.log(`✅ AI Model Configs seeded! (${aiModels.length} models)`);


  // =========================================================
  // 👑 สร้าง MASTER DATA: ระดับของสมาชิก (MEMBER_LEVEL)
  // =========================================================
  console.log('👑 Seeding Member Levels...');

  const memberLevelGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'MEMBER_LEVEL' },
    update: {},
    create: {
      groupCode: 'MEMBER_LEVEL',
      groupName: 'ระดับของสมาชิก (Member Tier)',
      description: 'กำหนดระดับของลูกค้าเพื่อสิทธิประโยชน์และการมองเห็นสินค้า',
      isSystem: true,
      isActive: true,
    },
  });

  const memberLevelData = [
    { code: 'NORMAL', name: 'สมาชิกทั่วไป (Normal)', sortOrder: 1 },
    { code: 'VIP', name: 'สมาชิกวีไอพี (VIP)', sortOrder: 2 },
    { code: 'VVIP', name: 'สมาชิกซูเปอร์วีไอพี (VVIP)', sortOrder: 3 },
  ];

  for (const v of memberLevelData) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { masterGroupId: memberLevelGroup.id, code: v.code, companyId: null },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { name: v.name, sortOrder: v.sortOrder },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: memberLevelGroup.id,
          code: v.code,
          name: v.name,
          sortOrder: v.sortOrder,
          companyId: null,
          isActive: true,
          labels: {}
        },
      });
    }
  }

  // =========================================================
  // 9. สร้าง SOCIAL LOGIN PROVIDERS (sysAuthProvider)
  // =========================================================
  console.log('🌐 Seeding Social Login Providers...');

  const providers = [
    {
      id: 'LINE',
      name: 'LINE Messenger',
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3991/3991987.png', // ตัวอย่าง Icon
      isEnabled: true,
      isMaintenance: false,
      sortOrder: 1,
    },
    {
      id: 'GOOGLE',
      name: 'Google Account',
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png',
      isEnabled: true,
      isMaintenance: false,
      sortOrder: 2,
    },
    {
      id: 'FACEBOOK',
      name: 'Facebook',
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/733/733547.png',
      isEnabled: true,
      isMaintenance: false,
      sortOrder: 3,
    },
  ];

  for (const provider of providers) {
    await prisma.sysAuthProvider.upsert({
      where: { id: provider.id },
      update: {
        name: provider.name,
        iconUrl: provider.iconUrl,
        isEnabled: provider.isEnabled,
        isMaintenance: provider.isMaintenance,
        sortOrder: provider.sortOrder,
      },
      create: provider,
    });
  }
  console.log('✅ Social Login Providers seeded!');

  // =========================================================
  // 👁️ 16. สร้าง MASTER DATA: การมองเห็นสินค้า (PRODUCT_VISIBILITY)
  // =========================================================
  console.log('👁️ Seeding Product Visibility...');

  const visibilityGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'PRODUCT_VISIBILITY' },
    update: {},
    create: {
      groupCode: 'PRODUCT_VISIBILITY',
      groupName: 'ระดับการมองเห็นสินค้า',
      description: 'กำหนดสิทธิ์ว่าใครสามารถมองเห็นและสั่งซื้อสินค้านี้ได้บ้าง',
      isSystem: true,
      isActive: true,
    },
  });

  const visibilityData = [
    { code: 'PUBLIC', name: 'ลูกค้าทั่วไป (Public)', sortOrder: 1 },
    { code: 'MEMBER_ONLY', name: 'เฉพาะสมาชิก (Member Only)', sortOrder: 2 },
    { code: 'VIP', name: 'เฉพาะสมาชิก VIP', sortOrder: 3 },
  ];

  for (const v of visibilityData) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: {
        masterGroupId: visibilityGroup.id,
        code: v.code,
        companyId: null, // ข้อมูลกลาง
      },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { name: v.name, sortOrder: v.sortOrder },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: visibilityGroup.id,
          code: v.code,
          name: v.name,
          sortOrder: v.sortOrder,
          companyId: null,
          isActive: true,
          labels: {}
        },
      });
    }
  }
  console.log('✅ Product Visibility Seeded!');

  // =========================================================
  // ⚙️ 16. สร้าง SYSTEM CONFIGS (ค่าระบบทั่วไปส่วนกลาง)
  // =========================================================
  console.log('⚙️ Seeding System Configs...');

  const systemConfigs = [
    { key: 'APP_NAME', value: 'KKV BusinessOS', description: 'ชื่อแอปพลิเคชัน' },
    { key: 'TAX_RATE', value: '7', description: 'อัตราภาษีมูลค่าเพิ่ม (%)' },
    { key: 'DEFAULT_CURRENCY', value: 'THB', description: 'สกุลเงินเริ่มต้น' },
    { key: 'MAX_CART_ITEMS', value: '50', description: 'จำนวนสินค้าสูงสุดในตะกร้า' },
    { key: 'ENABLE_GUEST_CHECKOUT', value: 'true', description: 'อนุญาตสั่งซื้อแบบไม่ต้องล็อกอิน' },
    { key: 'LOW_STOCK_THRESHOLD', value: '10', description: 'จำนวนคงเหลือที่ถือว่าสินค้าใกล้หมด' },
    { key: 'ORDER_EXPIRY_HOURS', value: '24', description: 'ชั่วโมงที่คำสั่งซื้อจะหมดอายุถ้าไม่ชำระเงิน' },
    { key: 'MAINTENANCE_MODE', value: 'false', description: 'โหมดปิดปรับปรุงระบบ' },
    { key: 'CONTACT_EMAIL', value: 'contact@kkvservice.com', description: 'อีเมลติดต่อร้าน' },
    { key: 'POINTS_PER_BAHT', value: '1', description: 'คะแนนที่ได้รับต่อการซื้อ 1 บาท' },
  ];

  for (const config of systemConfigs) {
    // ใช้ตาราง cfgSystem ตามที่ผูกไว้ใน system-configs.service.ts
    await prisma.cfgSystem.upsert({
      where: { key: config.key },
      update: {
        value: config.value,
        description: config.description
      },
      create: {
        key: config.key,
        value: config.value,
        description: config.description
      }
    });
  }
  
  console.log(`✅ Seeded ${systemConfigs.length} System Configs!`);

// =========================================================
  // 📄 15. สร้าง FORMAT สำหรับ RUNNING NUMBER (รูปแบบเลขเอกสารส่วนกลาง)
  // =========================================================
  console.log('📄 Seeding Running Number Formats...');

  const runningFormats = [
    { docCode: 'PO', docName: 'ใบสั่งซื้อ', formatPattern: 'PO-{yyyy}{mm}-', digitLength: 4, resetCriteria: ResetCriteria.MONTHLY },
    { docCode: 'INV', docName: 'ใบแจ้งหนี้', formatPattern: 'INV{yyyy}-', digitLength: 5, resetCriteria: ResetCriteria.YEARLY },
    { docCode: 'REC', docName: 'ใบเสร็จรับเงิน', formatPattern: 'REC{yyyy}{mm}{dd}-', digitLength: 3, resetCriteria: ResetCriteria.DAILY },
    { docCode: 'SO', docName: 'ใบสั่งขาย', formatPattern: 'SO-{yyyy}-', digitLength: 6, resetCriteria: ResetCriteria.YEARLY },
    { docCode: 'QT', docName: 'ใบเสนอราคา', formatPattern: 'QT{yyyy}{mm}-', digitLength: 4, resetCriteria: ResetCriteria.MONTHLY },
  ];
  
  for (const format of runningFormats) {
    // 🌟 ใช้ findFirst แทน upsert เพื่อหลีกเลี่ยง Error ของ Prisma เมื่อ companyId เป็น null
    const existingFormat = await prisma.cfgRunningFormat.findFirst({
      where: { 
        docCode: format.docCode,
        companyId: null // ค้นหาเฉพาะของส่วนกลาง
      }
    });

    if (existingFormat) {
      await prisma.cfgRunningFormat.update({
        where: { id: existingFormat.id },
        data: {
          docName: format.docName,
          formatPattern: format.formatPattern,
          digitLength: format.digitLength,
          resetCriteria: format.resetCriteria,
          isActive: true
        }
      });
    } else {
      await prisma.cfgRunningFormat.create({
        data: {
          companyId: null, // 🌟 กำหนดให้เป็น null = รูปแบบส่วนกลางของระบบ
          docCode: format.docCode,
          docName: format.docName,
          formatPattern: format.formatPattern,
          digitLength: format.digitLength,
          resetCriteria: format.resetCriteria,
          isActive: true
        }
      });
    }
  }
  console.log(`✅ Seeded ${runningFormats.length} Running Number Formats!`);
  // =========================================================
  // ✉️ 14. สร้าง MESSAGE TEMPLATES (เทมเพลตข้อความเริ่มต้น)
  // =========================================================
  console.log('✉️ Seeding Message Templates...');

  const templatesData = [
    {
      code: 'WELCOME',
      channel: 'EMAIL',
      locale: 'th',
      subject: 'ยินดีต้อนรับสมาชิกใหม่ - {{shopName}}',
      content: `<p>สวัสดีคุณ <strong>{{name}}</strong>,</p>
<p>ขอบคุณที่สมัครสมาชิกกับเรา! เราดีใจมากที่คุณมาร่วมเป็นส่วนหนึ่งของครอบครัวเรา</p>
<p>คุณสามารถเริ่มช้อปปิ้งและรับสิทธิพิเศษได้ทันทีที่ <a href="{{shopUrl}}">{{shopUrl}}</a></p>
<p>หากมีข้อสงสัยเพิ่มเติม สามารถติดต่อเราได้ที่ {{supportEmail}}</p>
<p>ขอแสดงความนับถือ,<br/>ทีมงาน {{shopName}}</p>`
    },
    {
      code: 'ORDER_CONFIRM',
      channel: 'EMAIL',
      locale: 'th',
      subject: 'ยืนยันคำสั่งซื้อ #{{orderNo}}',
      content: `<p>สวัสดีคุณ <strong>{{customerName}}</strong>,</p>
<p>เราได้รับคำสั่งซื้อหมายเลข <strong>#{{orderNo}}</strong> ของคุณเรียบร้อยแล้ว และกำลังดำเนินการจัดเตรียมสินค้า</p>
<p><strong>รายการสินค้า:</strong><br/>
{{orderItems}}
</p>
<p>ยอดรวมทั้งสิ้น: <strong>{{totalAmount}} บาท</strong></p>
<p>ขอบคุณที่ไว้วางใจใช้บริการของเราครับ</p>`
    },
    {
      code: 'SHIPPED',
      channel: 'LINE',
      locale: 'th',
      subject: 'แจ้งจัดส่งสินค้า',
      content: `📦 คำสั่งซื้อ #{{orderNo}} ของคุณถูกจัดส่งแล้ว!\n\n🚚 ขนส่ง: {{carrier}}\n📍 เลขพัสดุ: {{trackingNo}}\n\nสามารถตรวจสอบสถานะการจัดส่งได้ที่เมนู "คำสั่งซื้อของฉัน" ขอบคุณที่อุดหนุนครับ! 🙏`
    },
    {
      code: 'RESET_PASSWORD',
      channel: 'EMAIL',
      locale: 'th',
      subject: 'คำขอรีเซ็ตรหัสผ่าน',
      content: `<p>สวัสดีคุณ <strong>{{name}}</strong>,</p>
<p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณแล้ว กรุณาคลิกที่ลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>
<p><a href="{{resetUrl}}" style="padding: 10px 15px; background: #0050EF; color: #fff; text-decoration: none; border-radius: 5px;">รีเซ็ตรหัสผ่าน</a></p>
<p><em>ลิงก์นี้จะหมดอายุภายใน {{expiryHours}} ชั่วโมง</em> หากคุณไม่ได้ทำรายการนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้</p>`
    },
    {
      code: 'WELCOME_EMAIL', // ชื่อนี้ต้องตรงกับที่เรียกใน onboarding.service.ts
      channel: 'EMAIL',
      locale: 'th',
      subject: '🎉 ยินดีต้อนรับสู่ KKV Platform - ข้อมูลเข้าสู่ระบบของคุณ',
      content: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2>สวัสดีคุณ {{adminFullName}},</h2>
  <p>บริษัท <strong>{{companyName}}</strong> ของคุณได้รับการเปิดระบบเรียบร้อยแล้ว!</p>
  <p>นี่คือข้อมูลสำหรับการเข้าสู่ระบบครั้งแรกของคุณ:</p>
  <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #eee;">
    <ul style="list-style-type: none; padding: 0;">
      <li style="margin-bottom: 8px;"><b>🌐 เข้าสู่ระบบได้ที่:</b> <a href="{{loginUrl}}" style="color: #0066cc;">{{loginUrl}}</a></li>
      <li style="margin-bottom: 8px;"><b>👤 ชื่อผู้ใช้งาน (Username):</b> {{adminUsername}}</li>
      <li><b>🔑 รหัสผ่าน (Password):</b> <span style="background:#e0e0e0; padding:3px 8px; border-radius: 3px; font-family: monospace; font-size: 1.1em; letter-spacing: 1px;">{{password}}</span></li>
    </ul>
  </div>
  <p style="color: #d9534f; font-weight: bold;">* เพื่อความปลอดภัย กรุณาเปลี่ยนรหัสผ่านทันทีเมื่อเข้าสู่ระบบครั้งแรก</p>
  <br/>
  <p>ขอขอบคุณที่ไว้วางใจเลือกใช้บริการของเรา<br/><strong>ทีมงาน KKV Platform</strong></p>
</div>`
    }
  ];

  for (const tpl of templatesData) {
    // 🔍 เพิ่ม companyId: compHQ.id เข้าไปในการค้นหา
    const existingTemplate = await prisma.comTemplate.findFirst({
      where: { 
        companyId: compHQ.id, // 🌟 ป้องกันการดึงเทมเพลตของบริษัทอื่นมาทับ
        code: tpl.code, 
        channel: tpl.channel, 
        locale: tpl.locale 
      }
    });

    if (existingTemplate) {
      await prisma.comTemplate.update({
        where: { id: existingTemplate.id },
        data: { 
          subject: tpl.subject, 
          content: tpl.content 
        }
      });
    } else {
      await prisma.comTemplate.create({
        data: {
          companyId: compHQ.id, // 🌟 ปลดคอมเมนต์เพื่อให้ผูกกับบริษัท HQ อย่างถูกต้อง
          code: tpl.code,
          channel: tpl.channel,
          locale: tpl.locale,
          subject: tpl.subject,
          content: tpl.content,
        }
      });
    }
  }
  console.log(`✅ Seeded ${templatesData.length} Message Templates for HQ!`);

  // =========================================================
  // 🤖 13. สร้าง AI BOT เริ่มต้นสำหรับระบบ (Global Bots)
  // =========================================================
  console.log('🤖 Seeding Default AI Bots...');

  const defaultBots = [
    {
      code: 'PRODUCT_AUTO_TAG',
      name: 'บอทวิเคราะห์รูปภาพ (Auto-Tag)',
      description: 'บอทสำหรับวิเคราะห์รูปภาพสินค้าและสร้าง Tags ให้อัตโนมัติ (ทำงานผ่านระบบ Queue)',
      provider: 'GOOGLE', 
      
      // 🌟 หมายเหตุ: ฟิลด์ใน DB ชื่อ modelName แต่เราใช้เก็บค่า "รหัส" (modelCode) เพื่อให้ส่งหา API ได้
      modelName: 'models/gemini-2.5-flash', 
      
      temperature: 0.2, // ใช้ 0.2 (ค่อนข้างต่ำ) เพื่อให้ได้ Tags ที่แม่นยำ ตรงไปตรงมา ไม่มั่ว
      systemPrompt: `คุณคือผู้เชี่ยวชาญด้าน E-commerce หน้าที่ของคุณคือวิเคราะห์รูปภาพสินค้าที่แนบมา และสร้างคำค้นหา (Tags) เพื่อเพิ่มยอดขาย\nกรุณาตอบกลับเป็นรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:\n{\n  "tags": ["ลักษณะลวดลาย", "สไตล์และอารมณ์", "สีพื้นของผ้า (Base Color)", "โทนสีของลวดลาย", "จุดเด่น"],\n  }\nห้ามพิมพ์ข้อความอื่นอธิบายเพิ่มเติม นอกเหนือจากรูปแบบ JSON เด็ดขาด`,
      greetingMessage: 'พร้อมวิเคราะห์รูปภาพสินค้าแล้วครับ',
      canUseTools: false,
      isActive: true,
    },
    // 🌟 [NEW] เพิ่มบอทสำหรับค้นหาสินค้าด้วยข้อความ (AI Text Search)
    {
      code: 'PRODUCT_SEARCH_BOT',
      name: 'วิเคราะห์ความต้องการสินค้า',
      description: 'แปลงความต้องการลูกค้าให้เป็น Tags เพื่อนำไปค้นหาสินค้า',
      provider: 'GOOGLE', 
      modelName: 'models/gemini-2.5-flash', 
      temperature: 0.7, // ใช้ 0.7 เพื่อให้ AI มีความยืดหยุ่นในการตีความหมายจากภาษาคน
      systemPrompt: `คุณคือผู้เชี่ยวชาญด้าน E-commerce หน้าที่ของคุณคือสกัด Keyword สำคัญจากความต้องการของลูกค้า เพื่อนำไปใช้ค้นหาในระบบ Tags ของรูปภาพสินค้า\nจงตอบกลับมาเป็น JSON Array ของคำสั้นๆ เท่านั้น ห้ามมีข้อความอื่น ตัวอย่าง: ["สีแดง", "ลายดอก", "ผ้าคอตตอน"]`,
      greetingMessage: 'รับทราบ พิมพ์สิ่งที่ต้องการค้นหามาได้เลยครับ',
      canUseTools: false,
      isActive: true,
    },
    {
      code: 'SOCIAL_COPYWRITER',
      name: 'นักเขียนแคปชั่นโฆษณา (Copywriter)',
      description: 'แต่งประโยคเชิญชวน โพสต์ขายของ สำหรับ Facebook และ LINE',
      provider: 'GOOGLE', 
      modelName: 'models/gemini-2.5-flash', 
      temperature: 0.8, // ใช้ 0.8 เพื่อให้มีความคิดสร้างสรรค์ ภาษาสละสลวย
      systemPrompt: `คุณคือนักการตลาดและนักเขียน Copywriter มือโปร หน้าที่ของคุณคือเขียนแคปชั่นขายสินค้าให้น่าสนใจ กระตุ้นให้อยากกดลิงก์\n\nกฎการเขียน:\n1. ใช้ภาษาเป็นกันเอง น่าตื่นเต้น มีการใช้อีโมจิ (Emoji) ให้น่าอ่าน\n2. เขียนให้เหมาะกับการโพสต์บน LINE OA หรือ Facebook\n3. จบประโยคด้วยการกระตุ้นให้คลิก (Call to Action)`,
      greetingMessage: 'ส่งรายการสินค้าหรือโปรโมชั่นมาได้เลยครับ เดี๋ยวผมแต่งแคปชั่นให้',
      canUseTools: false,
      isActive: true,
    },
    {
      code: 'PRODUCT_DESC_BOT',
      name: 'สร้างคำบรรยายสินค้าอัตโนมัติ',
      description: 'AI ช่วยเขียนคำบรรยายสินค้าจากชื่อรุ่นและสเปค ให้ดึงดูดใจและพร้อมขาย',
      provider: 'GOOGLE', 
      modelName: 'models/gemini-2.5-flash', 
      temperature: 0.7, // 0.7 เหมาะสมครับ ให้ AI มีความสละสลวยในการเลือกใช้คำโฆษณา
      systemPrompt: `คุณคือ Copywriter มืออาชีพด้าน E-commerce หน้าที่ของคุณคือเขียน "คำอธิบายสินค้า" ให้น่าสนใจ อ่านง่าย และกระตุ้นการตัดสินใจซื้อ โดยอ้างอิงจาก "ชื่อสินค้า" ที่ได้รับ\n\nโครงสร้างบังคับ:\n1. พاดหัวหลักให้น่าสนใจ (ใช้อีโมจิ 1-2 ตัว)\n2. เกริ่นนำสั้นๆ ถึงปัญหาที่ช่วยแก้ หรือความเท่/ประโยชน์ที่ได้\n3. จุดเด่นสินค้า (Bullet points สั้นๆ 3-5 ข้อ พร้อมอีโมจินำหน้า)\n4. ประโยคสรุปกระตุ้นการซื้อ\n\nกฎ: ตอบกลับเฉพาะเนื้อหาคำบรรยายเท่านั้น ห้ามพิมพ์คำอธิบาย แนะนำตัว หรือคำลงท้ายใดๆ นอกเหนือจากเนื้อหาสินค้า`,
      greetingMessage: 'ระบบสร้างคำบรรยายพร้อมแล้วครับ ส่งชื่อสินค้ามาได้เลย',
      canUseTools: false,
      isActive: true,
    }
  ];

  for (const bot of defaultBots) {
    // 🔍 1. หาบอทที่เป็นของ HQ (ใช้ compHQ.id)
    const existingBot = await prisma.intAiBot.findFirst({
      where: { 
        code: bot.code,
        companyId: compHQ.id // 🌟 ผูกกับบริษัทแม่ (HQ)
      }
    });

    if (existingBot) {
      // 📝 2. ถ้ามีแล้วให้อัปเดต
      await prisma.intAiBot.update({
        where: { id: existingBot.id },
        data: bot
      });
    } else {
      // ✨ 3. ถ้ายังไม่มีให้สร้างใหม่
      await prisma.intAiBot.create({
        data: {
          ...bot,
          companyId: compHQ.id, // 🌟 ผูกกับบริษัทแม่ (HQ)
        }
      });
    }
  }
  console.log(`✅ Default AI Bots seeded! (${defaultBots.length} bots)`);


  // =========================================================
  // 📜 11. สร้างนโยบายมาตรฐาน (Privacy Policy & Terms)
  // =========================================================
  console.log('📜 Seeding Default Privacy Policy & Terms...');

  const policies = [
    {
      slug: 'privacy-policy',
      title: 'นโยบายความเป็นส่วนตัว (Privacy Policy)',
      content: {
        lastUpdated: new Date().toISOString(),
        sections: [
          {
            title: "1. ข้อมูลที่เราจัดเก็บ",
            body: "เราเก็บรวบรวมข้อมูลที่จำเป็นเพื่อการยืนยันตัวตน ได้แก่ ชื่อ (Display Name), อีเมล (Email) และรูปโปรไฟล์ ผ่านบริการ Social Login (Google, Facebook, LINE)"
          },
          {
            title: "2. วัตถุประสงค์การใช้งาน",
            body: "เพื่อใช้ในการเข้าสู่ระบบ และจัดการสิทธิ์การเข้าถึงข้อมูลภายในบริษัท (Multi-tenant) ของท่านอย่างปลอดภัย"
          },
          {
            title: "3. การรักษาความปลอดภัย",
            body: "ข้อมูลของท่านจะถูกจัดเก็บในระบบ Cloud ที่มีมาตรฐานความปลอดภัยสูง และจะไม่มีการเปิดเผยข้อมูลส่วนบุคคลให้แก่บุคคลภายนอกโดยไม่ได้รับอนุญาต"
          },
          {
            title: "4. การขอลบข้อมูล",
            body: "ผู้ใช้งานสามารถแจ้งขอลบข้อมูลบัญชีและข้อมูลส่วนบุคคลได้ทุกเมื่อผ่านเมนู 'ตั้งค่าโปรไฟล์' หรือติดต่อผู้ดูแลระบบ"
          }
        ]
      }
    },
    {
      slug: 'terms-of-service',
      title: 'ข้อกำหนดและเงื่อนไขการใช้งาน (Terms of Service)',
      content: {
        lastUpdated: new Date().toISOString(),
        sections: [
          {
            title: "1. การใช้งานระบบ",
            body: "ผู้ใช้ตกลงที่จะใช้งานระบบภายใต้กฎระเบียบของบริษัทและไม่กระทำการใดๆ ที่ส่งผลเสียต่อความมั่นคงของระบบ"
          },
          {
            title: "2. ความรับผิดชอบต่อบัญชี",
            body: "ผู้ใช้ต้องรักษาความลับของบัญชีผู้ใช้และรับผิดชอบต่อกิจกรรมที่เกิดขึ้นภายใต้บัญชีของตน"
          }
        ]
      }
    }
  ];

  for (const policy of policies) {
    await prisma.cmsPage.upsert({
      where: {
        companyId_slug: {
          companyId: compHQ.id, 
          slug: policy.slug
        }
      },
      update: {
        title: policy.title,
        content: policy.content as any, // บันทึกลงฟิลด์ Json
      },
      create: {
        companyId: compHQ.id,
        slug: policy.slug,
        title: policy.title,
        content: policy.content as any,
        // ✅ นำ isActive ออกแล้วเพื่อให้ตรงกับ Schema
      }
    });
  }
  console.log('✅ Default Policies seeded for HQ!');

  async function seedBoxSizes() {
  console.log('Seeding Box Sizes...');

  // 1. สร้างหัวกลุ่ม BOX_SIZE
  const boxGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'BOX_SIZE' },
    update: {},
    create: {
      groupCode: 'BOX_SIZE',
      groupName: 'ขนาดกล่องมาตรฐาน',
      description: 'ขนาดกล่องสำหรับคำนวณโลจิสติกส์ (หน่วย cm)',
      isSystem: true,
      isActive: true,
    },
  });

  // 2. ข้อมูลขนาดกล่อง (ตัวอย่างไซส์มาตรฐานไปรษณีย์ไทย/Flash)
  const boxSizes = [
    { code: 'BOX-00', name: 'กล่องเบอร์ 00', labels: { width: 9.7, length: 14, height: 6 }, sortOrder: 1 },
    { code: 'BOX-0',  name: 'กล่องเบอร์ 0',  labels: { width: 11, length: 17, height: 6 }, sortOrder: 2 },
    { code: 'BOX-A',  name: 'กล่องเบอร์ A',  labels: { width: 14, length: 20, height: 6 }, sortOrder: 3 },
    { code: 'BOX-B',  name: 'กล่องเบอร์ B',  labels: { width: 17, length: 25, height: 9 }, sortOrder: 4 },
    { code: 'BOX-C',  name: 'กล่องเบอร์ C',  labels: { width: 20, length: 30, height: 11 }, sortOrder: 5 },
    { code: 'BOX-D',  name: 'กล่องเบอร์ D',  labels: { width: 22, length: 35, height: 14 }, sortOrder: 6 },
    { code: 'BOX-E',  name: 'กล่องเบอร์ E',  labels: { width: 24, length: 40, height: 17 }, sortOrder: 7 },
  ];

  for (const box of boxSizes) {
    // 🔍 2. ใช้ findFirst แทน upsert เพราะ findFirst ยอมให้ companyId เป็น null ได้
    const existing = await prisma.cfgMasterData.findFirst({
      where: {
        masterGroupId: boxGroup.id, // 🌟 ใช้ ID ที่ได้จากการสร้างกลุ่มแม่
        code: box.code,
        companyId: null, // 🌟 ข้อมูลกลาง
      },
    });

    if (existing) {
      // 📝 3. ถ้าเจอแล้วให้ Update
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: {
          name: box.name,
          labels: box.labels,
          sortOrder: box.sortOrder,
        },
      });
    } else {
      // ✨ 4. ถ้าไม่เจอให้ Create
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: boxGroup.id, // 🌟 ใช้ ID ที่ได้จากการสร้างกลุ่มแม่
          code: box.code,
          name: box.name,
          labels: box.labels,
          sortOrder: box.sortOrder,
          companyId: null,
          isActive: true,
        },
      });
    }
  }

  console.log('✅ Standard Box Sizes Seeded!');
}

async function seedProductUnits() {
  console.log('Seeding Product Units...');

  // 1. สร้างหัวกลุ่ม PRODUCT_UNIT
  const unitGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'PRODUCT_UNIT' },
    update: {},
    create: {
      groupCode: 'PRODUCT_UNIT',
      groupName: 'หน่วยนับสินค้า',
      description: 'หน่วยนับมาตรฐานสำหรับสินค้าในระบบ',
      isSystem: true,
      isActive: true,
    },
  });

  // 2. รายการหน่วยนับที่ใช้บ่อย
  const units = [
    { code: 'UNIT-PCS',  name: 'ชิ้น',     labels: { en: 'Piece', th: 'ชิ้น' }, sortOrder: 1 },
    { code: 'UNIT-PACK', name: 'แพ็ค',    labels: { en: 'Pack', th: 'แพ็ค' }, sortOrder: 2 },
    { code: 'UNIT-BOX',  name: 'กล่อง',    labels: { en: 'Box', th: 'กล่อง' }, sortOrder: 3 },
    { code: 'UNIT-SET',  name: 'ชุด',     labels: { en: 'Set', th: 'ชุด' }, sortOrder: 4 },
    { code: 'UNIT-KG',   name: 'กิโลกรัม',  labels: { en: 'Kilogram', th: 'กิโลกรัม' }, sortOrder: 5 },
    { code: 'UNIT-GRAM', name: 'กรัม',     labels: { en: 'Gram', th: 'กรัม' }, sortOrder: 6 },
    { code: 'UNIT-LITER', name: 'ลิตร',    labels: { en: 'Liter', th: 'ลิตร' }, sortOrder: 7 },
  ];

  for (const u of units) {
    // 🔍 2. ใช้ findFirst เพื่อเช็คข้อมูลเดิม (รองรับเงื่อนไข companyId: null)
    const existing = await prisma.cfgMasterData.findFirst({
      where: {
        masterGroupId: unitGroup.id, // 🌟 ใช้ ID จากกลุ่มที่เราเพิ่ง upsert ด้านบน
        code: u.code,
        companyId: null,
      },
    });

    if (existing) {
      // 📝 3. ถ้ามีแล้ว ให้ Update
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: {
          name: u.name,
          labels: u.labels,
          sortOrder: u.sortOrder,
        },
      });
    } else {
      // ✨ 4. ถ้าไม่มี ให้ Create
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: unitGroup.id, // 🌟 ใช้ ID จากกลุ่มแม่
          code: u.code,
          name: u.name,
          labels: u.labels,
          sortOrder: u.sortOrder,
          companyId: null,
          isActive: true,
        },
      });
    }
  }

  console.log('✅ Product Units Seeded!');
}

async function seedCompanyTypes() {
  console.log('Seeding Rounding Types...');

  // 1. สร้างหัวกลุ่ม ROUNDINGTYPE
  const roundingGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'COMPANYTYPE' },
    update: {},
    create: {
      groupCode: 'COMPANYTYPE',
      groupName: 'ประเภทบริษัท',
      description: 'ประเภทบริษัท INDIVIDUAL , CORPORATE , BRANCH',
      isSystem: true,
      isActive: true,
    },
  });

  // 2. ข้อมูลประเภทการปัดเศษ (อ้างอิงจากหน้า UI)
  const roundingTypes = [
    { code: 'INDIVIDUAL', name: 'INDIVIDUAL (บุคคลธรรดา)', sortOrder: 1 },
    { code: 'CORPORATE', name: 'CORPORATE (นิติบุคคล)', sortOrder: 2 },
    { code: 'BRANCH', name: 'BRANCH (สาขา)', sortOrder: 3 },
  ];

  for (const rType of roundingTypes) {
    // 🔍 ใช้ findFirst เพื่อเช็คข้อมูลเดิม (รองรับเงื่อนไข companyId: null)
    const existing = await prisma.cfgMasterData.findFirst({
      where: {
        masterGroupId: roundingGroup.id, // 🌟 ใช้ ID จากกลุ่มแม่
        code: rType.code,
        companyId: null, // 🌟 ข้อมูลกลางของระบบ
      },
    });

    if (existing) {
      // 📝 ถ้ามีแล้ว ให้ Update เผื่อมีการแก้ชื่อ
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: {
          name: rType.name,
          sortOrder: rType.sortOrder,
        },
      });
    } else {
      // ✨ ถ้าไม่มี ให้ Create ใหม่
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: roundingGroup.id,
          code: rType.code,
          name: rType.name,
          sortOrder: rType.sortOrder,
          companyId: null,
          isActive: true,
          labels: {}
        },
      });
    }
  }

  console.log('✅ Rounding Types Seeded!');
}

async function seedRoundingTypes() {
  console.log('Seeding Rounding Types...');

  // 1. สร้างหัวกลุ่ม ROUNDINGTYPE
  const roundingGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'ROUNDINGTYPE' },
    update: {},
    create: {
      groupCode: 'ROUNDINGTYPE',
      groupName: 'ประเภทการปัดเศษ',
      description: 'รูปแบบการปัดเศษสำหรับใช้ในกฎการปัดเศษ',
      isSystem: true,
      isActive: true,
    },
  });

  // 2. ข้อมูลประเภทการปัดเศษ (อ้างอิงจากหน้า UI)
  const roundingTypes = [
    { code: 'R_01', name: 'ปัดเศษ จุดทศนิยม (decimal)', sortOrder: 1 },
    { code: 'R_02', name: 'ปัดเศษ ทั้งหมด (Whole)', sortOrder: 2 },
  ];

  for (const rType of roundingTypes) {
    // 🔍 ใช้ findFirst เพื่อเช็คข้อมูลเดิม (รองรับเงื่อนไข companyId: null)
    const existing = await prisma.cfgMasterData.findFirst({
      where: {
        masterGroupId: roundingGroup.id, // 🌟 ใช้ ID จากกลุ่มแม่
        code: rType.code,
        companyId: null, // 🌟 ข้อมูลกลางของระบบ
      },
    });

    if (existing) {
      // 📝 ถ้ามีแล้ว ให้ Update เผื่อมีการแก้ชื่อ
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: {
          name: rType.name,
          sortOrder: rType.sortOrder,
        },
      });
    } else {
      // ✨ ถ้าไม่มี ให้ Create ใหม่
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: roundingGroup.id,
          code: rType.code,
          name: rType.name,
          sortOrder: rType.sortOrder,
          companyId: null,
          isActive: true,
          labels: {}
        },
      });
    }
  }

  console.log('✅ Rounding Types Seeded!');
}

  // =========================================================
// 🛒 SEED: หมวดหมู่สินค้ามาตรฐาน (PRODUCT_CATEGORY)
// =========================================================
async function seedProductCategories() {
  console.log('Seeding Product Categories...');

  // 1. สร้างหัวกลุ่ม (Master Group)
  const categoryGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'PRODUCT_CATEGORY' },
    update: {},
    create: {
      groupCode: 'PRODUCT_CATEGORY',
      groupName: 'กลุ่มประเภทสินค้า',
      description: 'หมวดหมู่สินค้ามาตรฐานสำหรับใช้งานในระบบ E-commerce',
      isSystem: false,
      isActive: true,
    },
  });

  // 2. ข้อมูลหมวดหมู่มาตรฐาน (เหมือนเดิม)
  const categories = [
    { code: 'CAT-01', name: 'เสื้อผ้าและแฟชั่น', labels: { descriptionEN: 'Clothing & Fashion', descriptionTH: 'เสื้อผ้า เครื่องแต่งกาย รองเท้า และเครื่องประดับ' }, sortOrder: 1 },
    { code: 'CAT-02', name: 'สุขภาพและความงาม', labels: { descriptionEN: 'Health & Beauty', descriptionTH: 'เครื่องสำอาง สกินแคร์ อาหารเสริม และอุปกรณ์ดูแลสุขภาพ' }, sortOrder: 2 },
    { code: 'CAT-03', name: 'อิเล็กทรอนิกส์และแก็ดเจ็ต', labels: { descriptionEN: 'Electronics & Gadgets', descriptionTH: 'โทรศัพท์มือถือ คอมพิวเตอร์ กล้อง และอุปกรณ์ไอที' }, sortOrder: 3 },
    { code: 'CAT-04', name: 'ของใช้ในบ้านและเฟอร์นิเจอร์', labels: { descriptionEN: 'Home & Living', descriptionTH: 'ของตกแต่งบ้าน เฟอร์นิเจอร์ และเครื่องใช้ในครัวเรือน' }, sortOrder: 4 },
    { code: 'CAT-05', name: 'อาหารและเครื่องดื่ม', labels: { descriptionEN: 'Food & Beverage', descriptionTH: 'อาหารแห้ง ขนมขบเคี้ยว เครื่องดื่ม และวัตถุดิบทำอาหาร' }, sortOrder: 5 },
    { code: 'CAT-06', name: 'กีฬาและกิจกรรมกลางแจ้ง', labels: { descriptionEN: 'Sports & Outdoors', descriptionTH: 'อุปกรณ์กีฬา ชุดออกกำลังกาย และอุปกรณ์ตั้งแคมป์' }, sortOrder: 6 },
    { code: 'CAT-07', name: 'แม่และเด็ก', labels: { descriptionEN: 'Mom & Baby', descriptionTH: 'เสื้อผ้าเด็ก ของเล่นเสริมพัฒนาการ และของใช้สำหรับคุณแม่' }, sortOrder: 7 },
    { code: 'CAT-08', name: 'สัตว์เลี้ยง', labels: { descriptionEN: 'Pet Supplies', descriptionTH: 'อาหารสัตว์ ของเล่น และอุปกรณ์ดูแลสัตว์เลี้ยง' }, sortOrder: 8 },
    { code: 'CAT-09', name: 'หนังสือและเครื่องเขียน', labels: { descriptionEN: 'Books & Stationery', descriptionTH: 'หนังสือ เครื่องเขียน และอุปกรณ์สำนักงาน' }, sortOrder: 9 },
    { code: 'CAT-10', name: 'ยานยนต์และอุปกรณ์', labels: { descriptionEN: 'Automotive', descriptionTH: 'อะไหล่รถยนต์ มอเตอร์ไซค์ และอุปกรณ์ตกแต่งรถ' }, sortOrder: 10 },
  ];

  // 3. วนลูปบันทึก (ปรับปรุงส่วน WHERE ให้ตรงตาม Schema ใหม่)
  for (const cat of categories) {
    // 🔍 2. ค้นหาโดยใช้ ID จาก categoryGroup ที่ได้มาจากข้อ 1 (ไม่ใช่เลข 6)
    const existing = await prisma.cfgMasterData.findFirst({
      where: {
        masterGroupId: categoryGroup.id, // 🌟 ใช้ตัวแปร ID แทนตัวเลขคงที่
        code: cat.code,
        companyId: null,
      },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { name: cat.name, sortOrder: cat.sortOrder },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: categoryGroup.id, // 🌟 ใช้ตัวแปร ID
          code: cat.code,
          name: cat.name,
          companyId: null,
          isActive: true,
          sortOrder: cat.sortOrder,
          labels: {} // ใส่ค่าว่างไว้ก่อนได้ครับ
        },
      });
    }
  }

  console.log('✅ Product Categories Seeded with Null CompanyId!');
}


  // =========================================================
  // 🏦 12. สร้าง MASTER DATA: ธนาคาร (CfgBank)
  // =========================================================
  console.log('🏦 Seeding Thailand Banks Master Data...');

  const banksData = [
    { code: 'BBL',   officialCode: '002', nameTh: 'ธนาคารกรุงเทพ', nameEn: 'Bangkok Bank', color: '#1E3163', sortOrder: 1 },
    { code: 'KBANK', officialCode: '004', nameTh: 'ธนาคารกสิกรไทย', nameEn: 'Kasikornbank', color: '#138F2D', sortOrder: 2 },
    { code: 'KTB',   officialCode: '006', nameTh: 'ธนาคารกรุงไทย', nameEn: 'Krungthai Bank', color: '#00A1E0', sortOrder: 3 },
    { code: 'SCB',   officialCode: '014', nameTh: 'ธนาคารไทยพาณิชย์', nameEn: 'Siam Commercial Bank', color: '#4E2E7F', sortOrder: 4 },
    { code: 'BAY',   officialCode: '025', nameTh: 'ธนาคารกรุงศรีอยุธยา', nameEn: 'Bank of Ayudhya', color: '#FDC300', sortOrder: 5 },
    { code: 'TTB',   officialCode: '011', nameTh: 'ธนาคารทหารไทยธนชาต', nameEn: 'TMBThanachart Bank', color: '#0050EF', sortOrder: 6 },
    { code: 'GSB',   officialCode: '030', nameTh: 'ธนาคารออมสิน', nameEn: 'Government Savings Bank', color: '#EC008C', sortOrder: 7 },
    { code: 'UOBT',  officialCode: '024', nameTh: 'ธนาคารยูโอบี', nameEn: 'United Overseas Bank', color: '#003679', sortOrder: 8 },
    { code: 'GHB',   officialCode: '033', nameTh: 'ธนาคารอาคารสงเคราะห์', nameEn: 'Government Housing Bank', color: '#F58220', sortOrder: 9 },
    { code: 'BAAC',  officialCode: '034', nameTh: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', nameEn: 'Bank for Agriculture and Agricultural Cooperatives', color: '#008542', sortOrder: 10 },
    { code: 'CIMBT', officialCode: '022', nameTh: 'ธนาคารซีไอเอ็มบี ไทย', nameEn: 'CIMB Thai Bank', color: '#7E0600', sortOrder: 11 },
    { code: 'KKP',   officialCode: '069', nameTh: 'ธนาคารเกียรตินาคินภัทร', nameEn: 'Kiatnakin Phatra Bank', color: '#542E91', sortOrder: 12 },
    { code: 'LHBANK', officialCode: '073', nameTh: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', nameEn: 'Land and Houses Bank', color: '#605E5E', sortOrder: 13 },
    { code: 'ICBCT', officialCode: '070', nameTh: 'ธนาคารไอซีบีซี (ไทย)', nameEn: 'ICBC (Thai)', color: '#C5000B', sortOrder: 14 },
  ];

  for (const bank of banksData) {
    await prisma.cfgBank.upsert({
      where: { code: bank.code },
      update: {
        officialCode: bank.officialCode,
        nameTh: bank.nameTh,
        nameEn: bank.nameEn,
        color: bank.color,
        sortOrder: bank.sortOrder,
        isActive: true
      },
      create: {
        code: bank.code,
        officialCode: bank.officialCode,
        nameTh: bank.nameTh,
        nameEn: bank.nameEn,
        color: bank.color,
        sortOrder: bank.sortOrder,
        isActive: true
      }
    });
  }
  console.log(`✅ Seeded ${banksData.length} banks into CfgBank.`);

  // =========================================================
  // 8. สร้าง USER
  // =========================================================
  const passwordHash = await bcrypt.hash('Admin@1234', 10);
  const superUser = await prisma.secUser.upsert({
    where: { username: 'super_admin' },
    update: { passwordHash },
    create: {
      username: 'super_admin',
      passwordHash,
      email: 'admin@kookshop.com',
      fullName: 'Super Admin System',
      isActive: true,
    }
  });

  await prisma.secUserRole.upsert({
    where: { userId_roleId_companyId: { userId: superUser.id, roleId: roleAdmin.id, companyId: compHQ.id } },
    update: {},
    create: { userId: superUser.id, roleId: roleAdmin.id, companyId: compHQ.id }
  });

  console.log('✅ SEED COMPLETED: Packages & Modules Linked.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });