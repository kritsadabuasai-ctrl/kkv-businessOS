import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdatePasswordPolicyDto } from './password-policy.dto';

@Injectable()
export class PasswordPolicyService {
  constructor(private prisma: PrismaService) {}

  /**
   * ✅ ดึง Policy ที่มีผลบังคับใช้ (ลูก > แม่ > Global)
   */
  async getEffectivePolicy(companyId?: number | null) {
    // 🛡️ 1. กรณี Super Admin ที่ไม่มี companyId (ดู Global Policy)
    if (!companyId) {
      const globalPolicy = await this.prisma.secPasswordPolicy.findFirst({
        where: { companyId: null }
      });
      return globalPolicy || this.getDefaultPolicy();
    }

    // 2. หาข้อมูลบริษัทและ ID บริษัทแม่
    const company = await this.prisma.orgCompany.findUnique({
      where: { id: companyId },
      select: { id: true, parentId: true }
    });

    if (!company) throw new NotFoundException('ไม่พบข้อมูลบริษัท');

    // 3. ลองดึงของบริษัทลูกก่อน (ตัวเอง)
    const childPolicy = await this.prisma.secPasswordPolicy.findUnique({
      where: { companyId: company.id }
    });
    if (childPolicy) return childPolicy;

    // 4. ถ้าลูกไม่มี ลองไปดูของบริษัทแม่
    if (company.parentId) {
      const parentPolicy = await this.prisma.secPasswordPolicy.findUnique({
        where: { companyId: company.parentId }
      });
      if (parentPolicy) return parentPolicy;
    }

    // 5. ถ้าไม่มีทั้งคู่ ให้ดึง Global Policy (ที่ companyId เป็น NULL)
    const globalPolicy = await this.prisma.secPasswordPolicy.findFirst({
      where: { companyId: null }
    });

    // 6. กรณีเลวร้ายที่สุด (ไม่มีใน DB เลย) ให้ใช้ค่า Hardcoded Default
    return globalPolicy || this.getDefaultPolicy();
  }

  /**
   * ✅ อัปเดต Policy (รองรับทั้งระดับบริษัท และระดับ Global)
   */
  async updatePolicy(companyId: number | null | undefined, dto: UpdatePasswordPolicyDto) {
    // 🛡️ 1. กรณี Super Admin ต้องการแก้ไข Global Policy (companyId เป็น null)
    if (!companyId) {
      const globalPolicy = await this.prisma.secPasswordPolicy.findFirst({
         where: { companyId: null }
      });
      
      if (globalPolicy) {
        return this.prisma.secPasswordPolicy.update({
          where: { id: globalPolicy.id },
          data: dto
        });
      } else {
        return this.prisma.secPasswordPolicy.create({
          data: { ...dto, companyId: null }
        });
      }
    }

    // 🛡️ 2. กรณีบริษัททั่วไป อัปเดต Policy ของตัวเองเท่านั้น
    return this.prisma.secPasswordPolicy.upsert({
      where: { companyId },
      update: dto,
      create: { ...dto, companyId }
    });
  }

  // ==========================================
  // 🛠️ Helper: ค่ามาตรฐานเริ่มต้น
  // ==========================================
  private getDefaultPolicy() {
    return {
      minLength: 8,
      requireUpper: true,
      requireLower: true,
      requireNumber: true,
      requireSpecial: true,
      specialChars: "!@#$%^&*",
      passwordAgeDays: 90,
      historyCount: true,
      maxLoginAttempts: 5,
      lockoutDuration: 30
    };
  }
}