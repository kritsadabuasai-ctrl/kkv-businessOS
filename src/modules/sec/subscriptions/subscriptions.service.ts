import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OrgSubscriptionsService {
  constructor(private prisma: PrismaService) {}

// ============================================================================
  // 🌟 Helper: ดึงข้อมูลเครือข่ายบริษัท (Network) ตามสิทธิ์ของผู้ใช้
  // ============================================================================
  private async getNetworkAccess(currentUser: any) {
    // 🛡️ 1. ดักจับ ID ให้คลุมทุกแบบ ป้องกัน undefined เด็ดขาด
    const userId = Number(currentUser.sub || currentUser.id || currentUser.userId);
    
    if (!userId || isNaN(userId)) {
      throw new Error('ไม่พบข้อมูล User ID กรุณาล็อกอินใหม่');
    }

    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId: userId },
      include: { role: true, company: true }
    });

    // 🌟 2. หา Company ID หลักของ User คนนี้ก่อน (เอาจาก Role แรกที่มีสังกัด)
    const primaryCompanyId = userRoles.find(ur => ur.companyId !== null)?.companyId;
    
    // 🌟 3. ดึงข้อมูลบริษัทหลักนี้มาดูว่า ใครคือ License Holder?
    let isHQ = false;
    if (primaryCompanyId) {
      const myCompany = await this.prisma.orgCompany.findUnique({
        where: { id: primaryCompanyId },
        select: { licenseHolderId: true }
      });
      // เป็น HQ ตัวจริง ก็ต่อเมื่อบริษัทตัวเอง "ไม่มีหัวหน้า (licenseHolderId === null)"
      isHQ = myCompany?.licenseHolderId === null;
    }

    // 🌟 4. เช็คว่ามีสิทธิ์ SUPER_ADMIN ในระบบไหม
    const hasSuperAdminRole = userRoles.some(ur => 
      ur.role && ur.role.name && ur.role.name.toUpperCase() === 'SUPER_ADMIN'
    );
    
    const isGlobalAdmin = isHQ && hasSuperAdminRole;

    let allowedCompanyIds: number[] = [];

    if (!isGlobalAdmin && primaryCompanyId) {
      // 🌟 ให้สิทธิ์ตัวเองเสมอ
      const networkSet = new Set<number>([primaryCompanyId]);
      let currentLevelIds = [primaryCompanyId];

      // 🌟🌟 ลอจิกใหม่ (อิงตาม Concept ที่ถูกต้อง): ค้นหาจากสายลิขสิทธิ์ (licenseHolderId / licensedGroup)
      while (currentLevelIds.length > 0) {
        const licensedGroup = await this.prisma.orgCompany.findMany({
          // 💡 หาเฉพาะบริษัทที่ "ฉันเป็นคนถือลิขสิทธิ์ให้" (เทียบเท่าการดึง licensedGroup)
          where: { licenseHolderId: { in: currentLevelIds } },
          select: { id: true }
        });

        // คัดกรอง ID ลูกที่ไม่ซ้ำ และใส่ตะกร้า
        const childIds = licensedGroup.map(c => c.id).filter(id => !networkSet.has(id));
        if (childIds.length === 0) break;

        childIds.forEach(id => networkSet.add(id));
        // ตั้งให้ลูกกลุ่มนี้ เป็นผู้ถือลิขสิทธิ์ของรอบถัดไป (เพื่อหาหลานต่อ)
        currentLevelIds = childIds;
      }

      allowedCompanyIds = Array.from(networkSet);
    }

    return { isGlobalAdmin, allowedCompanyIds, primaryCompanyId };
  }


 /**
   * 📊 1. ดึงข้อมูลสรุปหน้าตาราง (อัปเดตให้แสดงลูกข่ายเมื่อดูหน้าตัวเอง)
   */
  async getSummary(queryCompanyId: number | undefined, currentUser: any) {
    const { isGlobalAdmin, allowedCompanyIds } = await this.getNetworkAccess(currentUser);
    
    // ดึง ID บริษัทของคนที่ล็อกอินเข้ามาอย่างปลอดภัย
    const userId = Number(currentUser.userId || currentUser.sub || currentUser.id);
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId },
      select: { companyId: true }
    });
    
    // หา companyId หลักของ User คนนี้
    const userDirectCompanyId = userRoles.find(ur => ur.companyId !== null)?.companyId;

    const whereCondition: any = {};

    if (queryCompanyId) {
      // 🔹 มีการเจาะจงเลือกบริษัทมาจากหน้าบ้าน
      if (!isGlobalAdmin && !allowedCompanyIds.includes(queryCompanyId)) {
         throw new ForbiddenException('คุณไม่มีสิทธิ์ดูข้อมูล Subscription ของบริษัทนี้');
      }

      // 🌟 ลอจิกใหม่: ถ้ากำลังดู "บริษัทของตัวเอง" (เช่น โหลดหน้าแรก หรือเลือกตัวเองใน Dropdown)
      if (queryCompanyId === userDirectCompanyId) {
         if (isGlobalAdmin) {
            // เป็น HQ: ดูหน้าตัวเอง = ให้เห็นทั้งหมดเลย (ไม่กำหนด whereCondition.id)
         } else {
            // เป็นตัวแทน: ดูหน้าตัวเอง = ให้เห็นตัวเอง + ลูกข่ายทั้งหมดของตัวเอง
            whereCondition.id = { in: allowedCompanyIds }; 
         }
      } else {
         // 🌟 แต่ถ้าจงใจคลิกเลือก "บริษัทอื่น" ใน Dropdown ให้แสดงแค่บริษัทที่เลือกเท่านั้น
         whereCondition.id = queryCompanyId;
      }

    } else {
      // 🔹 กรณีหน้าบ้านไม่ส่งอะไรมา หรือส่ง 'all' มา
      if (!isGlobalAdmin) {
         whereCondition.id = { in: allowedCompanyIds }; 
      }
      // ถ้าเป็น isGlobalAdmin จะปล่อย whereCondition ว่างๆ ไว้ เพื่อดึงมาทั้งหมด
    }

    // ดึงรายชื่อบริษัท พร้อมแนบ Subscription (Active) ไปแสดงผล
    const companies = await this.prisma.orgCompany.findMany({
      where: whereCondition,
      select: {
        id: true,
        code: true,
        name: true,
        packageId: true,
        licenseHolderId: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { module: { select: { name: true, code: true } } }
        }
      },
      orderBy: { id: 'asc' }
    });

    return companies;
  }
  

 /**
   * 📝 3. อัปเดตแพ็กเกจ โมดูล และต่ออายุ (รองรับทั้งมีผลทันที และ ตั้งเวลาล่วงหน้า)
   */
  async updateSubscription(companyId: number, dto: any, currentUser: any) {
    const { isGlobalAdmin, allowedCompanyIds } = await this.getNetworkAccess(currentUser);
    const targetCompanyId = Number(companyId);
    const currentUserId = Number(currentUser.userId || currentUser.sub || currentUser.id);

    // 🛡️ 1. เช็คสิทธิ์ก่อนอัปเดต
    if (!isGlobalAdmin && !allowedCompanyIds.includes(targetCompanyId)) {
      throw new ForbiddenException('ไม่มีสิทธิ์จัดการ Subscription ของบริษัทนอกเครือข่าย');
    }

    // 🌟 2. ดักจับวันที่มีผล (Effective Date)
    const effectiveStartDate = dto.startDate ? new Date(dto.startDate) : new Date();
    
    // เช็คว่าวันที่เริ่ม มากกว่า วันปัจจุบันหรือไม่ (ถ้าใช่ = ซื้อล่วงหน้า)
    const isFuture = effectiveStartDate > new Date();

    // กำหนดสถานะเป้าหมายเบื้องต้น (ถ้าหน้าบ้านไม่ได้ส่ง status มา ให้ default เป็น ACTIVE)
    const targetStatus = dto.status || 'ACTIVE';

    // เช็คประเภทราคา
    const priceType = dto.priceType || 'NORMAL';
    const paidAmount = dto.paidAmount !== undefined ? dto.paidAmount : null;

    return this.prisma.$transaction(async (prisma) => {
      
      // 3. ถ้ามีการเปลี่ยนแพ็กเกจ ให้ไปอัปเดตที่ตาราง org_companies ด้วย
      if (dto.packageId) {
        await prisma.orgCompany.update({
          where: { id: targetCompanyId },
          data: { packageId: dto.packageId }
        });
      }

      // 🌟 4. สร้างบิลประวัติการชำระเงิน (Billing History) แบบ Snapshot ก่อน
      const billingHistory = await prisma.orgBillingHistory.create({
        data: {
          companyId: targetCompanyId,
          action: dto.packageId ? 'UPGRADE' : 'RENEWAL',
          packageId: dto.packageId || null,
          price: priceType !== 'RESELLER' ? paidAmount : null,
          resellerPrice: priceType === 'RESELLER' ? paidAmount : null,
          operatorId: currentUserId,
          note: `ทำรายการผ่านระบบอัปเดต Subscription (${priceType === 'RESELLER' ? 'ราคาตัวแทน' : 'ราคาปกติ'})`
        }
      });

      // 5. อัปเดตสถานะของแต่ละโมดูล พร้อมผูก Billing ID
      if (dto.moduleIds && dto.moduleIds.length > 0) {
        const promises = dto.moduleIds.map(moduleId => {
          // 🌟 ลอจิกสำคัญ: ถ้าวันที่มีผลคืออนาคต ให้บังคับสถานะเป็น PENDING ไว้รอให้ CRON Job มาปลุก
          const finalStatus = isFuture ? 'PENDING' : targetStatus; 

          return prisma.orgSubscription.upsert({
            where: {
              companyId_moduleId: {
                companyId: targetCompanyId,
                moduleId: moduleId
              }
            },
            update: {
              status: finalStatus,           
              startDate: effectiveStartDate, 
              endDate: dto.endDate ? new Date(dto.endDate) : null,
              paidAmount: paidAmount,              // 💸 อัปเดตยอดเงิน
              priceType: priceType,                // 💸 อัปเดตประเภทราคา
              lastBillingId: billingHistory.id,    // 🔗 ผูกประวัติบิลล่าสุด
              updatedAt: new Date()          
            },
            create: {
              companyId: targetCompanyId,
              moduleId: moduleId,
              status: finalStatus,           
              startDate: effectiveStartDate, 
              endDate: dto.endDate ? new Date(dto.endDate) : null,
              paidAmount: paidAmount,              // 💸 บันทึกยอดเงิน
              priceType: priceType,                // 💸 บันทึกประเภทราคา
              lastBillingId: billingHistory.id,    // 🔗 ผูกประวัติบิลล่าสุด
            }
          });
        });

        await Promise.all(promises);
      }

      return { 
        success: true, 
        message: isFuture ? 'บันทึกการทำรายการล่วงหน้าสำเร็จ' : 'อัปเดตข้อมูล Subscription สำเร็จ' 
      };
    });
  }
  
  /**
   * 🌟 3. ดึงประวัติการต่ออายุ/เปลี่ยนแพ็กเกจของบริษัท
   */
  async getBillingHistory(companyId: number, currentUser: any) {
    const { isGlobalAdmin, allowedCompanyIds } = await this.getNetworkAccess(currentUser);

    // 🛡️ เช็คสิทธิ์ก่อนดึงข้อมูล
    if (!isGlobalAdmin && !allowedCompanyIds.includes(companyId)) {
      throw new ForbiddenException('ไม่มีสิทธิ์ดูประวัติของบริษัทนอกเครือข่าย');
    }

    // 1. ดึงข้อมูลจากฐานข้อมูลตามปกติ
    const histories = await this.prisma.orgBillingHistory.findMany({
      where: { companyId },
      include: {
        package: { select: { code: true, name: true } },
        operator: { select: { fullName: true, username: true } } // ดึงชื่อคนทำรายการมาด้วย
      },
      orderBy: { createdAt: 'desc' } // เรียงจากล่าสุดไปเก่าสุด
    });

    // 🪄 2. แปลงค่า Decimal ให้เป็นตัวเลข (Number) เพื่อให้หน้าบ้านแสดงผลได้
    return histories.map(item => {
      // (Optional Security): ถ้าเป็นลูกค้าทั่วไปดูบิลตัวเอง สามารถดักซ่อน resellerPrice ตรงนี้ได้
      // แต่เบื้องต้นเราส่งไปแสดงให้ครบก่อนครับ
      return {
        ...item,
        // ใช้ Number() ครอบเพื่อบังคับแปลงชนิดข้อมูล
        price: item.price ? Number(item.price) : 0,
        resellerPrice: item.resellerPrice ? Number(item.resellerPrice) : 0,
      };
    });
  }
}