import { PrismaClient ,ResetCriteria } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🔥 Cloud Database: Force cleaning all tables (Deep Clean)...');

  // =========================================================
  // 🧹 1. CLEANUP SECTION (Child -> Parent)
  // =========================================================
  try {
   // await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);
     await prisma.sysPackageModule.deleteMany({}); // ✅ ลบการจับคู่ Package เก่า
     // =========================================================

    // 🧹 ลบข้อมูลระบบจัดการเอกสาร (DMS) ก่อนเป็นอันดับแรก
    // เพราะมีการผูก Foreign Key กับ User และ Workflow เอาไว้แน่นหนา
    // =========================================================
    await prisma.docSignature.deleteMany({});
    await prisma.docSignatureRequest.deleteMany({});
    await prisma.docFileShareLink.deleteMany({});
    await prisma.docFileMetadata.deleteMany({});
    await prisma.docFileAccess.deleteMany({});
    await prisma.docFolderAccess.deleteMany({});
    await prisma.docFileVersion.deleteMany({});
    await prisma.docFile.deleteMany({});
    await prisma.docFolder.deleteMany({});
    await prisma.wfAction.deleteMany({});
    await prisma.wfRequest.deleteMany({});
    await prisma.wfNode.deleteMany({});
    await prisma.wfModuleMapping.deleteMany({});
    await prisma.wfDefinition.deleteMany({});
     await prisma.sysAiModelConfig.deleteMany({}); // ✅ เพิ่มบรรทัดนี้: ลบเรทราคา AI เก่า
     await prisma.sysPackage.deleteMany({});       // ✅ ลบ Package เก่า
     await prisma.hrOrgStructureVersion.deleteMany({});
     await prisma.sysMedia.deleteMany({});
     await prisma.hrDepartmentPositionVersion.deleteMany({});
     await prisma.hrDepartmentVersion.deleteMany({});
     await prisma.hrDepartmentPosition.deleteMany({});
     await prisma.comProductTierPrice.deleteMany({});
     await prisma.comProductPriceSet.deleteMany({});
     await prisma.comShippingMethod.deleteMany({});
     await prisma.comShippingRule.deleteMany({});
     await prisma.comShopProfile.deleteMany({});
     await prisma.comProduct.deleteMany({});
     
     await prisma.hrJobHistory.deleteMany({});
     await prisma.hrEmploymentPeriod.deleteMany({});
     await prisma.hrEmployee.deleteMany({});
     await prisma.hrDepartment.deleteMany({});
     await prisma.hrPosition.deleteMany({});
     await prisma.hrCalendar.deleteMany({});
     await prisma.hrEmployeeInfo.deleteMany({});
     
     await prisma.hrWorkPattern.deleteMany({});
     

     // 🌟 เพิ่มบรรทัดนี้: ลบข้อมูลไฟล์ในตารางกลางทิ้งก่อน
    await prisma.sysMedia.deleteMany({}); 
    
    // (ถ้ามีตารางประกาศ ก็แนะนำให้ลบก่อนเหมือนกันครับ)
    await prisma.comAnnouncement.deleteMany({});
    


  
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
    //await prisma.comProduct.deleteMany({});
    await prisma.intAiQuota.deleteMany({});
    // 🌟 เพิ่มการลบ Master Data (ลบลูกก่อน)
    await prisma.cfgMasterData.deleteMany({}); 
    // 🌟 แล้วค่อยลบกลุ่มแม่
    await prisma.cfgMasterGroup.deleteMany({});
    await prisma.orgCompany.deleteMany({});
    await prisma.sysModule.deleteMany({});
 
    // เปิดการเช็คกลับมาเป็นปกติ
   
    console.log('✨ Cleanup Success!');
  } catch (error) {
    console.warn('⚠️ Cleanup warning: Some tables might be empty.', error);
  }

  console.log('🌱 Starting Seed for kkv-Mainservice...');

  await seedSystemConfigs(prisma);
  await seedRunningFormats(prisma);
  await seedAiModelConfigs(prisma);
  await seedSocialLoginProviders(prisma);
  await seedMemberLevels(prisma);
  await seedProductVisibility(prisma);
  await seedBanks(prisma);
  await seedProductCategories();
  await seedBoxSizes();
  await seedProductUnits();
  await seedRoundingTypes();
  await seedCompanyTypes();
  await seedCurrencies(); 
  await seedTimezones();  // 👈 เพิ่มตรงนี้
  await seedPaymentMethodTypes();
  await seedProductStatuses();
  await seedProductSalesTypes();
  await seedProductTypes();
  await seedEmploymentStatuses();
  await seedSystemEnums();
  await seedRemainingEnums();
  await seedHrEnums();
  await seedHrEmployeeEnums();
  await seedMilitaryStatuses();
  await seedSex();
  await seedWorkflowBusinessTypes(prisma);
  await seedAdditionalEnums();
  
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
    { code: 'MOD_TIME', name: 'Time Management', sortOrder: 7 },
    { code: 'MOD_LEAVE', name: 'Leave Management', sortOrder: 8 },
    // --- 📂 กลุ่ม Document Management System (DMS) ---
    { code: 'MOD_DOC', name: 'Document Management (ระบบจัดการเอกสารพื้นฐาน)', sortOrder: 9 },
    { code: 'MOD_DOC_SIGN', name: 'Digital Signature (ระบบลายเซ็นดิจิทัล)', sortOrder: 10 },
    { code: 'MOD_DOC_SECURE_DELETE', name: 'Secure Delete Workflow (สายอนุมัติทำลายเอกสาร)', sortOrder: 11 },
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
      resellerPrice: 0,
      maxCompanies: 1,
      maxUsers: 5,
      maxStorageMB: 5120,
      aiTokenLimit: 100000, 
      // แพ็กเกจเริ่มต้น ได้แค่ระบบพื้นฐาน + HR
      modules: ['MOD_CORE', 'MOD_ORG', 'MOD_HR','MOD_DOC'] 
    },
    {
      code: 'PRO',
      name: 'Professional',
      price: 1590,
      resellerPrice: 1200,
      maxCompanies: 3,
      maxUsers: 20,
      maxStorageMB: 51200,
      aiTokenLimit: 100000, 
      // แพ็กเกจโปร ได้ CRM และ ระบบขายเพิ่มมา
      modules: ['MOD_CORE', 'MOD_ORG', 'MOD_HR', 'MOD_CRM', 'MOD_COM','MOD_DOC', 'MOD_DOC_SIGN']
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      price: 4990,
      resellerPrice: 3500,
      maxCompanies: 10,
      maxUsers: 100,
      maxStorageMB: 512000,
      aiTokenLimit: 1000000,
      // แพ็กเกจใหญ่ ได้ครบทุกอย่างรวมถึง AI
      modules: ['MOD_CORE', 'MOD_ORG', 'MOD_HR', 'MOD_CRM', 'MOD_COM', 'MOD_INT', 'MOD_TIME', 'MOD_LEAVE','MOD_DOC', 'MOD_DOC_SIGN', 'MOD_DOC_SECURE_DELETE']
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
        resellerPrice : p.resellerPrice,
        maxCompanies: p.maxCompanies,
        maxUsers: p.maxUsers,
        maxStorageMB: p.maxStorageMB,
        aiTokenLimit: p.aiTokenLimit
      },
      create: {
        code: p.code,
        name: p.name,
        price: p.price,
        resellerPrice : p.resellerPrice,
        maxCompanies: p.maxCompanies,
        maxUsers: p.maxUsers,
        maxStorageMB: p.maxStorageMB,
        aiTokenLimit: p.aiTokenLimit,
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
  // 4. สร้าง SUBSCRIPTIONS & BILLING HISTORY สำหรับ HQ
  // =========================================================
  console.log('📦 Activating Subscriptions & Billing for HQ...');
  
  // 4.1 ผูกสิทธิ์ทุก Module (ตามแพ็กเกจ Enterprise) ให้ HQ
  for (const moduleCode in moduleMap) {
    const existingSub = await prisma.orgSubscription.findFirst({
      where: { 
        companyId: compHQ.id, 
        moduleId: moduleMap[moduleCode].id,
        status: 'ACTIVE'
      }
    });

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

  // 4.2 สร้างประวัติบิล (Billing History) เริ่มต้นให้ HQ
  const existingBill = await prisma.orgBillingHistory.findFirst({
    where: { 
      companyId: compHQ.id,
      action: 'NEW_PACKAGE'
    }
  });

  if (!existingBill) {
    await prisma.orgBillingHistory.create({
      data: {
        companyId: compHQ.id,
        action: 'NEW_PACKAGE',
        packageId: packageMap['ENTERPRISE']?.id, // ใช้ ID ของแพ็กเกจ Enterprise
        price: packageMap['ENTERPRISE']?.price || 0, // ดึงราคาจากที่ตั้งไว้
        resellerPrice: 0, 
        note: 'Initial System Seed - HQ Enterprise Package',
        // operatorId ไม่ต้องใส่ เพราะเป็นระบบสร้างขึ้นมาอัตโนมัติตอน Seed
      }
    });
    console.log('✅ Billing History created for HQ!');
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

    { resource: 'workflow_setup', action: 'view', desc: 'ดูประวัติการใช้งาน Workflow', mod: 'MOD_CORE' },
    { resource: 'workflow_setup', action: 'create', desc: 'สร้าง Workflow ใหม่', mod: 'MOD_CORE' },
    { resource: 'workflow_setup', action: 'update', desc: 'แก้ไข Workflow', mod: 'MOD_CORE' },
    { resource: 'workflow_setup', action: 'delete', desc: 'ลบ Workflow ออกจากระบบ', mod: 'MOD_CORE' },

    { resource: 'workflow_request', action: 'view', desc: 'ดูประวัติการใช้งาน Workflow request', mod: 'MOD_CORE' },
    { resource: 'workflow_request', action: 'create', desc: 'สร้าง Workflow request ใหม่', mod: 'MOD_CORE' },
    { resource: 'workflow_request', action: 'update', desc: 'แก้ไข Workflow request', mod: 'MOD_CORE' },

    { resource: 'delegation', action: 'view', desc: 'ดูประวัติการใช้งาน deleation', mod: 'MOD_CORE' },
    { resource: 'delegation', action: 'create', desc: 'สร้าง deleation ใหม่', mod: 'MOD_CORE' },
    { resource: 'delegation', action: 'update', desc: 'แก้ไข deleation', mod: 'MOD_CORE' },
    { resource: 'delegation', action: 'delete', desc: 'ลบ deleation ออกจากระบบ', mod: 'MOD_CORE' },

    { resource: 'document', action: 'view', desc: 'ดูรายการ Document', mod: 'MOD_DOC' },
    { resource: 'document', action: 'create', desc: 'สร้าง Document ใหม่', mod: 'MOD_DOC' },
    { resource: 'document', action: 'update', desc: 'แก้ไขข้อมูล Document', mod: 'MOD_DOC' },
    { resource: 'document', action: 'delete', desc: 'ลบ Document ออกจากระบบ', mod: 'MOD_DOC' },

    
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

    { resource: 'warehouse', action: 'view', desc: 'ดู/ใช้งานข้อมูลคลัง', mod: 'MOD_COM' },
    { resource: 'warehouse', action: 'create', desc: 'สร้างข้อมูลคลังใหม่', mod: 'MOD_COM' },
    { resource: 'warehouse', action: 'update', desc: 'แก้ไขข้อมูลคลัง', mod: 'MOD_COM' },
    { resource: 'warehouse', action: 'delete', desc: 'ลบข้อมูลคลังออกจากระบบ', mod: 'MOD_COM' },

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

    { resource: 'position_seat', action: 'create', desc: 'สร้างตำแหน่งงานใหม่', mod: 'MOD_HR' },
    { resource: 'position_seat', action: 'update', desc: 'แก้ไขข้อมูลตำแหน่งงาน', mod: 'MOD_HR' },
    { resource: 'position_seat', action: 'view', desc: 'ดู/ใช้งานตำแหน่งงาน', mod: 'MOD_HR' },
    { resource: 'position_seat', action: 'delete', desc: 'ลบตำแหน่งงานออกจากระบบ', mod: 'MOD_HR' },

    { resource: 'asset', action: 'create', desc: 'สร้างครุภัณฑ์ใหม่', mod: 'MOD_HR' },
    { resource: 'asset', action: 'update', desc: 'แก้ไขข้อมูลครุภัณฑ์', mod: 'MOD_HR' },
    { resource: 'asset', action: 'view', desc: 'ดู/ใช้งานครุภัณฑ์', mod: 'MOD_HR' },
    { resource: 'asset', action: 'delete', desc: 'ลบครุภัณฑ์ออกจากระบบ', mod: 'MOD_HR' },

    { resource: 'org_structure', action: 'create', desc: 'สร้างโครงสร้างองค์กรใหม่', mod: 'MOD_HR' },
    { resource: 'org_structure', action: 'update', desc: 'แก้ไขข้อมูลโครงสร้างองค์กร', mod: 'MOD_HR' },
    { resource: 'org_structure', action: 'delete', desc: 'ลบโครงสร้างองค์กรออกจากระบบ', mod: 'MOD_HR' },

    { resource: 'hr:calendar', action: 'view', desc: 'ดู/ใช้งานปฏิทินวันหยุด', mod: 'MOD_TIME' },
    { resource: 'hr:calendar', action: 'create', desc: 'สร้างปฏิทินวันหยุดใหม่', mod: 'MOD_TIME' },
    { resource: 'hr:calendar', action: 'update', desc: 'แก้ไขข้อมูลปฏิทินวันหยุด', mod: 'MOD_TIME' },
    { resource: 'hr:calendar', action: 'delete', desc: 'ลบปฏิทินวันหยุดออกจากระบบ', mod: 'MOD_TIME' },

    { resource: 'disciplinary', action: 'create', desc: 'สร้างบทลงโทษใหม่', mod: 'MOD_HR' },
    { resource: 'disciplinary', action: 'update', desc: 'แก้ไขข้อมูลบทลงโทษ', mod: 'MOD_HR' },
    { resource: 'disciplinary', action: 'view', desc: 'ดู/ใช้งานบทลงโทษ', mod: 'MOD_HR' },
    { resource: 'disciplinary', action: 'delete', desc: 'ลบบทลงโทษออกจากระบบ', mod: 'MOD_HR' },

    { resource: 'training', action: 'create', desc: 'สร้างหลักสูตรใหม่', mod: 'MOD_HR' },
    { resource: 'training', action: 'update', desc: 'แก้ไขข้อมูลหลักสูตร', mod: 'MOD_HR' },
    { resource: 'training', action: 'view', desc: 'ดู/ใช้งานหลักสูตร', mod: 'MOD_HR' },
    { resource: 'training', action: 'delete', desc: 'ลบหลักสูตรออกจากระบบ', mod: 'MOD_HR' },

    { resource: 'meeting_room', action: 'create', desc: 'สร้างห้องประชุมใหม่', mod: 'MOD_HR' },
    { resource: 'meeting_room', action: 'update', desc: 'แก้ไขข้อมูลห้องประชุม', mod: 'MOD_HR' },
    { resource: 'meeting_room', action: 'view', desc: 'ดู/ใช้งานห้องประชุม', mod: 'MOD_HR' },
    { resource: 'meeting_room', action: 'delete', desc: 'ลบห้องประชุมออกจากระบบ', mod: 'MOD_HR' },

    { resource: 'decoration', action: 'create', desc: 'สร้างชั้นตราใหม่', mod: 'MOD_HR' },
    { resource: 'decoration', action: 'update', desc: 'แก้ไขข้อมูลชั้นตรา', mod: 'MOD_HR' },
    { resource: 'decoration', action: 'view', desc: 'ดู/ใช้งานชั้นตรา', mod: 'MOD_HR' },
    { resource: 'decoration', action: 'delete', desc: 'ลบชั้นตราออกจากระบบ', mod: 'MOD_HR' },

    { resource: 'welfare', action: 'create', desc: 'สร้างสวัสดิการใหม่', mod: 'MOD_HR' },
    { resource: 'welfare', action: 'update', desc: 'แก้ไขข้อมูลสวัสดิการ', mod: 'MOD_HR' },
    { resource: 'welfare', action: 'view', desc: 'ดู/ใช้งานสวัสดิการ', mod: 'MOD_HR' },
    { resource: 'welfare', action: 'delete', desc: 'ลบสวัสดิการออกจากระบบ', mod: 'MOD_HR' },


    { resource: 'position_seat', action: 'update', desc: 'แก้ไขข้อมูลตำแหน่งงาน', mod: 'MOD_HR' },
    { resource: 'position_seat', action: 'view', desc: 'ดู/ใช้งานตำแหน่งงาน', mod: 'MOD_HR' },

    { resource: 'hr:shift', action: 'view', desc: 'ดู/ใช้งานกะพนักงาน', mod: 'MOD_TIME' },
    { resource: 'hr:shift', action: 'create', desc: 'สร้างกะพนักงานใหม่', mod: 'MOD_TIME' },
    { resource: 'hr:shift', action: 'update', desc: 'แก้ไขข้อมูลกะพนักงาน', mod: 'MOD_TIME' },
    { resource: 'hr:shift', action: 'delete', desc: 'ลบกะพนักงานออกจากระบบ', mod: 'MOD_TIME' },


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
  // 6. สร้าง MENUS (รายการเมนูแบบ Hierarchical - จัดกลุ่มตามหมวดหมู่)
  // =========================================================
  console.log('📋 Creating Hierarchical System Menus...');

  // 🌟 จัดกลุ่มข้อมูลเมนูใหม่ให้อยู่ในรูปแบบ แม่-ลูก (Parent-Child)
  const menuGroups = [
    {
      name: 'จัดการรายได้', icon: 'Receipt', sortOrder: 1, isSystem: false,
      children: [
        { name: 'ตั้งค่าโมเดล AI', path: '/dashboard/admin/ai-model-configs', icon: 'Settings', sortOrder: 1, mod: 'MOD_CORE' },
        { name: 'การตั้งค่า Subscription', path: '/dashboard/admin/subscriptions', icon: 'CreditCard', sortOrder: 2, mod: 'MOD_CORE' },
        { name: 'ลงทะเบียนบริษัทใหม่', path: '/dashboard/admin/onboarding', icon: 'Briefcase', sortOrder: 3, mod: 'MOD_CORE' },
      ]
    },
    {
      name: 'ความปลอดภัย', icon: 'Key', sortOrder: 2, isSystem: false,
      children: [
        { name: 'ตั้งค่าความปลอดภัย', path: '/dashboard/settings/security', icon: 'ShieldCheck', sortOrder: 1, mod: 'MOD_CORE' },
        { name: 'จัดการบทบาท(Role)', path: '/dashboard/admin/roles', icon: 'UserCheck', sortOrder: 2, mod: 'MOD_CORE' },
        { name: 'จัดการเมนู(Menu)', path: '/dashboard/admin/menus', icon: 'ShieldCheck', sortOrder: 3, mod: 'MOD_CORE' },
        { name: 'สิทธิ์ระบบ (Permission)', path: '/dashboard/admin/permissions', icon: 'ShieldCheck', sortOrder: 4, mod: 'MOD_CORE' },
        // (ตัดจัดการเมนูที่ซ้ำกันออก 1 อันครับ)
        { name: 'จัดการผู้ใช้งาน(User)', path: '/dashboard/admin/users', icon: 'User', sortOrder: 5, mod: 'MOD_CORE' },
      ]
    },
    {
      name: 'รูปแบบธุรกิจ', icon: 'Building2', sortOrder: 3, isSystem: false,
      children: [
        { name: 'จัดการโครงสร้างองค์กร', path: '/dashboard/admin/companies', icon: 'Building', sortOrder: 1, mod: 'MOD_ORG' }, 
        { name: 'จัดการบริษัท', path: '/dashboard/settings/business', icon: 'Building2', sortOrder: 2, mod: 'MOD_ORG' }, 
        { name: 'จัดการครุภัณฑ์', path: '/dashboard/admin/assets', icon: 'Building2', sortOrder: 3, mod: 'MOD_ORG' }, 
      ]
    },
    {
      name: 'ระบบส่วนกลาง', icon: 'Star', sortOrder: 4, isSystem: false,
      children: [
        { name: 'ศูนย์สื่อสาร', path: '/dashboard/admin/communication', icon: 'MessageSquare', sortOrder: 1, mod: 'MOD_ORG' },
        { name: 'Monitor', path: '/dashboard/admin/monitor', icon: 'Monitor', sortOrder: 2, mod: 'MOD_CORE' },
        { name: 'ตั้งค่าระบบ', path: '/dashboard/settings/system', icon: 'ShieldCheck', sortOrder: 3, mod: 'MOD_CORE' },
        { name: 'ตั้งค่ากฎการปัดเศษ', path: '/dashboard/settings/rounding-rules', icon: 'ShieldCheck', sortOrder: 4, mod: 'MOD_CORE' },
        { name: 'จัดการเนื้อหา', path: '/dashboard/cms', icon: 'ShieldCheck', sortOrder: 5, mod: 'MOD_CORE' },
        { name: 'จัดการเมนูเนื้อหา', path: '/dashboard/cms/menus', icon: 'ShieldCheck', sortOrder: 6, mod: 'MOD_CORE' },
      ]
    },
    {
      name: 'สมองกล(AI)', icon: 'Bot', sortOrder: 5, isSystem: false,
      children: [
        { name: 'จัดการ AI Bots', path: '/dashboard/admin/ai-bots', icon: 'BrainCircuit', sortOrder: 1, mod: 'MOD_INT' },  
        { name: 'คลังความรู้', path: '/dashboard/knowledge', icon: 'Book', sortOrder: 2, mod: 'MOD_INT' },
        { name: 'การเชื่อมต่อกับ Social Channels', path: '/dashboard/admin/social-integrations', icon: 'MessageCircle', sortOrder: 3, mod: 'MOD_INT' },
        { name: 'จัดการการเชื่อมต่อ Cloud Storage', path: '/dashboard/settings/cloud', icon: 'Server', sortOrder: 4, mod: 'MOD_INT' },
      ]
    },
    {
      name: 'ธุรกิจร้านค้า', icon: 'Store', sortOrder: 6, isSystem: false,
      children: [
        { name: 'Dashboard ธุรกิจร้านค้า', path: '/dashboard/ecommerce-dashboard', icon: 'Package', sortOrder: 1, mod: 'MOD_COM' },
        { name: 'จัดการสินค้า', path: '/dashboard/products', icon: 'Package', sortOrder: 2, mod: 'MOD_COM' },
        { name: 'จัดการแท็กภาพ', path: '/dashboard/products/image-tags', icon: 'Image', sortOrder: 3, mod: 'MOD_COM' },
        { name: 'จัดการสนทนา', path: '/dashboard/chat', icon: 'chat', sortOrder: 4, mod: 'MOD_COM' },
        { name: 'จัดการแหล่งจัดหา', path: '/dashboard/procurement', icon: 'ShoppingBag', sortOrder: 5, mod: 'MOD_COM' },
        { name: 'จัดการตลาด', path: '/dashboard/marketing', icon: 'Megaphone', sortOrder: 6, mod: 'MOD_COM' },
       
      ]
    },
    {
      name: 'ระบบจัดการลูกค้าสัมพันธ์', icon: 'UserCog', sortOrder: 7, isSystem: false,
      children: [
        { name: 'สมาชิก', path: '/dashboard/admin/crm/members', icon: 'User', sortOrder: 1, mod: 'MOD_CRM' }, // แอบแก้เป็น MOD_CRM ให้ตรงกับกลุ่มนะครับ
        { name: 'ระบบของรางวัล', path: '/dashboard/crm/rewards', icon: 'Trophy', sortOrder: 2, mod: 'MOD_CRM' },
        { name: 'ระบบแลกเปลี่ยนของรางวัล', path: '/dashboard/crm/redemptions', icon: 'Gift', sortOrder: 3, mod: 'MOD_CRM' },
      ]
    },
    {
      name: 'โครงสร้างพนักงาน', icon: 'LayoutDashboard', sortOrder: 8, isSystem: false,
      children: [
        { name: 'Dashboard ทรัพยากรบุคคล', path: '/dashboard/hr-dashboard', icon: 'Layers', sortOrder: 0, mod: 'MOD_HR' },
        { name: 'แผนก (Department)', path: '/dashboard/admin/departments', icon: 'Building2', sortOrder: 1, mod: 'MOD_HR' },
        { name: 'ตำแหน่ง (Position)', path: '/dashboard/admin/positions', icon: 'Star', sortOrder: 2, mod: 'MOD_HR' },
        { name: 'บริหารงานบุคคล', path: '/dashboard/admin/hr', icon: 'Users', sortOrder: 3, mod: 'MOD_HR' },
        { name: 'จัดการโครงสร้างในองค์กร', path: '/dashboard/admin/org-structure', icon: 'Users', sortOrder: 4, mod: 'MOD_HR' },
        { name: 'สรุปอัตรากำลังพล', path: '/dashboard/admin/manpower', icon: 'Layers', sortOrder: 5, mod: 'MOD_HR' },
        { name: 'จัดการหัวหน้าแผนก', path: '/dashboard/admin/department-managers', icon: 'Layers', sortOrder: 6, mod: 'MOD_HR' },
        { name: 'จัดการเลขที่ตำแหน่ง', path: '/dashboard/admin/position-seats', icon: 'Layers', sortOrder: 7, mod: 'MOD_HR' },
        { name: 'เครื่องราช', path: '/dashboard/hr/royal-decorations', icon: 'Users', sortOrder: 8, mod: 'MOD_HR' },
        { name: 'สวัสดิการพนักงาน', path: '/dashboard/hr/welfare', icon: 'Users', sortOrder: 9, mod: 'MOD_HR' },
      ]
    },
    {
      name: 'ระบบจัดการเวลา', icon: 'LayoutDashboard', sortOrder: 9, isSystem: false,
      children: [
        { name: 'รอบปฏิทิน', path: '/dashboard/admin/holiday-calendar', icon: 'Layers', sortOrder: 0, mod: 'MOD_TIME' },
        { name: 'จัดการวันหยุด', path: '/dashboard/admin/holiday-management', icon: 'Bell', sortOrder: 1, mod: 'MOD_TIME' },
        { name: 'การพัก (Break)', path: '/dashboard/admin/time-breaks', icon: 'BookOpen', sortOrder: 2, mod: 'MOD_TIME' },
        { name: 'กะทำงาน (Shift)', path: '/dashboard/admin/shifts', icon: 'Megaphone', sortOrder: 3, mod: 'MOD_TIME' },
        { name: 'รูปวันทำงาน (Work-pattern)', path: '/dashboard/admin/work-patterns', icon: 'Settings', sortOrder: 4, mod: 'MOD_TIME' },
        { name: 'ตารางกะ (Roster)', path: '/dashboard/admin/rosters', icon: 'Grid3x3', sortOrder: 5, mod: 'MOD_TIME' },
      ]
    },
     {
      name: 'ระบบ Workflow', icon: 'LayoutDashboard', sortOrder: 10, isSystem: false,
      children: [
        { name: 'Dashboard workflow', path: '/dashboard/workflow-dashboard', icon: 'FileText', sortOrder: 0, mod: 'MOD_CORE' },
        { name: 'จัดการ workflow', path: '/dashboard/settings/workflow', icon: 'LayShieldCheckers', sortOrder: 1, mod: 'MOD_CORE' },
        { name: 'จับคู่ workflow', path: '/dashboard/settings/wf-mappings', icon: 'Package', sortOrder: 2, mod: 'MOD_CORE' },
        { name: 'จำลอง workflow', path: '/dashboard/settings/wf-simulation', icon: 'FileText', sortOrder: 3, mod: 'MOD_CORE' },
        { name: 'ตั้งค่าการโอนสิทธิ์', path: '/dashboard/settings/delegation', icon: 'FileText', sortOrder: 4, mod: 'MOD_CORE' },
        
        
      ]
    },
    {
      name: 'ระบบการลา', icon: 'Store', sortOrder: 11, isSystem: false,
      children: [
        { name: 'จัดการประเภทการลา', path: '/dashboard/leave/types', icon: 'LayShieldCheckers', sortOrder: 1, mod: 'MOD_LEAVE' },
        { name: 'แจกสิทธิ์การลา', path: '/dashboard/leave/grant', icon: 'LayShieldCheckers', sortOrder: 2, mod: 'MOD_LEAVE' },
        { name: 'การโอนสิทธิ์การลา', path: '/dashboard/leave/carry-over', icon: 'LayShieldCheckers', sortOrder: 3, mod: 'MOD_LEAVE' },
        { name: 'การปรับสิทธิ์การลา', path: '/dashboard/leave/adjustment', icon: 'LayShieldCheckers', sortOrder: 4, mod: 'MOD_LEAVE' },
        { name: 'ตรวจสอบสิทธิ์', path: '/dashboard/leave/balance', icon: 'FileText', sortOrder: 5, mod: 'MOD_LEAVE' },
        
      ]
    },
    {
      name: 'ประเมินผล', icon: 'LayoutDashboard', sortOrder: 12, isSystem: false,
      children: [
        { name: 'จัดการประเมินผล', path: '/dashboard/performance', icon: 'Users', sortOrder: 0, mod: 'MOD_HR' },
        { name: 'ผลการประเมินรายบุคคล', path: '/dashboard/performance/personal-results', icon: 'Users', sortOrder: 1, mod: 'MOD_HR' },
        { name: 'ผลการประเมินองค์กร', path: '/dashboard/performance/org-results', icon: 'Users', sortOrder: 2, mod: 'MOD_HR' },
        
      ]
    },
    {
      name: 'บันทึกบทลงโทษ', icon: 'LayoutDashboard', sortOrder: 13, isSystem: false,
      children: [
        { name: 'ภาพรวมบทลงโทษ', path: '/dashboard/hr/disciplinary/dashboard', icon: 'Users', sortOrder: 1, mod: 'MOD_HR' },
        { name: 'จัดการบทลงโทษ', path: '/dashboard/hr/disciplinary', icon: 'Users', sortOrder: 2, mod: 'MOD_HR' },
        { name: 'จัดการข้อร้องเรียน', path: '/dashboard/hr/grievance', icon: 'Users', sortOrder: 3, mod: 'MOD_HR' },
        
      ]
    },

    {
      name: 'การฝึกอบรม', icon: 'LayoutDashboard', sortOrder: 13, isSystem: false,
      children: [
        { name: 'ภาพรวมบทลงโทษ', path: '/dashboard/hr/executive-dashboard', icon: 'Users', sortOrder: 1, mod: 'MOD_HR' },
        { name: 'จัดการบทลงโทษ', path: '/dashboard/hr/training', icon: 'Users', sortOrder: 2, mod: 'MOD_HR' },
        { name: 'จองห้องฝึกอบรม', path: '/dashboard/admin/booking', icon: 'Users', sortOrder: 3, mod: 'MOD_HR' }, 
        
      ]
    },

     {
      name: 'ระบบจัดการเอกสารภายใน', icon: 'LayoutDashboard', sortOrder: 14, isSystem: false,
      children: [
        { name: 'เอกสารภายใน', path: '/dashboard/dms', icon: 'Database', sortOrder: 0, mod: 'MOD_DOC' },
               
      ]
    },



    // --- เมนูแบบ Flat (ไม่มีลูก) เอาไว้ด้านนอก ---
   // { name: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', sortOrder: 13, mod: 'MOD_CORE', isSystem: true, children: [] },
    
  ];

  const createdMenus: any[] = [];

  for (const group of menuGroups) {
    let currentParentId: number | null = null;

    // 🌟 1. ถ้ากลุ่มนี้มีเมนูลูก (แปลว่าเป็น Group Folder)
    if (group.children && group.children.length > 0) {
      // สร้างตัวแม่ก่อน (ไม่ต้องใส่ path และ moduleId)
      const parentMenu = await prisma.secMenu.create({
        data: {
          name: group.name,
          icon: group.icon,
          sortOrder: group.sortOrder,
          isVisible: true,
          isSystem: group.isSystem // ตั้งเป็น false ตามที่คุณกฤษฎาต้องการ
        }
      });
      createdMenus.push(parentMenu);
      currentParentId = parentMenu.id; // เก็บ ID ของแม่ไว้ให้ลูก

      // 🌟 2. วนลูปสร้างตัวลูก แล้วจับผูกกับ ID ของตัวแม่
      for (const child of group.children) {
        const modId = moduleMap[child.mod]?.id;
        const childMenu = await prisma.secMenu.create({
          data: {
            name: child.name,
            path: child.path,
            icon: child.icon,
            sortOrder: child.sortOrder,
            moduleId: modId,
            parentId: currentParentId, // ผูกกับตัวแม่ตรงนี้!
            isVisible: true,
            isSystem: true // เมนูย่อยที่เป็นระบบ ให้ลบไม่ได้
          }
        });
        createdMenus.push(childMenu);
      }
    } 

  }
  
  console.log(`✅ Created ${createdMenus.length} hierarchical menus.`);
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
  
  // 🌟 แก้ไข: กรองเอาเฉพาะ Permission ID ที่ไม่ซ้ำกันด้วย Set
  const uniquePermissionIds = [...new Set(createdPermissions.map(p => p.id))];

  await prisma.secRolePermission.createMany({
    data: uniquePermissionIds.map(permId => ({
      roleId: roleAdmin.id,
      permissionId: permId
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

async function seedAiModelConfigs(prisma: any) {
  console.log('🤖 Seeding AI Model Configs...');
  
  const aiModels = [
    // ------------------------------------
    // 🟢 GOOGLE GEMINI 3.x & LATEST (รุ่นใหม่ล่าสุด พ.ค. 2026)
    // ------------------------------------
    { provider: 'GOOGLE', modelCode: 'models/gemini-3.1-pro-preview', modelName: 'Gemini 3.1 Pro Preview (ฉลาดที่สุด รองรับการคิดวิเคราะห์ Agentic Workflow)', creditPer1kTokens: 2.5, isVisionSupported: true, maxContextTokens: 1048576 },
    { provider: 'GOOGLE', modelCode: 'models/gemini-3.5-flash', modelName: 'Gemini 3.5 Flash (รุ่นใหม่ล่าสุด สมดุลความเร็วและความฉลาด ประสิทธิภาพเทียบเท่า Pro)', creditPer1kTokens: 1.5, isVisionSupported: true, maxContextTokens: 1048576 },
    { provider: 'GOOGLE', modelCode: 'models/gemini-3-flash-preview', modelName: 'Gemini 3 Flash Preview (สำหรับการทดสอบโมเดลก่อนขึ้น Stable)', creditPer1kTokens: 1.0, isVisionSupported: true, maxContextTokens: 1048576 },
    { provider: 'GOOGLE', modelCode: 'models/gemini-3.1-flash-lite', modelName: 'Gemini 3.1 Flash-Lite (รุ่นทำงานหนัก ราคาประหยัดและเร็วที่สุด)', creditPer1kTokens: 0.5, isVisionSupported: true, maxContextTokens: 1048576 },
    { provider: 'GOOGLE', modelCode: 'models/gemini-flash-latest', modelName: 'Gemini Flash Latest (อัปเดตอัตโนมัติเป็นรุ่นล่าสุด ทำงานไว)', creditPer1kTokens: 1.0, isVisionSupported: true, maxContextTokens: 1048576 },
    { provider: 'GOOGLE', modelCode: 'models/deep-research-pro-preview-12-2025', modelName: 'Deep Research Pro (สำหรับการค้นคว้าเชิงลึก)', creditPer1kTokens: 5.0, isVisionSupported: true, maxContextTokens: 131072 },

    // ------------------------------------
    // 🟢 GOOGLE GEMINI 2.x (รุ่นเสถียร)
    // ------------------------------------
    { provider: 'GOOGLE', modelCode: 'models/gemini-2.5-pro', modelName: 'Gemini 2.5 Pro (รุ่นโปร เสถียรและแม่นยำสูง)', creditPer1kTokens: 2.0, isVisionSupported: true, maxContextTokens: 1048576 },
    { provider: 'GOOGLE', modelCode: 'models/gemini-2.5-flash', modelName: 'Gemini 2.5 Flash (รุ่นแฟลช ทำงานไว ราคาประหยัด)', creditPer1kTokens: 1.0, isVisionSupported: true, maxContextTokens: 1048576 },
    { provider: 'GOOGLE', modelCode: 'models/gemini-2.0-flash', modelName: 'Gemini 2.0 Flash (รุ่นยอดนิยม)', creditPer1kTokens: 1.0, isVisionSupported: true, maxContextTokens: 1048576 },

    // ------------------------------------
    // 🟢 GOOGLE GEMINI 1.x (ระบบเฉพาะทางที่ต้องการใช้งาน)
    // ------------------------------------
    { provider: 'GOOGLE', modelCode: 'models/gemini-1.5-pro', modelName: 'Gemini 1.5 Pro (โมเดลที่มีความแม่นยำสูงสำหรับการทำ Tagging เอกสาร)', creditPer1kTokens: 2.0, isVisionSupported: true, maxContextTokens: 2097152 },

    // ------------------------------------
    // 🟢 GOOGLE MULTIMEDIA (สร้างภาพ/วิดีโอ/เสียง)
    // ------------------------------------
    { provider: 'GOOGLE', modelCode: 'models/gemini-3.1-flash-image', modelName: 'Gemini 3.1 Flash Image (สร้างและตัดต่อรูปภาพคุณภาพสูงระดับ Production)', creditPer1kTokens: 5.0, isVisionSupported: true, maxContextTokens: 480 },
    { provider: 'GOOGLE', modelCode: 'models/nano-banana-2', modelName: 'Nano Banana 2 (สร้างรูปภาพความเร็วสูง สำหรับงานจำนวนมาก)', creditPer1kTokens: 2.0, isVisionSupported: true, maxContextTokens: 480 },
    { provider: 'GOOGLE', modelCode: 'models/veo-3.1-generate-001', modelName: 'Veo 3.1 (สร้างวิดีโอสุดล้ำพร้อมเสียงแบบเนทีฟ)', creditPer1kTokens: 10.0, isVisionSupported: true, maxContextTokens: 480 },
    { provider: 'GOOGLE', modelCode: 'models/gemini-3.1-flash-live', modelName: 'Gemini 3.1 Flash Live (พูดคุยโต้ตอบด้วยเสียงแบบเรียลไทม์)', creditPer1kTokens: 2.0, isVisionSupported: false, maxContextTokens: 131072 },
    { provider: 'GOOGLE', modelCode: 'models/gemini-3.1-flash-tts', modelName: 'Gemini 3.1 Flash TTS (สร้างเสียงพูดคุณภาพสูง ควบคุมจังหวะได้)', creditPer1kTokens: 1.0, isVisionSupported: false, maxContextTokens: 131072 },

    // ------------------------------------
    // 🟢 GOOGLE GEMMA (Open Weights)
    // ------------------------------------
    { provider: 'GOOGLE', modelCode: 'models/gemma-3', modelName: 'Gemma 3 (โมเดล Open Weights รองรับข้อมูลหลายรูปแบบ)', creditPer1kTokens: 1.0, isVisionSupported: true, maxContextTokens: 131072 },
    { provider: 'GOOGLE', modelCode: 'models/gemma-3-27b-it', modelName: 'Gemma 3 27B (โมเดลตัวท็อป ปรับแต่งคำสั่งแล้ว)', creditPer1kTokens: 1.0, isVisionSupported: false, maxContextTokens: 131072 },

    // ------------------------------------
    // 🔵 OPENAI MODELS & OTHERS (สำรองไว้ใช้ในอนาคต)
    // ------------------------------------
    { provider: 'OPENAI', modelCode: 'gpt-4o', modelName: 'GPT-4o (โมเดลตัวท็อป ฉลาดที่สุด รองรับรูปภาพ)', creditPer1kTokens: 5.0, isVisionSupported: true, maxContextTokens: 128000 },
    { provider: 'OPENAI', modelCode: 'gpt-4o-mini', modelName: 'GPT-4o Mini (ทำงานไว ราคาประหยัด)', creditPer1kTokens: 1.0, isVisionSupported: true, maxContextTokens: 128000 },
    
    // --- 🖼️ กลุ่มโมเดลจัดการรูปภาพ (Image / Background Removal) ---
    { provider: 'SELF_HOSTED', modelCode: 'isnet-general', modelName: 'KKV AI Bg-Removal (ลบพื้นหลังฟรี ไม่จำกัด)', creditPer1kTokens: 0.1, isVisionSupported: true, maxContextTokens: 0 },
    { provider: 'PHOTOROOM', modelCode: 'photoroom-bg-removal', modelName: 'Photoroom API (ลบพื้นหลังระดับโปร เนียนกริ๊บ พร้อมเงา)', creditPer1kTokens: 10.0, isVisionSupported: true, maxContextTokens: 0 }
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
}


// =========================================================
// 👑 ฟังก์ชันสร้าง MASTER DATA: ระดับของสมาชิก (MEMBER_LEVEL)
// =========================================================
async function seedMemberLevels(prisma: any) {
  console.log('👑 Seeding Member Levels...');

  // 1. สร้าง/อัปเดต Master Group
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

  // 2. ข้อมูลระดับสมาชิก (พร้อมกำหนดสีสำหรับ Badge หน้าบ้าน)
  const memberLevelData = [
    { code: 'NORMAL', name: 'สมาชิกทั่วไป (Normal)', colorCode: '#9CA3AF', sortOrder: 1 }, // สีเทา
    { code: 'VIP', name: 'สมาชิกวีไอพี (VIP)', colorCode: '#F59E0B', sortOrder: 2 },       // สีทอง/ส้ม
    { code: 'VVIP', name: 'สมาชิกซูเปอร์วีไอพี (VVIP)', colorCode: '#8B5CF6', sortOrder: 3 }, // สีม่วง
  ];

  // 3. วนลูปบันทึก Master Data
  for (const v of memberLevelData) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { 
        masterGroupId: memberLevelGroup.id, 
        code: v.code, 
        companyId: null // ระดับสมาชิกระบบกลาง
      },
    });

    if (existing) {
      // อัปเดตข้อมูลกรณีที่มีอยู่แล้ว
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { 
          name: v.name, 
          sortOrder: v.sortOrder,
          colorCode: v.colorCode
        },
      });
    } else {
      // สร้างใหม่
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: memberLevelGroup.id,
          code: v.code,
          name: v.name,
          colorCode: v.colorCode,
          sortOrder: v.sortOrder,
          companyId: null,
          isActive: true,
          labels: {}
        },
      });
    }
  }
  console.log(`✅ Seeded ${memberLevelData.length} Member Levels!`);
}
  

  // =========================================================
// 🌐 ฟังก์ชันสร้าง SOCIAL LOGIN PROVIDERS (sysAuthProvider)
// =========================================================
async function seedSocialLoginProviders(prisma: any) {
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
  console.log(`✅ Social Login Providers seeded! (${providers.length} providers)`);
}

  // =========================================================
// 👁️ ฟังก์ชันสร้าง MASTER DATA: การมองเห็นสินค้า (PRODUCT_VISIBILITY)
// =========================================================
async function seedProductVisibility(prisma: any) {
  console.log('👁️ Seeding Product Visibility...');

  // 1. สร้าง/อัปเดต Master Group
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

  // 2. ข้อมูลระดับการมองเห็น (พร้อมกำหนดสีสำหรับ Badge หน้าบ้าน)
  const visibilityData = [
    { code: 'PUBLIC', name: 'ลูกค้าทั่วไป (Public)', colorCode: '#10B981', sortOrder: 1 },       // สีเขียว
    { code: 'MEMBER_ONLY', name: 'เฉพาะสมาชิก (Member Only)', colorCode: '#3B82F6', sortOrder: 2 }, // สีฟ้า
    { code: 'VIP', name: 'เฉพาะสมาชิก VIP', colorCode: '#F59E0B', sortOrder: 3 },                 // สีทอง/ส้ม
  ];

  // 3. วนลูปบันทึก Master Data
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
        data: { 
          name: v.name, 
          sortOrder: v.sortOrder,
          colorCode: v.colorCode
        },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: visibilityGroup.id,
          code: v.code,
          name: v.name,
          colorCode: v.colorCode,
          sortOrder: v.sortOrder,
          companyId: null,
          isActive: true,
          labels: {}
        },
      });
    }
  }
  console.log(`✅ Product Visibility Seeded! (${visibilityData.length} levels)`);
}


  // =========================================================
// ⚙️ ฟังก์ชันสร้าง SYSTEM CONFIGS (ค่าระบบทั่วไปส่วนกลาง)
// =========================================================
async function seedSystemConfigs(prisma: any) {
  console.log('⚙️ Seeding System Configs...');

  const systemConfigs = [
    { key: 'APP_NAME', value: 'KKV BusinessOS', description: 'ชื่อแอปพลิเคชัน' },
    { key: 'FRONTEND_ADMIN', value: 'https://kkvservice.com/login', description: 'link login' },
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

  await prisma.$transaction(
    systemConfigs.map((config) =>
      prisma.cfgSystem.upsert({
        where: { key: config.key },
        update: config,
        create: config,
      })
    )
  );
  
  console.log('System configs seeded successfully.');
}

// =========================================================
// 📄 ฟังก์ชันสร้าง FORMAT สำหรับ RUNNING NUMBER (รูปแบบเลขเอกสารส่วนกลาง)
// =========================================================
async function seedRunningFormats(prisma: any) {
  console.log('📄 Seeding Running Number Formats...');

  // 💡 ปรับให้ใช้ String ตรงๆ แทน Enum Object เพื่อลดปัญหาเรื่องการ Import
  const runningFormats = [
    { docCode: 'PO', docName: 'ใบสั่งซื้อ', formatPattern: 'PO-{yyyy}{mm}-', digitLength: 4, resetCriteria: 'MONTHLY' },
    { docCode: 'INV', docName: 'ใบแจ้งหนี้', formatPattern: 'INV{yyyy}-', digitLength: 5, resetCriteria: 'YEARLY' },
    { docCode: 'REC', docName: 'ใบเสร็จรับเงิน', formatPattern: 'REC{yyyy}{mm}{dd}-', digitLength: 3, resetCriteria: 'DAILY' },
    { docCode: 'SO', docName: 'ใบสั่งขาย', formatPattern: 'SO-{yyyy}-', digitLength: 6, resetCriteria: 'YEARLY' },
    { docCode: 'QT', docName: 'ใบเสนอราคา', formatPattern: 'QT{yyyy}{mm}-', digitLength: 4, resetCriteria: 'MONTHLY' },
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
          resetCriteria: format.resetCriteria as any, // กำหนดเป็น any ชั่วคราวเพื่อให้ TypeScript ไม่บ่นเรื่อง Enum
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
          resetCriteria: format.resetCriteria as any,
          isActive: true
        }
      });
    }
  }
  console.log(`✅ Seeded ${runningFormats.length} Running Number Formats!`);
}

  



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
      isSystem: true,
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
      isSystem: true,
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
      isSystem: true,
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
      isSystem: true,
    },
    // 🌟 [NEW] เพิ่มบอทสำหรับคัดแยกไฟล์เอกสาร (DMS Auto-Routing)
    {
      code: 'AUTO_ROUTER_DOC',
      name: 'บอทคัดแยกแฟ้มเอกสารอัจฉริยะ (Auto-Router)',
      description: 'วิเคราะห์ชื่อไฟล์และคำแนะนำจากผู้ใช้ เพื่อจัดหมวดหมู่เอกสารเข้าแฟ้มที่ถูกต้องโดยอัตโนมัติ',
      provider: 'GOOGLE', 
      modelName: 'models/gemini-2.5-flash', 
      temperature: 0.1, // เน้นความแม่นยำสูงสุด ไม่ให้ AI เดาหรือใช้ความคิดสร้างสรรค์
      systemPrompt: `คุณคือ "ผู้เชี่ยวชาญด้านการจัดเก็บบริหารเอกสารระดับองค์กร (Enterprise Document Archivist)"\nหน้าที่ของคุณคือวิเคราะห์ข้อมูลที่ได้รับ เพื่อตัดสินใจเลือก "ตู้เก็บเอกสาร (Folder)" ที่เหมาะสมที่สุดเพียงตู้เดียว\n\nกฎการวิเคราะห์ข้อมูล (Analysis Rules):\n1. ลำดับความสำคัญ: หากมี "คำแนะนำเพิ่มเติมจากผู้ใช้" ส่งมาด้วย ให้ยึดคำแนะนำนั้นเป็นแกนหลักในการตัดสินใจ\n2. การตีความคีย์เวิร์ด:\n   - คำว่า "ใบเสร็จ, ใบกำกับภาษี, Invoice, Receipt, PO, สลิป" มักจะเกี่ยวข้องกับ "บัญชี / การเงิน / จัดซื้อ"\n   - คำว่า "สัญญา, MOU, ข้อตกลง, Contract, Legal" มักจะเกี่ยวข้องกับ "กฎหมาย / นิติการ"\n   - คำว่า "เรซูเม่, ใบสมัคร, สัมภาษณ์, ขาดลามาสาย, Resume" มักจะเกี่ยวข้องกับ "บุคคล / HR"\n3. กฎความปลอดภัยสูงสุด (Fallback): หากพิจารณาแล้วว่าชื่อไฟล์ไม่เกี่ยวข้องกับโฟลเดอร์ใดเลย, ข้อมูลกำกวม, หรือมาเป็นรูปแบบไฟล์รวม (ZIP) ที่คาดเดาเนื้อหาข้างในไม่ได้ "ห้ามเดาเด็ดขาด" ให้เลือกโฟลเดอร์เริ่มต้น (Default/Uncategorized) เสมอ\n\nกฎการออกผลลัพธ์ (Strict Output Format):\nคุณคือบอทที่คุยกับระบบ API ไม่ใช่คุยกับมนุษย์\nดังนั้น จงตอบกลับมาเป็น "ตัวเลข ID" ของโฟลเดอร์ที่เลือก เพียงตัวเลขเดียวเท่านั้น\nห้ามมีคำอธิบาย ห้ามมีจุดมหัพภาค ห้ามมีเครื่องหมายคำพูด หรือข้อความอื่นใดปะปนมาโดยเด็ดขาด!`,
      greetingMessage: 'ระบบคัดแยกเอกสารอัตโนมัติพร้อมทำงานแล้ว (บอทนี้ทำงานเบื้องหลังผ่าน API)',
      canUseTools: false,
      isActive: true,
      isSystem: true,
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

async function seedCurrencies() {
  console.log('Seeding Currencies...');

  // 1. สร้างหัวกลุ่ม CURRENCY
  const currencyGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'CURRENCY' },
    update: {},
    create: {
      groupCode: 'CURRENCY',
      groupName: 'สกุลเงิน',
      description: 'สกุลเงินที่ใช้ในระบบ (เช่น THB, USD)',
      isSystem: true,
      isActive: true,
    },
  });

  // 2. ข้อมูลสกุลเงิน (เพิ่มสกุลเงินอื่นๆ ที่ต้องการได้ที่นี่)
  const currencies = [
    { code: 'THB', name: 'THB - บาท', sortOrder: 1 },
    { code: 'USD', name: 'USD - US Dollar', sortOrder: 2 },
    { code: 'EUR', name: 'EUR - Euro', sortOrder: 3 },
    { code: 'JPY', name: 'JPY - Japanese Yen', sortOrder: 4 },
  ];

  for (const curr of currencies) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: {
        masterGroupId: currencyGroup.id, 
        code: curr.code,
        companyId: null, 
      },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: {
          name: curr.name,
          sortOrder: curr.sortOrder,
        },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: currencyGroup.id,
          code: curr.code,
          name: curr.name,
          sortOrder: curr.sortOrder,
          companyId: null,
          isActive: true,
          labels: {}
        },
      });
    }
  }

  console.log('✅ Currencies Seeded!');
}

async function seedTimezones() {
  console.log('Seeding Timezones...');

  // 1. สร้างหัวกลุ่ม TIMEZONE
  const timezoneGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'TIMEZONE' },
    update: {},
    create: {
      groupCode: 'TIMEZONE',
      groupName: 'เขตเวลา',
      description: 'เขตเวลาสำหรับตั้งค่าร้านค้า (Timezone)',
      isSystem: true,
      isActive: true,
    },
  });

  // 2. ข้อมูลเขตเวลา (ใช้ Timezone ID มาตรฐาน)
  const timezones = [
    { code: 'UTC', name: 'UTC (GMT+0)', sortOrder: 1 },
    { code: 'Asia/Bangkok', name: 'Asia/Bangkok (GMT+7)', sortOrder: 2 },
    { code: 'Asia/Tokyo', name: 'Asia/Tokyo (GMT+9)', sortOrder: 3 },
    { code: 'America/New_York', name: 'America/New_York (GMT-5)', sortOrder: 4 },
  ];

  for (const tz of timezones) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: {
        masterGroupId: timezoneGroup.id, 
        code: tz.code,
        companyId: null, 
      },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: {
          name: tz.name,
          sortOrder: tz.sortOrder,
        },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: timezoneGroup.id,
          code: tz.code,
          name: tz.name,
          sortOrder: tz.sortOrder,
          companyId: null,
          isActive: true,
          labels: {}
        },
      });
    }
  }

  console.log('✅ Timezones Seeded!');
}

async function seedPaymentMethodTypes() {
  console.log('Seeding Payment Method Types...');

  // 1. สร้างหัวกลุ่ม PAYMENT_METHOD_TYPE
  const paymentGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'PAYMENT_METHOD_TYPE' },
    update: {},
    create: {
      groupCode: 'PAYMENT_METHOD_TYPE',
      groupName: 'ประเภทช่องทางชำระเงิน',
      description: 'ประเภทของการรับชำระเงิน (โอนเงิน, บัตรเครดิต, COD, ฯลฯ)',
      isSystem: true,
      isActive: true,
    },
  });

  // 2. ข้อมูลประเภทช่องทางชำระเงิน (อ้างอิงจาก Dropdown ในหน้า UI)
  const paymentTypes = [
    { code: 'BANK_TRANSFER', name: 'โอนเงินผ่านธนาคาร', sortOrder: 1 },
    { code: 'PROMPTPAY', name: 'QR Code (PromptPay)', sortOrder: 2 },
    { code: 'CREDIT_CARD', name: 'บัตรเครดิต', sortOrder: 3 },
    { code: 'COD', name: 'เก็บเงินปลายทาง', sortOrder: 4 },
    { code: 'WALLET', name: 'กระเป๋าเงิน (Wallet)', sortOrder: 5 },
  ];

  for (const pType of paymentTypes) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: {
        masterGroupId: paymentGroup.id, 
        code: pType.code,
        companyId: null, // ข้อมูลกลาง
      },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: {
          name: pType.name,
          sortOrder: pType.sortOrder,
        },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: paymentGroup.id,
          code: pType.code,
          name: pType.name,
          sortOrder: pType.sortOrder,
          companyId: null,
          isActive: true,
          labels: {}
        },
      });
    }
  }

  console.log('✅ Payment Method Types Seeded!');
}

async function seedProductStatuses() {
  console.log('Seeding Product Statuses...');

  const statusGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'PRODUCT_STATUS' },
    update: {},
    create: {
      groupCode: 'PRODUCT_STATUS',
      groupName: 'สถานะสินค้า',
      description: 'สถานะการแสดงผลของสินค้า (เช่น เผยแพร่, แบบร่าง)',
      isSystem: true,
      isActive: true,
    },
  });

  const statuses = [
    { code: 'DRAFT', name: 'แบบร่าง', sortOrder: 1 },
    { code: 'PUBLISHED', name: 'เผยแพร่', sortOrder: 2 },
    { code: 'ARCHIVED', name: 'เก็บถาวร', sortOrder: 3 },
  ];

  for (const status of statuses) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { masterGroupId: statusGroup.id, code: status.code, companyId: null },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { name: status.name, sortOrder: status.sortOrder },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: { masterGroupId: statusGroup.id, code: status.code, name: status.name, sortOrder: status.sortOrder, companyId: null, isActive: true, labels: {} },
      });
    }
  }
  console.log('✅ Product Statuses Seeded!');
}

async function seedProductSalesTypes() {
  console.log('Seeding Product Sales Types...');

  const salesTypeGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'PRODUCT_SALES_TYPE' },
    update: {},
    create: {
      groupCode: 'PRODUCT_SALES_TYPE',
      groupName: 'ประเภทการขายสินค้า',
      description: 'รูปแบบการขาย (ขายปลีก, ขายส่ง, หรือทั้งสองอย่าง)',
      isSystem: true,
      isActive: true,
    },
  });

  const salesTypes = [
    { code: 'RETAIL', name: 'ขายปลีก', sortOrder: 1 },
    { code: 'WHOLESALE', name: 'ขายส่ง', sortOrder: 2 },
    { code: 'BOTH', name: 'ปลีก+ส่ง', sortOrder: 3 },
  ];

  for (const st of salesTypes) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { masterGroupId: salesTypeGroup.id, code: st.code, companyId: null },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { name: st.name, sortOrder: st.sortOrder },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: { masterGroupId: salesTypeGroup.id, code: st.code, name: st.name, sortOrder: st.sortOrder, companyId: null, isActive: true, labels: {} },
      });
    }
  }
  console.log('✅ Product Sales Types Seeded!');
}

async function seedEmploymentStatuses() {
  console.log('Seeding Employment Statuses...');

  // 1. สร้างกลุ่ม Master Group สำหรับสถานะการจ้างงาน
  const statusGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'EMPLOYMENT_STATUS' },
    update: {},
    create: {
      groupCode: 'EMPLOYMENT_STATUS',
      groupName: 'สถานะการจ้างงาน (Employment Status)',
      description: 'สถานะการทำงานปัจจุบันของพนักงานในบริษัท',
      isSystem: true, // ล็อกไว้ไม่ให้ User ลบ เพราะผูกกับ Enum ในระบบ
      isActive: true,
    },
  });

  // 2. รายการสถานะตาม Enum ใน schema.prisma พร้อมกำหนดสี
  const employmentStatuses = [
    { code: 'PROBATION', name: 'ทดลองงาน', colorCode: '#F59E0B', sortOrder: 1 },     // สีส้ม/เหลือง
    { code: 'CONFIRMED', name: 'บรรจุแล้ว', colorCode: '#10B981', sortOrder: 2 },       // สีเขียว
    { code: 'NOTICE_PERIOD', name: 'แจ้งลาออกล่วงหน้า', colorCode: '#F97316', sortOrder: 3 }, // สีส้มเข้ม
    { code: 'RESIGNED', name: 'ลาออก', colorCode: '#6B7280', sortOrder: 4 },          // สีเทา
    { code: 'TERMINATED', name: 'เลิกจ้าง', colorCode: '#EF4444', sortOrder: 5 },       // สีแดง
  ];

  // 3. วนลูปบันทึกข้อมูล
  for (const status of employmentStatuses) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { 
        masterGroupId: statusGroup.id, 
        code: status.code, 
        companyId: null // เป็นข้อมูลกลางของระบบ
      },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { 
          name: status.name, 
          sortOrder: status.sortOrder,
          colorCode: status.colorCode
        },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: { 
          masterGroupId: statusGroup.id, 
          code: status.code, 
          name: status.name, 
          colorCode: status.colorCode,
          sortOrder: status.sortOrder, 
          companyId: null, 
          isActive: true, 
          labels: {} 
        },
      });
    }
  }
  
  console.log('✅ Employment Statuses Seeded!');
}

async function seedProductTypes() {
  console.log('Seeding Product Types...');

  const productTypeGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'PRODUCT_TYPE' },
    update: {},
    create: {
      groupCode: 'PRODUCT_TYPE',
      groupName: 'ประเภทสินค้า (Physical/Digital)',
      description: 'ประเภทของตัวสินค้า เช่น สินค้าที่มีอยู่จริง หรือ สินค้าดิจิทัล',
      isSystem: true,
      isActive: true,
    },
  });

  const productTypes = [
    { code: 'PHYSICAL', name: 'สินค้าจริง (Physical)', sortOrder: 1 },
    { code: 'DIGITAL', name: 'สินค้าดิจิทัล (Digital)', sortOrder: 2 },
  ];

  for (const pt of productTypes) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { masterGroupId: productTypeGroup.id, code: pt.code, companyId: null },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { name: pt.name, sortOrder: pt.sortOrder },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: { masterGroupId: productTypeGroup.id, code: pt.code, name: pt.name, sortOrder: pt.sortOrder, companyId: null, isActive: true, labels: {} },
      });
    }
  }
  console.log('✅ Product Types Seeded!');
}

async function seedSystemEnums() {
  console.log('Seeding System Enums (ResetCriteria, WorkflowStatus, VoteRule, WorkflowNodeType , JobHistoryStatus )...');

  // =========================================================
  // 1. กำหนดข้อมูล Master Groups
  // =========================================================
  const enumGroups = [
    {
      code: 'RESET_CRITERIA',
      name: 'เงื่อนไขการรีเซ็ตเลขเอกสาร',
      description: 'รอบการรีเซ็ต Running Number (ResetCriteria)',
    },
    {
      code: 'WORKFLOW_STATUS',
      name: 'สถานะกระบวนการ',
      description: 'สถานะของรายการคำขอในระบบ (WorkflowStatus)',
    },
    {
      code: 'VOTE_RULE',
      name: 'เงื่อนไขการอนุมัติ',
      description: 'กฎการตัดสินใจในแต่ละขั้นตอน (VoteRule)',
    },
     {
      code: 'WORKFLOW_NODETYPE',
      name: 'ประเภท Node ระบบ',
      description: 'คุณลักษณะ Node ในระบบ',
    },
     {
      code: 'JOBHISTORY_STATUS',
      name: 'สถานะประวัติพนักงาน',
      description: 'สถานะของปรวัติพนักงาน',
    }
  ];

  // สร้าง Master Groups ลง Database
  const groupMap = new Map();
  for (const group of enumGroups) {
    const createdGroup = await prisma.cfgMasterGroup.upsert({
      where: { groupCode: group.code },
      update: {},
      create: {
        groupCode: group.code,
        groupName: group.name,
        description: group.description,
        isSystem: true, // ล็อกไว้ไม่ให้ User ลบ
        isActive: true,
      },
    });
    groupMap.set(group.code, createdGroup.id);
  }

  // =========================================================
  // 2. กำหนดข้อมูล Master Data (ตัวเลือกย่อย)
  // =========================================================
  const enumData = [
    // --- 📌 ResetCriteria ---
    { groupId: groupMap.get('RESET_CRITERIA'), code: 'DAILY', name: 'รายวัน', colorCode: '#3B82F6', sortOrder: 1 }, // สีฟ้า
    { groupId: groupMap.get('RESET_CRITERIA'), code: 'MONTHLY', name: 'รายเดือน', colorCode: '#10B981', sortOrder: 2 }, // สีเขียว
    { groupId: groupMap.get('RESET_CRITERIA'), code: 'YEARLY', name: 'รายปี', colorCode: '#8B5CF6', sortOrder: 3 }, // สีม่วง
    { groupId: groupMap.get('RESET_CRITERIA'), code: 'NEVER', name: 'รันต่อเนื่อง (ไม่รีเซ็ต)', colorCode: '#6B7280', sortOrder: 4 }, // สีเทา

    // --- 📌 WorkflowStatus ---
    { groupId: groupMap.get('WORKFLOW_STATUS'), code: 'PENDING', name: 'รอเข้าคิว / รอดำเนินการ', colorCode: '#F59E0B', sortOrder: 1 }, // สีส้ม/เหลือง
    { groupId: groupMap.get('WORKFLOW_STATUS'), code: 'IN_PROGRESS', name: 'กำลังประมวลผล', colorCode: '#3B82F6', sortOrder: 2 }, // สีฟ้า
    { groupId: groupMap.get('WORKFLOW_STATUS'), code: 'APPROVED', name: 'เสร็จสมบูรณ์ / อนุมัติ', colorCode: '#10B981', sortOrder: 3 }, // สีเขียว
    { groupId: groupMap.get('WORKFLOW_STATUS'), code: 'REJECTED', name: 'ล้มเหลว / ไม่อนุมัติ', colorCode: '#EF4444', sortOrder: 4 }, // สีแดง
    { groupId: groupMap.get('WORKFLOW_STATUS'), code: 'CANCELLED', name: 'ยกเลิกโดยผู้ใช้', colorCode: '#9CA3AF', sortOrder: 5 }, // สีเทาอ่อน

    // --- 📌 VoteRule ---
    { groupId: groupMap.get('VOTE_RULE'), code: 'ANY_APPROVE', name: 'ใครก็ได้อนุมัติ 1 คน = ผ่าน', colorCode: '#06B6D4', sortOrder: 1 }, // สีฟ้าอมเขียว
    { groupId: groupMap.get('VOTE_RULE'), code: 'ALL_MUST_APPROVE', name: 'ต้องอนุมัติทุกคน = ผ่าน', colorCode: '#4F46E5', sortOrder: 2 }, // สีคราม (Indigo)


    // --- 📌 wf_nodeType ---
    { groupId: groupMap.get('WORKFLOW_NODETYPE'), code: 'APPROVAL', name: 'ต้องมีคนกดอนุมัติ (ค่า Default)', colorCode: '#06B6D4', sortOrder: 1 }, // สีฟ้าอมเขียว
    { groupId: groupMap.get('WORKFLOW_NODETYPE'), code: 'FYI', name: 'แค่ส่งแจ้งเตือน (CC) ไม่ต้องกดอนุมัติ ระบบจะวิ่งผ่านไปโหนดต่อไปเลย', colorCode: '#4F46E5', sortOrder: 2 }, // สีคราม (Indigo)
    { groupId: groupMap.get('WORKFLOW_NODETYPE'), code: 'CONDITION', name: 'โหนดทางแยก (เช่น ถ้ายอด > 10,000 ไปโหนด A, ถ้าน้อยกว่า ไปโหนด B)', colorCode: '#06B6D4', sortOrder: 3 }, // สีฟ้าอมเขียว
    { groupId: groupMap.get('WORKFLOW_NODETYPE'), code: 'PARALLEL_SPLIT', name: 'โหนดแยกสาย (แจกงานไป 2 แผนกพร้อมกัน)', colorCode: '#9f11ae', sortOrder: 4 }, // สีคราม (Indigo)
    { groupId: groupMap.get('WORKFLOW_NODETYPE'), code: 'PARALLEL_JOIN', name: 'โหนดมัดรวม (รอด่านย่อยเสร็จครบ ถึงจะไปต่อ)', colorCode: '#c6dd5f', sortOrder: 4 }, // สีคราม (Indigo)


    // --- 📌 job History status ---
    { groupId: groupMap.get('JOBHISTORY_STATUS'), code: 'PENDING', name: 'สำหรับวางแผนล่วงหน้า (Draft Movement)', colorCode: '#06B6D4', sortOrder: 1 }, // สีฟ้าอมเขียว
    { groupId: groupMap.get('JOBHISTORY_STATUS'), code: 'EFFECTIVE', name: 'มีผลใช้งานจริงแล้ว', colorCode: '#4F46E5', sortOrder: 2 }, // สีคราม (Indigo)
    { groupId: groupMap.get('JOBHISTORY_STATUS'), code: 'EXPIRED', name: 'เป็นประวัติในอดีต (มีคนใหม่มาแทนหรือย้ายออกแล้ว)', colorCode: '#27b097', sortOrder: 3 }, // สีคราม (Indigo)

  ];

  // =========================================================
  // 3. บันทึกข้อมูลลงฐานข้อมูล
  // =========================================================
  for (const item of enumData) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { 
        masterGroupId: item.groupId, 
        code: item.code, 
        companyId: null // เป็นข้อมูลกลางของระบบ
      },
    });

    if (existing) {
      // อัปเดตข้อมูลกรณีที่มีอยู่แล้ว (เผื่อคุณกฤษฎาอยากแก้สีทีหลัง)
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { 
          name: item.name, 
          sortOrder: item.sortOrder,
          colorCode: item.colorCode
        },
      });
    } else {
      // สร้างใหม่
      await prisma.cfgMasterData.create({
        data: { 
          masterGroupId: item.groupId, 
          code: item.code, 
          name: item.name, 
          colorCode: item.colorCode,
          sortOrder: item.sortOrder, 
          companyId: null, 
          isActive: true, 
          labels: {} 
        },
      });
    }
  }
  
  console.log('✅ System Enums Seeded!');
}

async function seedRemainingEnums() {
  console.log('Seeding Remaining System Enums...');

  // =========================================================
  // 1. กำหนดข้อมูล Master Groups ทั้งหมด
  // =========================================================
  const enumGroups = [
    { code: 'KNOWLEDGE_SOURCE_TYPE', name: 'แหล่งที่มาของข้อมูล AI', description: 'แหล่งที่มาของ Knowledge Base' },
    { code: 'IMAGE_SOURCE', name: 'แหล่งเก็บรูปภาพ', description: 'แหล่งที่เก็บรูปภาพสินค้า' },
    { code: 'IMAGE_GENERATION_TYPE', name: 'ประเภทการประมวลผลรูปภาพ', description: 'ประวัติการทำรูปภาพด้วย AI' },
    { code: 'MEDIA_TYPE', name: 'ประเภทสื่อ', description: 'รูปภาพหรือวิดีโอ' },
    { code: 'AI_PROCESS_STATUS', name: 'สถานะการทำงาน AI', description: 'สถานะคิวงานประมวลผล AI' },
    { code: 'SHIPPING_CALC_TYPE', name: 'ประเภทการคิดค่าส่ง', description: 'รูปแบบการคำนวณค่าจัดส่ง' },
    { code: 'RMA_TYPE', name: 'ประเภทการเคลมสินค้า', description: 'รูปแบบการขอคืน/เคลม' },
    { code: 'RMA_STATUS', name: 'สถานะการเคลมสินค้า', description: 'ขั้นตอนการเคลม (RMA)' },
    { code: 'STOCK_CHANGE_TYPE', name: 'สาเหตุการปรับสต็อก', description: 'เหตุผลการเข้าออกของสินค้า' },
    { code: 'NOTIFICATION_TYPE', name: 'ประเภทการแจ้งเตือน', description: 'หมวดหมู่ข้อความแจ้งเตือน' },
    { code: 'AUTH_PROVIDER_TYPE', name: 'ช่องทางการล็อกอิน', description: 'ผู้ให้บริการ SSO' },
    { code: 'DAY_RELATIVE', name: 'ความสัมพันธ์ของวัน', description: 'วันก่อนหน้า, วันปัจจุบัน, วันถัดไป' },
    { code: 'SHIFT_TYPE', name: 'ประเภทกะการทำงาน', description: 'วันทำงาน หรือ วันหยุด' },
    { code: 'GENDER_RULE', name: 'เงื่อนไขเพศ', description: 'เพศที่อนุญาต (เช่น ลาคลอด)' },
    { code: 'ACCRUAL_TYPE', name: 'รูปแบบการแจกวันลา', description: 'แจกต้นปี หรือ ทยอยแจก' },
    { code: 'ROUNDING_RULE', name: 'กฎการปัดเศษ', description: 'วิธีการปัดเศษ' },
    { code: 'ROUNDING_TYPE', name: 'ประเภทการปัดเศษ', description: 'ปัดจากค่าทั้งหมด หรือ ทศนิยม' },
    { code: 'ADJUSTMENT_TYPE', name: 'ประเภทการปรับปรุงวันลา', description: 'เพิ่ม, ลด, หรือ แทนที่' },
    { code: 'LEAVE_DURATION_RULE', name: 'ความละเอียดการลา', description: 'เต็มวัน, ครึ่งวัน, รายชั่วโมง' },
    { code: 'LEAVE_REQUEST_STATUS', name: 'สถานะใบลา', description: 'สถานะการขออนุมัติวันลา' },

    
  ];

  const groupMap = new Map();
  for (const group of enumGroups) {
    const createdGroup = await prisma.cfgMasterGroup.upsert({
      where: { groupCode: group.code },
      update: {},
      create: {
        groupCode: group.code,
        groupName: group.name,
        description: group.description,
        isSystem: true,
        isActive: true,
      },
    });
    groupMap.set(group.code, createdGroup.id);
  }

  // =========================================================
  // 2. กำหนดข้อมูล Master Data (ตัวเลือกย่อย)
  // =========================================================
  const enumData = [
    // --- KnowledgeSourceType ---
    { groupId: groupMap.get('KNOWLEDGE_SOURCE_TYPE'), code: 'TEXT', name: 'ข้อความพิมพ์เอง', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('KNOWLEDGE_SOURCE_TYPE'), code: 'LOCAL', name: 'ไฟล์ในเครื่อง', colorCode: '#8B5CF6', sortOrder: 2 },
    { groupId: groupMap.get('KNOWLEDGE_SOURCE_TYPE'), code: 'GOOGLE_DRIVE', name: 'Google Drive', colorCode: '#10B981', sortOrder: 3 },
    { groupId: groupMap.get('KNOWLEDGE_SOURCE_TYPE'), code: 'WEBSITE', name: 'ดึงจากเว็บไซต์', colorCode: '#F59E0B', sortOrder: 4 },

    // --- ImageSource ---
    { groupId: groupMap.get('IMAGE_SOURCE'), code: 'GOOGLE_CLOUD', name: 'Google Cloud Storage', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('IMAGE_SOURCE'), code: 'EXTERNAL', name: 'ลิงก์ภายนอก (CDN)', colorCode: '#6B7280', sortOrder: 2 },
    { groupId: groupMap.get('IMAGE_SOURCE'), code: 'LOCAL', name: 'ไฟล์ในเครื่องเซิร์ฟเวอร์', colorCode: '#9CA3AF', sortOrder: 3 },
    { groupId: groupMap.get('IMAGE_SOURCE'), code: 'GOOGLE_DRIVE', name: 'Google Drive', colorCode: '#10B981', sortOrder: 4 },

    // --- ImageGenerationType ---
    { groupId: groupMap.get('IMAGE_GENERATION_TYPE'), code: 'ORIGINAL', name: 'รูปต้นฉบับ', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('IMAGE_GENERATION_TYPE'), code: 'AI_NO_BG', name: 'AI ลบพื้นหลัง', colorCode: '#8B5CF6', sortOrder: 2 },
    { groupId: groupMap.get('IMAGE_GENERATION_TYPE'), code: 'AI_ENHANCED', name: 'AI ปรับภาพชัด', colorCode: '#EC4899', sortOrder: 3 },

    // --- MediaType ---
    { groupId: groupMap.get('MEDIA_TYPE'), code: 'IMAGE', name: 'รูปภาพ', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('MEDIA_TYPE'), code: 'VIDEO', name: 'วิดีโอ', colorCode: '#EF4444', sortOrder: 2 },

    // --- AiProcessStatus ---
    { groupId: groupMap.get('AI_PROCESS_STATUS'), code: 'PENDING', name: 'รอคิว', colorCode: '#F59E0B', sortOrder: 1 },
    { groupId: groupMap.get('AI_PROCESS_STATUS'), code: 'PROCESSING', name: 'กำลังวิเคราะห์', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('AI_PROCESS_STATUS'), code: 'COMPLETED', name: 'สำเร็จ', colorCode: '#10B981', sortOrder: 3 },
    { groupId: groupMap.get('AI_PROCESS_STATUS'), code: 'FAILED', name: 'เกิดข้อผิดพลาด', colorCode: '#EF4444', sortOrder: 4 },
    { groupId: groupMap.get('AI_PROCESS_STATUS'), code: 'SKIPPED', name: 'ข้ามการทำงาน', colorCode: '#9CA3AF', sortOrder: 5 },

    // --- ShippingCalcType ---
    { groupId: groupMap.get('SHIPPING_CALC_TYPE'), code: 'PRICE_BASED', name: 'คำนวณตามยอดเงิน', colorCode: '#10B981', sortOrder: 1 },
    { groupId: groupMap.get('SHIPPING_CALC_TYPE'), code: 'WEIGHT_BASED', name: 'คำนวณตามน้ำหนัก', colorCode: '#F59E0B', sortOrder: 2 },
    { groupId: groupMap.get('SHIPPING_CALC_TYPE'), code: 'FLAT_RATE', name: 'ราคาเดียวเหมาจ่าย', colorCode: '#3B82F6', sortOrder: 3 },

    // --- RmaType ---
    { groupId: groupMap.get('RMA_TYPE'), code: 'REFUND', name: 'คืนของขอเงินคืน', colorCode: '#EF4444', sortOrder: 1 },
    { groupId: groupMap.get('RMA_TYPE'), code: 'EXCHANGE', name: 'เปลี่ยนสินค้า', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('RMA_TYPE'), code: 'REPAIR', name: 'ส่งซ่อม/เคลม', colorCode: '#F59E0B', sortOrder: 3 },

    // --- RmaStatus ---
    { groupId: groupMap.get('RMA_STATUS'), code: 'PENDING', name: 'รอลูกค้ายื่นเรื่อง', colorCode: '#F59E0B', sortOrder: 1 },
    { groupId: groupMap.get('RMA_STATUS'), code: 'APPROVED', name: 'อนุมัติ (รอของส่งมา)', colorCode: '#10B981', sortOrder: 2 },
    { groupId: groupMap.get('RMA_STATUS'), code: 'SHIPPING', name: 'ลูกค้ากำลังส่งของ', colorCode: '#3B82F6', sortOrder: 3 },
    { groupId: groupMap.get('RMA_STATUS'), code: 'RECEIVED', name: 'ร้านได้รับของแล้ว', colorCode: '#8B5CF6', sortOrder: 4 },
    { groupId: groupMap.get('RMA_STATUS'), code: 'CHECKING', name: 'กำลังตรวจสอบ', colorCode: '#F97316', sortOrder: 5 },
    { groupId: groupMap.get('RMA_STATUS'), code: 'COMPLETED', name: 'จบงาน', colorCode: '#10B981', sortOrder: 6 },
    { groupId: groupMap.get('RMA_STATUS'), code: 'REJECTED', name: 'ปฏิเสธคำขอ', colorCode: '#EF4444', sortOrder: 7 },
    { groupId: groupMap.get('RMA_STATUS'), code: 'CANCELLED', name: 'ยกเลิก', colorCode: '#9CA3AF', sortOrder: 8 },

    // --- StockChangeType ---
    { groupId: groupMap.get('STOCK_CHANGE_TYPE'), code: 'SALE', name: 'ขาย (ตัดสต็อก)', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('STOCK_CHANGE_TYPE'), code: 'PURCHASE', name: 'ซื้อเข้า (เพิ่มสต็อก)', colorCode: '#10B981', sortOrder: 2 },
    { groupId: groupMap.get('STOCK_CHANGE_TYPE'), code: 'RETURN_IN', name: 'รับคืนจากลูกค้า (เพิ่ม)', colorCode: '#8B5CF6', sortOrder: 3 },
    { groupId: groupMap.get('STOCK_CHANGE_TYPE'), code: 'RETURN_OUT', name: 'ส่งคืนคู่ค้า (ตัด)', colorCode: '#F97316', sortOrder: 4 },
    { groupId: groupMap.get('STOCK_CHANGE_TYPE'), code: 'ADJUSTMENT', name: 'ปรับปรุงยอด', colorCode: '#6B7280', sortOrder: 5 },
    { groupId: groupMap.get('STOCK_CHANGE_TYPE'), code: 'WASTE', name: 'ของเสีย/ชำรุด', colorCode: '#EF4444', sortOrder: 6 },
    { groupId: groupMap.get('STOCK_CHANGE_TYPE'), code: 'TRANSFER_OUT', name: 'โอนออกไปคลังอื่น (ตัดสต็อกคลังต้นทาง)', colorCode: '#ea6a3c', sortOrder: 7 },
    { groupId: groupMap.get('STOCK_CHANGE_TYPE'), code: 'TRANSFER_IN', name: 'รับเข้าจากคลังอื่น (เพิ่มสต็อกคลังปลายทาง)', colorCode: '#0dc06c', sortOrder: 8 },

    // --- NotificationType ---
    { groupId: groupMap.get('NOTIFICATION_TYPE'), code: 'ORDER_UPDATE', name: 'ออเดอร์', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('NOTIFICATION_TYPE'), code: 'PROMOTION', name: 'โปรโมชั่น', colorCode: '#EC4899', sortOrder: 2 },
    { groupId: groupMap.get('NOTIFICATION_TYPE'), code: 'SYSTEM', name: 'ระบบ', colorCode: '#6B7280', sortOrder: 3 },
    { groupId: groupMap.get('NOTIFICATION_TYPE'), code: 'REWARD', name: 'สิทธิพิเศษ', colorCode: '#F59E0B', sortOrder: 4 },

    // --- AuthProviderType ---
    { groupId: groupMap.get('AUTH_PROVIDER_TYPE'), code: 'EMAIL', name: 'อีเมล', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('AUTH_PROVIDER_TYPE'), code: 'GOOGLE', name: 'Google', colorCode: '#EA4335', sortOrder: 2 },
    { groupId: groupMap.get('AUTH_PROVIDER_TYPE'), code: 'FACEBOOK', name: 'Facebook', colorCode: '#1877F2', sortOrder: 3 },
    { groupId: groupMap.get('AUTH_PROVIDER_TYPE'), code: 'LINE', name: 'LINE', colorCode: '#00C300', sortOrder: 4 },
    { groupId: groupMap.get('AUTH_PROVIDER_TYPE'), code: 'THAID', name: 'ThaID', colorCode: '#1D4ED8', sortOrder: 5 },
    { groupId: groupMap.get('AUTH_PROVIDER_TYPE'), code: 'PAOTANG', name: 'เป๋าตัง', colorCode: '#06B6D4', sortOrder: 6 },
    { groupId: groupMap.get('AUTH_PROVIDER_TYPE'), code: 'NDID', name: 'NDID', colorCode: '#4F46E5', sortOrder: 7 },

    // --- DayRelative ---
    { groupId: groupMap.get('DAY_RELATIVE'), code: 'PREVIOUS', name: 'วันก่อนหน้า', colorCode: '#F59E0B', sortOrder: 1 },
    { groupId: groupMap.get('DAY_RELATIVE'), code: 'CURRENT', name: 'วันปัจจุบัน', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('DAY_RELATIVE'), code: 'NEXT', name: 'วันถัดไป', colorCode: '#8B5CF6', sortOrder: 3 },

    // --- ShiftType ---
    { groupId: groupMap.get('SHIFT_TYPE'), code: 'WORK_DAY', name: 'วันทำงาน', colorCode: '#10B981', sortOrder: 1 },
    { groupId: groupMap.get('SHIFT_TYPE'), code: 'OFF_DAY', name: 'วันหยุด', colorCode: '#EF4444', sortOrder: 2 },

    // --- GenderRule ---
    { groupId: groupMap.get('GENDER_RULE'), code: 'ALL', name: 'ทุกเพศ', colorCode: '#10B981', sortOrder: 1 },
    { groupId: groupMap.get('GENDER_RULE'), code: 'MALE', name: 'เฉพาะผู้ชาย', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('GENDER_RULE'), code: 'FEMALE', name: 'เฉพาะผู้หญิง', colorCode: '#EC4899', sortOrder: 3 },

    // --- AccrualType ---
    { groupId: groupMap.get('ACCRUAL_TYPE'), code: 'LUMP_SUM', name: 'แจกยอดเต็ม', colorCode: '#10B981', sortOrder: 1 },
    { groupId: groupMap.get('ACCRUAL_TYPE'), code: 'MONTHLY_ACCRUAL', name: 'ทยอยแจกรายเดือน', colorCode: '#3B82F6', sortOrder: 2 },

    // --- RoundingRule ---
    { groupId: groupMap.get('ROUNDING_RULE'), code: 'NO_ROUNDING', name: 'ไม่ปัดเศษ', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('ROUNDING_RULE'), code: 'ROUND_UP_FULL', name: 'ปัดขึ้นเต็มหน่วย', colorCode: '#10B981', sortOrder: 2 },
    { groupId: groupMap.get('ROUNDING_RULE'), code: 'ROUND_DOWN_FULL', name: 'ปัดลงเต็มหน่วย', colorCode: '#EF4444', sortOrder: 3 },
    { groupId: groupMap.get('ROUNDING_RULE'), code: 'ROUND_UP_HALF', name: 'ปัดขึ้นครึ่งหน่วย', colorCode: '#3B82F6', sortOrder: 4 },
    { groupId: groupMap.get('ROUNDING_RULE'), code: 'ROUND_DOWN_HALF', name: 'ปัดลงครึ่งหน่วย', colorCode: '#F59E0B', sortOrder: 5 },
    { groupId: groupMap.get('ROUNDING_RULE'), code: 'ROUND_NEAREST_HALF', name: 'ปัดค่าใกล้เคียง', colorCode: '#8B5CF6', sortOrder: 6 },

    // --- RoundingType ---
    { groupId: groupMap.get('ROUNDING_TYPE'), code: 'WHOLE', name: 'ปัดจากค่าทั้งหมด', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('ROUNDING_TYPE'), code: 'DIGIT', name: 'ปัดเศษทศนิยม', colorCode: '#10B981', sortOrder: 2 },

    // --- AdjustmentType ---
    { groupId: groupMap.get('ADJUSTMENT_TYPE'), code: 'INCREASE', name: 'เพิ่ม', colorCode: '#10B981', sortOrder: 1 },
    { groupId: groupMap.get('ADJUSTMENT_TYPE'), code: 'DECREASE', name: 'ลด', colorCode: '#EF4444', sortOrder: 2 },
    { groupId: groupMap.get('ADJUSTMENT_TYPE'), code: 'SET', name: 'ตั้งค่าใหม่ (แทนที่)', colorCode: '#F59E0B', sortOrder: 3 },

    // --- LeaveDurationRule ---
    { groupId: groupMap.get('LEAVE_DURATION_RULE'), code: 'FULL_DAY_ONLY', name: 'ลาเต็มวันเท่านั้น', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('LEAVE_DURATION_RULE'), code: 'HALF_DAY_RESOLUTION', name: 'ลาเต็ม/ครึ่งวัน', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('LEAVE_DURATION_RULE'), code: 'HOURLY', name: 'ลารายชั่วโมง', colorCode: '#10B981', sortOrder: 3 },

    // --- LeaveRequestStatus ---
    { groupId: groupMap.get('LEAVE_REQUEST_STATUS'), code: 'PENDING', name: 'รออนุมัติ', colorCode: '#F59E0B', sortOrder: 1 },
    { groupId: groupMap.get('LEAVE_REQUEST_STATUS'), code: 'APPROVED', name: 'อนุมัติแล้ว', colorCode: '#10B981', sortOrder: 2 },
    { groupId: groupMap.get('LEAVE_REQUEST_STATUS'), code: 'REJECTED', name: 'ไม่อนุมัติ', colorCode: '#EF4444', sortOrder: 3 },
    { groupId: groupMap.get('LEAVE_REQUEST_STATUS'), code: 'CANCELLED', name: 'ยกเลิก', colorCode: '#9CA3AF', sortOrder: 4 },
  ];

  // =========================================================
  // 3. บันทึกข้อมูลลงฐานข้อมูล
  // =========================================================
  for (const item of enumData) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { 
        masterGroupId: item.groupId, 
        code: item.code, 
        companyId: null
      },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { 
          name: item.name, 
          sortOrder: item.sortOrder,
          colorCode: item.colorCode
        },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: { 
          masterGroupId: item.groupId, 
          code: item.code, 
          name: item.name, 
          colorCode: item.colorCode,
          sortOrder: item.sortOrder, 
          companyId: null, 
          isActive: true, 
          labels: {} 
        },
      });
    }
  }
  
  console.log('✅ Remaining System Enums Seeded!');
}

async function seedAdditionalEnums() {
  console.log('Seeding Additional System Enums...');

  // =========================================================
  // 1. กำหนดข้อมูล Master Groups ทั้งหมด
  // =========================================================
  const enumGroups = [
    { code: 'ORG_VERSION_STATUS', name: 'สถานะเวอร์ชันผังองค์กร', description: 'สถานะการใช้งานของโครงสร้างองค์กรแต่ละเวอร์ชัน' },
    { code: 'KPI_TARGET_TYPE', name: 'ประเภทเป้าหมาย KPI', description: 'ระดับของการตั้งเป้าหมายตัวชี้วัด' },
    { code: 'PLAN_STATUS', name: 'สถานะแผนงาน', description: 'สถานะของแผนงานต่างๆ ในระบบ' },
    { code: 'KPI_EVALUATION_STATUS', name: 'สถานะการประเมินผล', description: 'ขั้นตอนกระบวนการประเมินผลพนักงาน' },
    { code: 'OFFENSE_SEVERITY', name: 'ระดับความผิด', description: 'ความร้ายแรงของการกระทำผิดทางวินัย' },
    { code: 'DISCIPLINARY_STATUS', name: 'สถานะการลงโทษทางวินัย', description: 'สถานะการพิจารณาบทลงโทษ' },
    { code: 'TRAINING_SESSION_STATUS', name: 'สถานะรอบการอบรม', description: 'สถานะการจัดฝึกอบรม' },
    { code: 'ENROLLMENT_STATUS', name: 'สถานะลงทะเบียนอบรม', description: 'สถานะการเข้าร่วมอบรมของพนักงาน' },
    { code: 'DECORATION_RETURN_STATUS', name: 'สถานะคืนเครื่องราชฯ', description: 'สถานะการส่งคืนเครื่องราชอิสริยาภรณ์' },
    { code: 'BOOKING_STATUS', name: 'สถานะการจอง', description: 'สถานะการจองห้องประชุมหรือทรัพยากร' },
    { code: 'WELFARE_CATEGORY', name: 'หมวดหมู่สวัสดิการ', description: 'ประเภทของสวัสดิการพนักงาน' },
    { code: 'WELFARE_REQUEST_STATUS', name: 'สถานะคำขอสวัสดิการ', description: 'สถานะการเบิกจ่ายสวัสดิการ' },
    { code: 'ADJUSTMENT_REASON', name: 'เหตุผลการปรับค่าจ้าง', description: 'สาเหตุการเปลี่ยนแปลงเงินเดือน/ค่าตอบแทน' },
    { code: 'CALCULATION_METHOD', name: 'วิธีการคำนวณเงินเดือน', description: 'รูปแบบการคิดปรับฐานเงินเดือน' },
    { code: 'PAYROLL_CYCLE_STATUS', name: 'สถานะรอบบัญชีเงินเดือน', description: 'สถานะกระบวนการทำเงินเดือน (Payroll)' },
    { code: 'ASSET_STATUS', name: 'สถานะสินทรัพย์', description: 'สถานะของทรัพย์สิน/พัสดุในระบบ' },
    { code: 'ACQUISITION_METHOD', name: 'วิธีการได้มาซึ่งสินทรัพย์', description: 'รูปแบบการจัดหาทรัพย์สิน' },
    { code: 'ASSET_REQUEST_TYPE', name: 'ประเภทคำขอสินทรัพย์', description: 'รูปแบบการขอใช้งานหรือจัดการทรัพย์สิน' },
    { code: 'ASSET_REQUEST_STATUS', name: 'สถานะคำขอสินทรัพย์', description: 'สถานะการอนุมัติคำขอสินทรัพย์' },
    { code: 'GRIEVANCE_STATUS', name: 'สถานะร้องทุกข์', description: 'ขั้นตอนการจัดการข้อร้องเรียน' },
    { code: 'GRIEVANCE_SEVERITY', name: 'ระดับความร้ายแรงร้องทุกข์', description: 'ความรุนแรงของข้อร้องเรียน' },
    { code: 'MARKETPLACE_TYPE', name: 'แพลตฟอร์มมาร์เก็ตเพลส', description: 'ประเภทของช่องทางการขายภายนอก' },
    { code: 'MAPPING_STATUS', name: 'สถานะการจับคู่สินค้า', description: 'สถานะการยืนยันการผูกสินค้ากับมาร์เก็ตเพลส' },
    { code: 'WAREHOUSE_TYPE', name: 'ประเภทคลังสินค้า', description: 'ประเภทลักษณะคลังสินค้า' }
  ];

  const groupMap = new Map();
  for (const group of enumGroups) {
    const createdGroup = await prisma.cfgMasterGroup.upsert({
      where: { groupCode: group.code },
      update: {},
      create: {
        groupCode: group.code,
        groupName: group.name,
        description: group.description,
        isSystem: true,
        isActive: true,
      },
    });
    groupMap.set(group.code, createdGroup.id);
  }

  // =========================================================
  // 2. กำหนดข้อมูล Master Data (ตัวเลือกย่อย)
  // =========================================================
  const enumData = [
    // --- OrgVersionStatus ---
    { groupId: groupMap.get('ORG_VERSION_STATUS'), code: 'DRAFT', name: 'ร่าง', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('ORG_VERSION_STATUS'), code: 'PUBLISHED', name: 'ประกาศใช้', colorCode: '#10B981', sortOrder: 2 },
    { groupId: groupMap.get('ORG_VERSION_STATUS'), code: 'ARCHIVED', name: 'จัดเก็บ (ไม่ใช้งาน)', colorCode: '#9CA3AF', sortOrder: 3 },
    { groupId: groupMap.get('ORG_VERSION_STATUS'), code: 'CANCELLED', name: 'ยกเลิก', colorCode: '#EF4444', sortOrder: 4 },
    { groupId: groupMap.get('ORG_VERSION_STATUS'), code: 'PENDING_APPROVAL', name: 'รออนุมัติ', colorCode: '#F59E0B', sortOrder: 5 },

    // --- KpiTargetType ---
    { groupId: groupMap.get('KPI_TARGET_TYPE'), code: 'CORPORATE', name: 'ระดับองค์กร', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('KPI_TARGET_TYPE'), code: 'DEPARTMENT', name: 'ระดับแผนก/ฝ่าย', colorCode: '#8B5CF6', sortOrder: 2 },
    { groupId: groupMap.get('KPI_TARGET_TYPE'), code: 'INDIVIDUAL', name: 'ระดับบุคคล', colorCode: '#10B981', sortOrder: 3 },

    // --- PlanStatus ---
    { groupId: groupMap.get('PLAN_STATUS'), code: 'DRAFT', name: 'ร่างแผน', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('PLAN_STATUS'), code: 'PENDING_APPROVAL', name: 'รออนุมัติ', colorCode: '#F59E0B', sortOrder: 2 },
    { groupId: groupMap.get('PLAN_STATUS'), code: 'PUBLISHED', name: 'ประกาศใช้เป็นทางการ', colorCode: '#10B981', sortOrder: 3 },
    { groupId: groupMap.get('PLAN_STATUS'), code: 'REVISED', name: 'ถูกแก้ไข/แทนที่', colorCode: '#9CA3AF', sortOrder: 4 },

    // --- KpiEvaluationStatus ---
    { groupId: groupMap.get('KPI_EVALUATION_STATUS'), code: 'GOAL_SETTING', name: 'ช่วงตั้งเป้าหมาย', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('KPI_EVALUATION_STATUS'), code: 'PENDING_PLAN_APPROVAL', name: 'รออนุมัติเป้าหมายต้นปี', colorCode: '#F59E0B', sortOrder: 2 },
    { groupId: groupMap.get('KPI_EVALUATION_STATUS'), code: 'SELF_EVALUATION', name: 'พนักงานประเมินตนเอง', colorCode: '#3B82F6', sortOrder: 3 },
    { groupId: groupMap.get('KPI_EVALUATION_STATUS'), code: 'MANAGER_EVALUATION', name: 'หัวหน้าประเมิน', colorCode: '#8B5CF6', sortOrder: 4 },
    { groupId: groupMap.get('KPI_EVALUATION_STATUS'), code: 'COMMITTEE_EVALUATION', name: 'คณะกรรมการประเมิน', colorCode: '#EC4899', sortOrder: 5 },
    { groupId: groupMap.get('KPI_EVALUATION_STATUS'), code: 'COMPLETED', name: 'สิ้นสุดกระบวนการ', colorCode: '#10B981', sortOrder: 6 },
    { groupId: groupMap.get('KPI_EVALUATION_STATUS'), code: 'CANCELLED', name: 'ยกเลิก', colorCode: '#EF4444', sortOrder: 7 },

    // --- OffenseSeverity ---
    { groupId: groupMap.get('OFFENSE_SEVERITY'), code: 'MINOR', name: 'ความผิดเล็กน้อย', colorCode: '#F59E0B', sortOrder: 1 },
    { groupId: groupMap.get('OFFENSE_SEVERITY'), code: 'MAJOR', name: 'ความผิดร้ายแรง', colorCode: '#F97316', sortOrder: 2 },
    { groupId: groupMap.get('OFFENSE_SEVERITY'), code: 'SEVERE', name: 'ความผิดร้ายแรงมาก', colorCode: '#EF4444', sortOrder: 3 },

    // --- DisciplinaryStatus ---
    { groupId: groupMap.get('DISCIPLINARY_STATUS'), code: 'DRAFT', name: 'กำลังรวบรวมหลักฐาน', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('DISCIPLINARY_STATUS'), code: 'INVESTIGATING', name: 'กำลังสอบสวน', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('DISCIPLINARY_STATUS'), code: 'PENDING_APPROVAL', name: 'รออนุมัติบทลงโทษ', colorCode: '#F59E0B', sortOrder: 3 },
    { groupId: groupMap.get('DISCIPLINARY_STATUS'), code: 'EFFECTIVE', name: 'มีผลบังคับใช้แล้ว', colorCode: '#EF4444', sortOrder: 4 },
    { groupId: groupMap.get('DISCIPLINARY_STATUS'), code: 'APPEALED', name: 'อยู่ระหว่างอุทธรณ์', colorCode: '#8B5CF6', sortOrder: 5 },
    { groupId: groupMap.get('DISCIPLINARY_STATUS'), code: 'CANCELLED', name: 'พิจารณาแล้วไม่มีความผิด', colorCode: '#10B981', sortOrder: 6 },

    // --- TrainingSessionStatus ---
    { groupId: groupMap.get('TRAINING_SESSION_STATUS'), code: 'PLANNING', name: 'กำลังวางแผน', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('TRAINING_SESSION_STATUS'), code: 'PUBLISHED', name: 'ประกาศแล้ว (รับสมัคร)', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('TRAINING_SESSION_STATUS'), code: 'IN_PROGRESS', name: 'กำลังดำเนินการอบรม', colorCode: '#F59E0B', sortOrder: 3 },
    { groupId: groupMap.get('TRAINING_SESSION_STATUS'), code: 'COMPLETED', name: 'อบรมเสร็จสิ้น', colorCode: '#10B981', sortOrder: 4 },
    { groupId: groupMap.get('TRAINING_SESSION_STATUS'), code: 'CANCELLED', name: 'ยกเลิก', colorCode: '#EF4444', sortOrder: 5 },

    // --- EnrollmentStatus ---
    { groupId: groupMap.get('ENROLLMENT_STATUS'), code: 'PENDING', name: 'รออนุมัติเข้าอบรม', colorCode: '#F59E0B', sortOrder: 1 },
    { groupId: groupMap.get('ENROLLMENT_STATUS'), code: 'REGISTERED', name: 'ลงทะเบียนแล้ว', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('ENROLLMENT_STATUS'), code: 'ATTENDED', name: 'เข้าร่วมอบรม', colorCode: '#10B981', sortOrder: 3 },
    { groupId: groupMap.get('ENROLLMENT_STATUS'), code: 'NO_SHOW', name: 'ขาดการอบรม', colorCode: '#F97316', sortOrder: 4 },
    { groupId: groupMap.get('ENROLLMENT_STATUS'), code: 'REJECTED', name: 'หัวหน้าไม่อนุมัติ', colorCode: '#EF4444', sortOrder: 5 },
    { groupId: groupMap.get('ENROLLMENT_STATUS'), code: 'CANCELLED', name: 'ยกเลิกการลงทะเบียน', colorCode: '#9CA3AF', sortOrder: 6 },

    // --- DecorationReturnStatus ---
    { groupId: groupMap.get('DECORATION_RETURN_STATUS'), code: 'NOT_REQUIRED', name: 'ไม่ต้องส่งคืน', colorCode: '#10B981', sortOrder: 1 },
    { groupId: groupMap.get('DECORATION_RETURN_STATUS'), code: 'PENDING_RETURN', name: 'ต้องส่งคืน (ยังไม่ส่ง)', colorCode: '#F59E0B', sortOrder: 2 },
    { groupId: groupMap.get('DECORATION_RETURN_STATUS'), code: 'RETURNED', name: 'ส่งคืนเรียบร้อยแล้ว', colorCode: '#3B82F6', sortOrder: 3 },
    { groupId: groupMap.get('DECORATION_RETURN_STATUS'), code: 'LOST', name: 'สูญหาย (ชดใช้ราคา)', colorCode: '#EF4444', sortOrder: 4 },

    // --- BookingStatus ---
    { groupId: groupMap.get('BOOKING_STATUS'), code: 'DRAFT', name: 'ร่างข้อมูล', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('BOOKING_STATUS'), code: 'PENDING_APPROVE', name: 'อยู่ระหว่างขออนุมัติ', colorCode: '#F59E0B', sortOrder: 2 },
    { groupId: groupMap.get('BOOKING_STATUS'), code: 'APPROVED', name: 'อนุมัติแล้ว', colorCode: '#10B981', sortOrder: 3 },
    { groupId: groupMap.get('BOOKING_STATUS'), code: 'REJECTED', name: 'ไม่ได้รับการอนุมัติ', colorCode: '#EF4444', sortOrder: 4 },
    { groupId: groupMap.get('BOOKING_STATUS'), code: 'CANCELLED', name: 'ยกเลิกโดยผู้จอง', colorCode: '#9CA3AF', sortOrder: 5 },
    { groupId: groupMap.get('BOOKING_STATUS'), code: 'COMPLETED', name: 'เสร็จสิ้นแล้ว', colorCode: '#3B82F6', sortOrder: 6 },

    // --- WelfareCategory ---
    { groupId: groupMap.get('WELFARE_CATEGORY'), code: 'MEDICAL', name: 'ค่ารักษาพยาบาล', colorCode: '#EF4444', sortOrder: 1 },
    { groupId: groupMap.get('WELFARE_CATEGORY'), code: 'EDUCATION', name: 'ค่าเล่าเรียน', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('WELFARE_CATEGORY'), code: 'HOUSING', name: 'ค่าเช่าบ้าน/ที่พัก', colorCode: '#8B5CF6', sortOrder: 3 },
    { groupId: groupMap.get('WELFARE_CATEGORY'), code: 'ALLOWANCE', name: 'เงินช่วยเหลือ', colorCode: '#F59E0B', sortOrder: 4 },
    { groupId: groupMap.get('WELFARE_CATEGORY'), code: 'LIFESTYLE', name: 'ไลฟ์สไตล์', colorCode: '#10B981', sortOrder: 5 },
    { groupId: groupMap.get('WELFARE_CATEGORY'), code: 'OTHER', name: 'อื่นๆ', colorCode: '#6B7280', sortOrder: 6 },

    // --- WelfareRequestStatus ---
    { groupId: groupMap.get('WELFARE_REQUEST_STATUS'), code: 'DRAFT', name: 'ร่างข้อมูล', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('WELFARE_REQUEST_STATUS'), code: 'PENDING_APPROVE', name: 'รออนุมัติ', colorCode: '#F59E0B', sortOrder: 2 },
    { groupId: groupMap.get('WELFARE_REQUEST_STATUS'), code: 'APPROVED', name: 'อนุมัติแล้ว (รอจ่าย)', colorCode: '#3B82F6', sortOrder: 3 },
    { groupId: groupMap.get('WELFARE_REQUEST_STATUS'), code: 'PAID', name: 'จ่ายเงินเรียบร้อยแล้ว', colorCode: '#10B981', sortOrder: 4 },
    { groupId: groupMap.get('WELFARE_REQUEST_STATUS'), code: 'REJECTED', name: 'ไม่อนุมัติ', colorCode: '#EF4444', sortOrder: 5 },
    { groupId: groupMap.get('WELFARE_REQUEST_STATUS'), code: 'CANCELLED', name: 'ยกเลิก', colorCode: '#9CA3AF', sortOrder: 6 },

    // --- AdjustmentReason ---
    { groupId: groupMap.get('ADJUSTMENT_REASON'), code: 'ANNUAL_MERIT', name: 'เลื่อนขั้นประจำปี', colorCode: '#10B981', sortOrder: 1 },
    { groupId: groupMap.get('ADJUSTMENT_REASON'), code: 'PROMOTION', name: 'เลื่อนตำแหน่ง', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('ADJUSTMENT_REASON'), code: 'PROBATION', name: 'ผ่านทดลองงาน', colorCode: '#8B5CF6', sortOrder: 3 },
    { groupId: groupMap.get('ADJUSTMENT_REASON'), code: 'COST_OF_LIVING', name: 'ปรับฐานค่าครองชีพ', colorCode: '#F59E0B', sortOrder: 4 },
    { groupId: groupMap.get('ADJUSTMENT_REASON'), code: 'SPECIAL', name: 'ความดีความชอบพิเศษ', colorCode: '#EC4899', sortOrder: 5 },

    // --- CalculationMethod ---
    { groupId: groupMap.get('CALCULATION_METHOD'), code: 'BASE_PERCENTAGE', name: 'คิด % จากฐานกลาง', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('CALCULATION_METHOD'), code: 'CURRENT_PERCENTAGE', name: 'คิด % จากฐานปัจจุบัน', colorCode: '#10B981', sortOrder: 2 },
    { groupId: groupMap.get('CALCULATION_METHOD'), code: 'FIXED_AMOUNT', name: 'เพิ่มจำนวนเงินคงที่', colorCode: '#8B5CF6', sortOrder: 3 },
    { groupId: groupMap.get('CALCULATION_METHOD'), code: 'NEW_BASE_SALARY', name: 'ระบุฐานใหม่', colorCode: '#F59E0B', sortOrder: 4 },

    // --- PayrollCycleStatus ---
    { groupId: groupMap.get('PAYROLL_CYCLE_STATUS'), code: 'DRAFT', name: 'กำลังคำนวณ', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('PAYROLL_CYCLE_STATUS'), code: 'REVIEWING', name: 'ส่งตรวจสอบ', colorCode: '#F59E0B', sortOrder: 2 },
    { groupId: groupMap.get('PAYROLL_CYCLE_STATUS'), code: 'APPROVED', name: 'อนุมัติแล้ว', colorCode: '#3B82F6', sortOrder: 3 },
    { groupId: groupMap.get('PAYROLL_CYCLE_STATUS'), code: 'PAID', name: 'จ่ายเงินเรียบร้อย', colorCode: '#10B981', sortOrder: 4 },

    // --- AssetStatus ---
    { groupId: groupMap.get('ASSET_STATUS'), code: 'AVAILABLE', name: 'ว่าง/อยู่ในคลัง', colorCode: '#10B981', sortOrder: 1 },
    { groupId: groupMap.get('ASSET_STATUS'), code: 'IN_USE', name: 'ถูกเบิกใช้งาน', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('ASSET_STATUS'), code: 'IN_REPAIR', name: 'อยู่ระหว่างซ่อม', colorCode: '#F59E0B', sortOrder: 3 },
    { groupId: groupMap.get('ASSET_STATUS'), code: 'LOST', name: 'สูญหาย', colorCode: '#EF4444', sortOrder: 4 },
    { groupId: groupMap.get('ASSET_STATUS'), code: 'WRITTEN_OFF', name: 'จำหน่ายออกแล้ว', colorCode: '#9CA3AF', sortOrder: 5 },

    // --- AcquisitionMethod ---
    { groupId: groupMap.get('ACQUISITION_METHOD'), code: 'PURCHASE', name: 'จัดซื้อ', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('ACQUISITION_METHOD'), code: 'DONATION', name: 'ได้รับบริจาค', colorCode: '#10B981', sortOrder: 2 },
    { groupId: groupMap.get('ACQUISITION_METHOD'), code: 'TRANSFER', name: 'โอนย้าย', colorCode: '#8B5CF6', sortOrder: 3 },
    { groupId: groupMap.get('ACQUISITION_METHOD'), code: 'OTHER', name: 'อื่นๆ', colorCode: '#6B7280', sortOrder: 4 },

    // --- AssetRequestType ---
    { groupId: groupMap.get('ASSET_REQUEST_TYPE'), code: 'PROCUREMENT', name: 'ขอจัดซื้อ', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('ASSET_REQUEST_TYPE'), code: 'BORROW', name: 'ขอเบิก/ยืม', colorCode: '#10B981', sortOrder: 2 },
    { groupId: groupMap.get('ASSET_REQUEST_TYPE'), code: 'REPAIR', name: 'ขอแจ้งซ่อม', colorCode: '#F59E0B', sortOrder: 3 },
    { groupId: groupMap.get('ASSET_REQUEST_TYPE'), code: 'DISPOSAL', name: 'ขอจำหน่ายพัสดุ', colorCode: '#EF4444', sortOrder: 4 },

    // --- AssetRequestStatus ---
    { groupId: groupMap.get('ASSET_REQUEST_STATUS'), code: 'DRAFT', name: 'ร่าง', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('ASSET_REQUEST_STATUS'), code: 'PENDING_APPROVE', name: 'รออนุมัติ', colorCode: '#F59E0B', sortOrder: 2 },
    { groupId: groupMap.get('ASSET_REQUEST_STATUS'), code: 'APPROVED', name: 'อนุมัติแล้ว', colorCode: '#3B82F6', sortOrder: 3 },
    { groupId: groupMap.get('ASSET_REQUEST_STATUS'), code: 'REJECTED', name: 'ไม่อนุมัติ', colorCode: '#EF4444', sortOrder: 4 },
    { groupId: groupMap.get('ASSET_REQUEST_STATUS'), code: 'COMPLETED', name: 'เสร็จสิ้น', colorCode: '#10B981', sortOrder: 5 },

    // --- GrievanceStatus ---
    { groupId: groupMap.get('GRIEVANCE_STATUS'), code: 'DRAFT', name: 'ร่างคำร้อง', colorCode: '#6B7280', sortOrder: 1 },
    { groupId: groupMap.get('GRIEVANCE_STATUS'), code: 'SUBMITTED', name: 'ส่งเรื่องแล้ว', colorCode: '#F59E0B', sortOrder: 2 },
    { groupId: groupMap.get('GRIEVANCE_STATUS'), code: 'INVESTIGATING', name: 'กำลังตรวจสอบ', colorCode: '#3B82F6', sortOrder: 3 },
    { groupId: groupMap.get('GRIEVANCE_STATUS'), code: 'RESOLVED', name: 'ยุติเรื่อง/แก้ปัญหาแล้ว', colorCode: '#10B981', sortOrder: 4 },
    { groupId: groupMap.get('GRIEVANCE_STATUS'), code: 'REJECTED', name: 'ปฏิเสธคำร้อง', colorCode: '#EF4444', sortOrder: 5 },
    { groupId: groupMap.get('GRIEVANCE_STATUS'), code: 'WITHDRAWN', name: 'ผู้ร้องขอถอนเรื่อง', colorCode: '#9CA3AF', sortOrder: 6 },

    // --- GrievanceSeverity ---
    { groupId: groupMap.get('GRIEVANCE_SEVERITY'), code: 'LOW', name: 'ทั่วไป', colorCode: '#10B981', sortOrder: 1 },
    { groupId: groupMap.get('GRIEVANCE_SEVERITY'), code: 'MEDIUM', name: 'ปานกลาง', colorCode: '#F59E0B', sortOrder: 2 },
    { groupId: groupMap.get('GRIEVANCE_SEVERITY'), code: 'HIGH', name: 'สูง', colorCode: '#F97316', sortOrder: 3 },
    { groupId: groupMap.get('GRIEVANCE_SEVERITY'), code: 'CRITICAL', name: 'วิกฤต', colorCode: '#EF4444', sortOrder: 4 },

    // --- MarketplaceType ---
    { groupId: groupMap.get('MARKETPLACE_TYPE'), code: 'SHOPEE', name: 'Shopee', colorCode: '#EE4D2D', sortOrder: 1 },
    { groupId: groupMap.get('MARKETPLACE_TYPE'), code: 'LAZADA', name: 'Lazada', colorCode: '#000080', sortOrder: 2 },
    { groupId: groupMap.get('MARKETPLACE_TYPE'), code: 'TIKTOK', name: 'TikTok Shop', colorCode: '#000000', sortOrder: 3 },
    { groupId: groupMap.get('MARKETPLACE_TYPE'), code: 'LINE_SHOPPING', name: 'LINE Shopping', colorCode: '#00C300', sortOrder: 4 },
    { groupId: groupMap.get('MARKETPLACE_TYPE'), code: 'OTHER', name: 'อื่นๆ', colorCode: '#6B7280', sortOrder: 5 },

    // --- MappingStatus ---
    { groupId: groupMap.get('MAPPING_STATUS'), code: 'PENDING', name: 'AI เสนอ (รอคนยืนยัน)', colorCode: '#F59E0B', sortOrder: 1 },
    { groupId: groupMap.get('MAPPING_STATUS'), code: 'CONFIRMED', name: 'ยืนยันแล้ว', colorCode: '#10B981', sortOrder: 2 },
    { groupId: groupMap.get('MAPPING_STATUS'), code: 'REJECTED', name: 'ปฏิเสธ (AI จับคู่ผิด)', colorCode: '#EF4444', sortOrder: 3 },

      // --- MappingStatus ---
    { groupId: groupMap.get('WAREHOUSE_TYPE'), code: 'CENTRAL', name: 'คลังกลาง', colorCode: '#F59E0B', sortOrder: 1 },
    { groupId: groupMap.get('WAREHOUSE_TYPE'), code: 'BRANCH', name: 'คลังสาขา / หน้าร้าน', colorCode: '#10B981', sortOrder: 2 },
    { groupId: groupMap.get('WAREHOUSE_TYPE'), code: 'VIRTUAL', name: 'คลังเสมือน (เช่น สำหรับกันสต็อก Shopee)', colorCode: '#EF4444', sortOrder: 3 },
    { groupId: groupMap.get('WAREHOUSE_TYPE'), code: 'TRANSIT', name: 'คลังสินค้าระหว่างทาง (เวลาโอนย้าย)', colorCode: '#000080', sortOrder: 4 },
    { groupId: groupMap.get('WAREHOUSE_TYPE'), code: 'RETURN', name: 'คลังสินค้าตีกลับ/รอเคลม', colorCode: '#87c4a5', sortOrder: 4 },
  ];

  // =========================================================
  // 3. บันทึกข้อมูลลงฐานข้อมูล
  // =========================================================
  for (const item of enumData) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { 
        masterGroupId: item.groupId, 
        code: item.code, 
        companyId: null
      },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { 
          name: item.name, 
          sortOrder: item.sortOrder,
          colorCode: item.colorCode
        },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: { 
          masterGroupId: item.groupId, 
          code: item.code, 
          name: item.name, 
          colorCode: item.colorCode,
          sortOrder: item.sortOrder, 
          companyId: null, 
          isActive: true, 
          labels: {} 
        },
      });
    }
  }
  
  console.log('✅ Additional System Enums Seeded Successfully!');
}

async function seedMilitaryStatuses() {
  console.log('Seeding Military Statuses...');

  // 1. สร้างกลุ่ม Master Group สำหรับสถานภาพทางทหาร
  const statusGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'MILITARY_STATUS' },
    update: {},
    create: {
      groupCode: 'MILITARY_STATUS',
      groupName: 'สถานภาพทางทหาร (Military Status)',
      description: 'สถานะการเกณฑ์ทหารของพนักงานชาย',
      isSystem: true, // ล็อกไว้ไม่ให้ User ลบ เพราะผูกกับ Enum ในระบบ
      isActive: true,
    },
  });

  // 2. รายการสถานภาพทางทหาร พร้อมกำหนดสี
  const militaryStatuses = [
    { code: 'EXEMPTED', name: 'ได้รับการยกเว้น', colorCode: '#10B981', sortOrder: 1 },    // สีเขียว (ปลอดภัย)
    { code: 'SERVED', name: 'ผ่านการเกณฑ์ทหารแล้ว', colorCode: '#3B82F6', sortOrder: 2 },  // สีฟ้า (เคลียร์แล้ว)
    { code: 'NOT_SERVED', name: 'ยังไม่ผ่านการเกณฑ์ทหาร', colorCode: '#F59E0B', sortOrder: 3 }, // สีส้ม (ต้องระวัง/รอเกณฑ์)
  ];

  // 3. วนลูปบันทึกข้อมูล
  for (const status of militaryStatuses) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { 
        masterGroupId: statusGroup.id, 
        code: status.code, 
        companyId: null // เป็นข้อมูลกลางของระบบ
      },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { 
          name: status.name, 
          sortOrder: status.sortOrder,
          colorCode: status.colorCode
        },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: { 
          masterGroupId: statusGroup.id, 
          code: status.code, 
          name: status.name, 
          colorCode: status.colorCode,
          sortOrder: status.sortOrder, 
          companyId: null, 
          isActive: true, 
          labels: {} 
        },
      });
    }
  }
  
  console.log('✅ Military Statuses Seeded!');
}

async function seedSex() {
  console.log('Seeding Genders...');

  // 1. สร้างกลุ่ม Master Group สำหรับเพศ
  const statusGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'SEX' },
    update: {},
    create: {
      groupCode: 'SEX',
      groupName: 'เพศ (Gender)',
      description: 'เพศสภาพของพนักงาน',
      isSystem: true, // ล็อกไว้ไม่ให้ User ลบ เพราะผูกกับระบบ
      isActive: true,
    },
  });

  // 2. รายการเพศ พร้อมกำหนดสี
  const genders = [
    { code: 'MALE', name: 'ชาย', colorCode: '#3B82F6', sortOrder: 1 },       // สีฟ้า
    { code: 'FEMALE', name: 'หญิง', colorCode: '#EC4899', sortOrder: 2 },     // สีชมพู
   
  ];

  // 3. วนลูปบันทึกข้อมูล
  for (const gender of genders) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { 
        masterGroupId: statusGroup.id, 
        code: gender.code, 
        companyId: null // เป็นข้อมูลกลางของระบบ
      },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { 
          name: gender.name, 
          sortOrder: gender.sortOrder,
          colorCode: gender.colorCode
        },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: { 
          masterGroupId: statusGroup.id, 
          code: gender.code, 
          name: gender.name, 
          colorCode: gender.colorCode,
          sortOrder: gender.sortOrder, 
          companyId: null, 
          isActive: true, 
          labels: {} 
        },
      });
    }
  }
  
  console.log('✅ Genders Seeded!');
}

async function seedHrEnums() {
  console.log('Seeding HR Enums (CalendarType, HolidayCategory)...');

  // =========================================================
  // 1. กำหนดข้อมูล Master Groups
  // =========================================================
  const enumGroups = [
    {
      code: 'CALENDAR_TYPE',
      name: 'ประเภทของปฏิทิน',
      description: 'ประเภทของรอบปีปฏิทิน (CalendarType)',
    },
    {
      code: 'HOLIDAY_CATEGORY',
      name: 'ประเภทวันหยุด',
      description: 'ประเภทของวันหยุดในระบบ (HolidayCategory)',
    },
    {
      code: 'HOLIDAY_GROUP_STATUS',
      name: 'สถานะกลุ่มวันหยุด',
      description: 'สถานะของกลุ่มวันหยุดในระบบ (HolidayGroupStatus)',
    },
    {
      code: 'BREAK_TYPE',
      name: 'ประเภทพักผ่อน',
      description: 'ประเภทของเวลาพักผ่อนในระบบ (BreakType)',
    }
  ];

  // สร้าง Master Groups ลง Database
  const groupMap = new Map();
  for (const group of enumGroups) {
    const createdGroup = await prisma.cfgMasterGroup.upsert({
      where: { groupCode: group.code },
      update: {},
      create: {
        groupCode: group.code,
        groupName: group.name,
        description: group.description,
        isSystem: true, // ล็อกไว้ไม่ให้ User ลบ
        isActive: true,
      },
    });
    groupMap.set(group.code, createdGroup.id);
  }

  // =========================================================
  // 2. กำหนดข้อมูล Master Data (ตัวเลือกย่อย)
  // =========================================================
  const enumData = [
    // --- 📌 CalendarType ---
    { groupId: groupMap.get('CALENDAR_TYPE'), code: 'CALENDAR', name: 'ปีปฏิทิน (มกราคม - ธันวาคม)', colorCode: '#3B82F6', sortOrder: 1 }, // สีฟ้า
    { groupId: groupMap.get('CALENDAR_TYPE'), code: 'FISCAL', name: 'ปีงบประมาณ', colorCode: '#10B981', sortOrder: 2 }, // สีเขียว

    // --- 📌 HolidayCategory ---
    { groupId: groupMap.get('HOLIDAY_CATEGORY'), code: 'PUBLIC', name: 'วันหยุดตามประเพณี / นักขัตฤกษ์', colorCode: '#F59E0B', sortOrder: 1 }, // สีเหลือง/ส้ม
    { groupId: groupMap.get('HOLIDAY_CATEGORY'), code: 'COMPANY', name: 'วันหยุดพิเศษของบริษัท', colorCode: '#8B5CF6', sortOrder: 2 }, // สีม่วง
    { groupId: groupMap.get('HOLIDAY_CATEGORY'), code: 'SPECIAL', name: 'วันหยุดพิเศษของบริษัท', colorCode: '#22f313', sortOrder: 3 }, // สีม่วง

    // --- 📌 HolidayGroupStatus ---
    { groupId: groupMap.get('HOLIDAY_GROUP_STATUS'), code: 'PUBLISHED', name: 'ประกาศใช้แล้ว', colorCode: '#10B981', sortOrder: 1 }, // สีเขียว
    { groupId: groupMap.get('HOLIDAY_GROUP_STATUS'), code: 'CANCELLED', name: 'ยกเลิก', colorCode: '#EF4444', sortOrder: 2 },  // สีแดง
    { groupId: groupMap.get('HOLIDAY_GROUP_STATUS'), code: 'DRAFT', name: 'กำลังร่าง แก้ไขได้เต็มที่', colorCode: '#2a0f8c', sortOrder: 3 },

    // --- 📌 BreakType ---
    { groupId: groupMap.get('BREAK_TYPE'), code: 'FIXED_TIME', name: 'พักตามเวลา', colorCode: '#F59E0B', sortOrder: 1 }, // สีเหลือง/ส้ม
    { groupId: groupMap.get('BREAK_TYPE'), code: 'FLEXIBLE', name: 'พักแบบยืดหยุ่น', colorCode: '#8B5CF6', sortOrder: 2 }, // สีม่วง
  ];

  // =========================================================
  // 3. บันทึกข้อมูลลงฐานข้อมูล
  // =========================================================
  for (const item of enumData) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { 
        masterGroupId: item.groupId, 
        code: item.code, 
        companyId: null // เป็นข้อมูลกลางของระบบ
      },
    });

    if (existing) {
      // อัปเดตข้อมูลกรณีที่มีอยู่แล้ว
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { 
          name: item.name, 
          sortOrder: item.sortOrder,
          colorCode: item.colorCode
        },
      });
    } else {
      // สร้างใหม่
      await prisma.cfgMasterData.create({
        data: { 
          masterGroupId: item.groupId, 
          code: item.code, 
          name: item.name, 
          colorCode: item.colorCode,
          sortOrder: item.sortOrder, 
          companyId: null, 
          isActive: true, 
          labels: {} 
        },
      });
    }
  }
  
  console.log('✅ HR Enums Seeded!');
}

async function seedHrEmployeeEnums() {
  console.log('Seeding HR Employee Enums (Title, EmploymentType, BloodGroup, Nationality, Religion, MaritalStatus, Relationship)...');

  // =========================================================
  // 1. กำหนดข้อมูล Master Groups
  // =========================================================
  const enumGroups = [
    { code: 'TITLE', name: 'คำนำหน้าชื่อ', description: 'คำนำหน้าชื่อบุคคล (Title)' },
    { code: 'EMPLOYMENT_TYPE', name: 'ประเภทการจ้างงาน', description: 'สถานะหรือประเภทของการจ้างงาน (Employment Type)' },
    { code: 'BLOOD_GROUP', name: 'หมู่เลือด', description: 'หมู่เลือดของพนักงาน (Blood Group)' },
    { code: 'NATIONALITY', name: 'สัญชาติ', description: 'สัญชาติของพนักงาน (Nationality)' },
    { code: 'RELIGION', name: 'ศาสนา', description: 'ศาสนาของพนักงาน (Religion)' },
    { code: 'MARITAL_STATUS', name: 'สถานภาพสมรส', description: 'สถานภาพครอบครัว (Marital Status)' },
    { code: 'RELATIONSHIP', name: 'ความสัมพันธ์', description: 'ความสัมพันธ์ของผู้ติดต่อฉุกเฉินหรือบุคคลในครอบครัว (Relationship)' }
  ];

  // สร้าง Master Groups ลง Database
  const groupMap = new Map();
  for (const group of enumGroups) {
    const createdGroup = await prisma.cfgMasterGroup.upsert({
      where: { groupCode: group.code },
      update: {},
      create: {
        groupCode: group.code,
        groupName: group.name,
        description: group.description,
        isSystem: true, // ล็อกไว้ไม่ให้ User ลบ
        isActive: true,
      },
    });
    groupMap.set(group.code, createdGroup.id);
  }

  // =========================================================
  // 2. กำหนดข้อมูล Master Data (ตัวเลือกย่อย)
  // =========================================================
  const enumData = [
    // --- 📌 คำนำหน้า (TITLE) ---
    { groupId: groupMap.get('TITLE'), code: 'MR', name: 'นาย', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('TITLE'), code: 'MRS', name: 'นาง', colorCode: '#EC4899', sortOrder: 2 },
    { groupId: groupMap.get('TITLE'), code: 'MISS', name: 'นางสาว', colorCode: '#F472B6', sortOrder: 3 },
    { groupId: groupMap.get('TITLE'), code: 'OTHER', name: 'อื่นๆ', colorCode: '#9CA3AF', sortOrder: 4 },

    // --- 📌 ประเภทการจ้าง (EMPLOYMENT_TYPE) ---
    { groupId: groupMap.get('EMPLOYMENT_TYPE'), code: 'FULL_TIME', name: 'พนักงานประจำ', colorCode: '#10B981', sortOrder: 1 },
    { groupId: groupMap.get('EMPLOYMENT_TYPE'), code: 'PART_TIME', name: 'พนักงานพาร์ทไทม์', colorCode: '#F59E0B', sortOrder: 2 },
    { groupId: groupMap.get('EMPLOYMENT_TYPE'), code: 'PROBATION', name: 'ทดลองงาน', colorCode: '#3B82F6', sortOrder: 3 },
    { groupId: groupMap.get('EMPLOYMENT_TYPE'), code: 'CONTRACT', name: 'สัญญาจ้าง', colorCode: '#8B5CF6', sortOrder: 4 },
    { groupId: groupMap.get('EMPLOYMENT_TYPE'), code: 'INTERN', name: 'นักศึกษาฝึกงาน', colorCode: '#06B6D4', sortOrder: 5 },

    // --- 📌 หมู่เลือด (BLOOD_GROUP) ---
    { groupId: groupMap.get('BLOOD_GROUP'), code: 'A', name: 'กรุ๊ป A', colorCode: '#EF4444', sortOrder: 1 },
    { groupId: groupMap.get('BLOOD_GROUP'), code: 'B', name: 'กรุ๊ป B', colorCode: '#EF4444', sortOrder: 2 },
    { groupId: groupMap.get('BLOOD_GROUP'), code: 'AB', name: 'กรุ๊ป AB', colorCode: '#EF4444', sortOrder: 3 },
    { groupId: groupMap.get('BLOOD_GROUP'), code: 'O', name: 'กรุ๊ป O', colorCode: '#EF4444', sortOrder: 4 },

    // --- 📌 สัญชาติ (NATIONALITY) ---
    { groupId: groupMap.get('NATIONALITY'), code: 'THAI', name: 'ไทย', colorCode: '#4F46E5', sortOrder: 1 },
    { groupId: groupMap.get('NATIONALITY'), code: 'OTHER', name: 'อื่นๆ', colorCode: '#9CA3AF', sortOrder: 2 },

    // --- 📌 ศาสนา (RELIGION) ---
    { groupId: groupMap.get('RELIGION'), code: 'BUDDHISM', name: 'พุทธ', colorCode: '#F59E0B', sortOrder: 1 },
    { groupId: groupMap.get('RELIGION'), code: 'ISLAM', name: 'อิสลาม', colorCode: '#10B981', sortOrder: 2 },
    { groupId: groupMap.get('RELIGION'), code: 'CHRISTIANITY', name: 'คริสต์', colorCode: '#3B82F6', sortOrder: 3 },
    { groupId: groupMap.get('RELIGION'), code: 'HINDUISM', name: 'ฮินดู', colorCode: '#8B5CF6', sortOrder: 4 },
    { groupId: groupMap.get('RELIGION'), code: 'OTHER', name: 'อื่นๆ', colorCode: '#6B7280', sortOrder: 5 },
    { groupId: groupMap.get('RELIGION'), code: 'NONE', name: 'ไม่มีศาสนา', colorCode: '#9CA3AF', sortOrder: 6 },

    // --- 📌 สถานภาพ (MARITAL_STATUS) ---
    { groupId: groupMap.get('MARITAL_STATUS'), code: 'SINGLE', name: 'โสด', colorCode: '#10B981', sortOrder: 1 },
    { groupId: groupMap.get('MARITAL_STATUS'), code: 'MARRIED', name: 'สมรส', colorCode: '#3B82F6', sortOrder: 2 },
    { groupId: groupMap.get('MARITAL_STATUS'), code: 'DIVORCED', name: 'หย่าร้าง', colorCode: '#F59E0B', sortOrder: 3 },
    { groupId: groupMap.get('MARITAL_STATUS'), code: 'WIDOWED', name: 'หม้าย', colorCode: '#6B7280', sortOrder: 4 },

    // --- 📌 ความสัมพันธ์ (RELATIONSHIP) ---
    { groupId: groupMap.get('RELATIONSHIP'), code: 'PARENT', name: 'บิดา/มารดา', colorCode: '#3B82F6', sortOrder: 1 },
    { groupId: groupMap.get('RELATIONSHIP'), code: 'SPOUSE', name: 'สามี/ภรรยา', colorCode: '#EC4899', sortOrder: 2 },
    { groupId: groupMap.get('RELATIONSHIP'), code: 'CHILD', name: 'บุตร/ธิดา', colorCode: '#10B981', sortOrder: 3 },
    { groupId: groupMap.get('RELATIONSHIP'), code: 'SIBLING', name: 'พี่/น้อง', colorCode: '#F59E0B', sortOrder: 4 },
    { groupId: groupMap.get('RELATIONSHIP'), code: 'RELATIVE', name: 'ญาติ', colorCode: '#8B5CF6', sortOrder: 5 },
    { groupId: groupMap.get('RELATIONSHIP'), code: 'FRIEND', name: 'เพื่อน', colorCode: '#06B6D4', sortOrder: 6 },
    { groupId: groupMap.get('RELATIONSHIP'), code: 'OTHER', name: 'อื่นๆ', colorCode: '#9CA3AF', sortOrder: 7 },
  ];

  // =========================================================
  // 3. บันทึกข้อมูลลงฐานข้อมูล
  // =========================================================
  for (const item of enumData) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { 
        masterGroupId: item.groupId, 
        code: item.code, 
        companyId: null // เป็นข้อมูลกลางของระบบ
      },
    });

    if (existing) {
      // อัปเดตข้อมูลกรณีที่มีอยู่แล้ว
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { 
          name: item.name, 
          sortOrder: item.sortOrder,
          colorCode: item.colorCode
        },
      });
    } else {
      // สร้างใหม่
      await prisma.cfgMasterData.create({
        data: { 
          masterGroupId: item.groupId, 
          code: item.code, 
          name: item.name, 
          colorCode: item.colorCode,
          sortOrder: item.sortOrder, 
          companyId: null, 
          isActive: true, 
          labels: {} 
        },
      });
    }
  }
  
  console.log('✅ HR Employee Enums Seeded!');
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
// 🔄 ฟังก์ชันสร้าง MASTER DATA: ประเภทเหตุการณ์ Workflow (BUSINESS_TYPE)
// =========================================================
async function seedWorkflowBusinessTypes(prisma: any) {
  console.log('🔄 Seeding Workflow Business Types...');

  // 1. สร้าง/อัปเดต Master Group
  const wfGroup = await prisma.cfgMasterGroup.upsert({
    where: { groupCode: 'WORKFLOW_BUSINESS_TYPE' },
    update: {},
    create: {
      groupCode: 'WORKFLOW_BUSINESS_TYPE',
      groupName: 'ประเภทเอกสารในสายอนุมัติ',
      description: 'รหัสเหตุการณ์ (Module Code) สำหรับนำไปผูกกับ Workflow',
      isSystem: true,
      isActive: true,
    },
  });

  // 2. ข้อมูลประเภทเหตุการณ์ (อ้างอิงจากภาพหน้าจอและระบบอื่นๆ ของ KKV)
  const wfTypes = [
    { code: 'HR_MANPOWER', name: 'ขออัตรากำลังคน', sortOrder: 1 },
    { code: 'HR_ORG_PUBLISH', name: 'ประกาศใช้โครงสร้างองค์กร', sortOrder: 2 },
    { code: 'HR_MOVEMENT', name: 'การเคลื่อนไหวพนักงาน', sortOrder: 3 },
    { code: 'COM_PO', name: 'ใบสั่งซื้อ', sortOrder: 4 },
    { code: 'RETURN_REQUEST', name: 'คำขอคืนสินค้า', sortOrder: 5 },
    { code: 'LEAVE_REQUEST', name: 'คำขอลาหยุด', sortOrder: 6 },
    { code: 'OT_REQUEST', name: 'คำขอทำงานล่วงเวลา', sortOrder: 7 },
    { code: 'EXPENSE_CLAIM', name: 'เบิกค่าใช้จ่าย', sortOrder: 8 },
    { code: 'MOD_DOC_SECURE_DELETE', name: 'อนุมัติทำลายเอกสาร', sortOrder: 9 }, 
    { code: 'DOC_UPLOAD', name: 'อนุมัติอัปโหลดเอกสาร', sortOrder: 9 },
  ];

  // 3. วนลูปบันทึก Master Data
  for (const wt of wfTypes) {
    const existing = await prisma.cfgMasterData.findFirst({
      where: { 
        masterGroupId: wfGroup.id, 
        code: wt.code, 
        companyId: null // ระดับกลางของระบบ
      },
    });

    if (existing) {
      await prisma.cfgMasterData.update({
        where: { id: existing.id },
        data: { 
          name: wt.name, 
          sortOrder: wt.sortOrder
        },
      });
    } else {
      await prisma.cfgMasterData.create({
        data: {
          masterGroupId: wfGroup.id,
          code: wt.code,
          name: wt.name,
          sortOrder: wt.sortOrder,
          companyId: null,
          isActive: true,
          labels: {}
        },
      });
    }
  }
  console.log(`✅ Seeded ${wfTypes.length} Workflow Business Types!`);
}

// =========================================================
// 🏦 ฟังก์ชันสร้าง MASTER DATA: ธนาคาร (CfgBank)
// =========================================================
async function seedBanks(prisma: any) {
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
}


  

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