import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateSecurityConfigDto } from './dto/security-config.dto';

@Injectable()
export class CompanySecurityService {
  constructor(private prisma: PrismaService) {}

  /**
   * ✅ ตรวจสอบว่าเมนูนี้ในบริษัทนี้ ต้องทำ Re-auth หรือไม่
   */
  async checkRequirement(companyId: number, menuId: number) {
    const config = await this.prisma.secCompanySecurityConfig.findUnique({
      where: {
        companyId_menuId: { companyId, menuId } // ใช้ Compound Unique Index
      }
    });

    return config || { requireReAuth: false, requireMfa: false, gracePeriod: 0 };
  }

  /**
   * ✅ ตั้งค่าความปลอดภัยสำหรับเมนูเฉพาะบริษัท
   */
  async upsertConfig(companyId: number, dto: UpdateSecurityConfigDto) {
    const { menuId, ...configData } = dto;
    
    // 🛡️ เช็คก่อนว่าเมนูหลักในระบบมีอยู่จริงไหม ป้องกัน Database Error 500
    const menuExists = await this.prisma.secMenu.findUnique({
      where: { id: menuId }
    });
    
    if (!menuExists) {
      throw new NotFoundException(`ไม่พบเมนูระบบ (ID: ${menuId}) ที่ต้องการตั้งค่าความปลอดภัย`);
    }
    
    return this.prisma.secCompanySecurityConfig.upsert({
      where: {
        companyId_menuId: { companyId, menuId }
      },
      update: configData,
      create: {
        companyId,
        menuId,
        ...configData
      }
    });
  }

  /**
   * ✅ ดึงรายการที่ตั้งค่าทั้งหมดของบริษัท
   */
  async findAllByCompany(companyId: number) {
    return this.prisma.secCompanySecurityConfig.findMany({
      where: { companyId },
      include: { menu: true } // เพื่อให้รู้ว่าคือเมนูไหน
    });
  }
}