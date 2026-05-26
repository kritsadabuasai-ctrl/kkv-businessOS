import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuthConfigsService {
  constructor(private prisma: PrismaService) {}

  // ============================================================================
  // 🛡️ Helper: ตรวจสอบสิทธิ์ (ต้องเป็น Super Admin **และ** อยู่บริษัท HQ เท่านั้น)
  // ============================================================================
  private async validateHqSuperAdmin(user: any) {
    // 1. เช็คสิทธิ์ Super Admin จาก Token ก่อน
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('เฉพาะสิทธิ์ Super Admin เท่านั้นที่สามารถทำรายการนี้ได้');
    }

    if (!user.companyId) {
      throw new ForbiddenException('ไม่พบข้อมูลบริษัทของคุณ');
    }

    // 2. เช็คว่าเป็น HQ หรือไม่ (License Holder ต้องเป็น Null)
    const company = await this.prisma.orgCompany.findUnique({
      where: { id: Number(user.companyId) },
      select: { licenseHolderId: true }
    });

    if (company?.licenseHolderId !== null) {
      throw new ForbiddenException('เฉพาะบริษัทสำนักงานใหญ่ (HQ) เท่านั้นที่สามารถจัดการข้อมูลส่วนกลางได้');
    }

    return true; // ต้องผ่านทั้ง 2 ด่านถึงจะอนุญาต
  }

  // ============================================================================

  // 🌟 1. ดึงข้อมูลส่วนกลางทั้งหมด (สำหรับหน้า Super Admin)
  async getSystemProviders(user: any) {
    await this.validateHqSuperAdmin(user); // 🛡️ ตรวจสิทธิ์ก่อนดึงข้อมูล

    return this.prisma.sysAuthProvider.findMany({
      orderBy: { id: 'asc' } 
    });
  }

  // 🌟 2. อัปเดตส่วนกลาง
  async updateSystemProvider(id: string, dto: any, user: any) {
    await this.validateHqSuperAdmin(user); // 🛡️ ตรวจสิทธิ์ก่อนบันทึก

    return this.prisma.sysAuthProvider.update({
      where: { id: id.toUpperCase() },
      data: {
        isEnabled: dto.isEnabled,
        isMaintenance: dto.isMaintenance,
        name: dto.name,
        iconUrl: dto.iconUrl
      }
    });
  }

  // 🏢 3. ดึงข้อมูลให้ Company (กรองเอาเฉพาะที่ส่วนกลางอนุญาต)
  async getMyConfig(companyId: number) {
    const activeSysProviders = await this.prisma.sysAuthProvider.findMany({
      where: { isEnabled: true }
    });

    const companyConfigs = await this.prisma.secCompanyAuthConfig.findMany({
      where: { companyId }
    });

    return activeSysProviders.map(sys => {
      const config = companyConfigs.find(c => c.providerId === sys.id);
      return {
        providerId: sys.id,
        name: sys.name,
        iconUrl: sys.iconUrl,
        isMaintenance: sys.isMaintenance,
        isEnabled: config ? config.isEnabled : false,
        clientId: config?.clientId || '',
        clientSecret: config?.clientSecret || ''
      };
    });
  }

  // 🏢 4. บริษัทบันทึกการตั้งค่าของตัวเอง
  async updateMyConfig(companyId: number, dto: any) {
    const sysProvider = await this.prisma.sysAuthProvider.findUnique({
      where: { id: dto.providerId.toUpperCase() }
    });

    if (!sysProvider || !sysProvider.isEnabled) {
      throw new BadRequestException(`ไม่อนุญาตให้เปิดใช้งาน ${dto.providerId} เนื่องจากระบบส่วนกลางปิดการใช้งานอยู่`);
    }

    return this.prisma.secCompanyAuthConfig.upsert({
      where: {
        companyId_providerId: {
          companyId,
          providerId: dto.providerId.toUpperCase()
        }
      },
      update: {
        isEnabled: dto.isEnabled,
        clientId: dto.clientId,
        clientSecret: dto.clientSecret
      },
      create: {
        companyId,
        providerId: dto.providerId.toUpperCase(),
        isEnabled: dto.isEnabled,
        clientId: dto.clientId,
        clientSecret: dto.clientSecret
      }
    });
  }

  // 🌐 5. ดึงปุ่มแสดงหน้า Login (กรอง 2 ชั้น: ส่วนกลางต้องเปิด และ บริษัทต้องเปิด)
  async getLoginOptions(companyId: number) {
    const configs = await this.prisma.secCompanyAuthConfig.findMany({
      where: { 
        companyId,
        isEnabled: true, 
        provider: {
          isEnabled: true 
        }
      },
      include: { provider: true } 
    });

    return configs.map(c => ({
      provider: c.providerId.toLowerCase(),
      name: c.provider.name,
      iconUrl: c.provider.iconUrl,
      isMaintenance: c.provider.isMaintenance
    }));
  }
}