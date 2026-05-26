import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; 
import { CreateSystemConfigDto } from './system-configs.dto';

@Injectable()
export class SystemConfigsService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 🛡️ Helper: ตรวจสอบว่าเป็นแอดมินของสำนักงานใหญ่ (HQ) หรือไม่
  // =========================================================
  private async ensureHQ(userId: number) {
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId },
      include: { company: true }
    });
    
    // เช็คว่ามี Role ไหนที่ผูกกับบริษัทที่ licenseHolderId เป็น null หรือไม่
    const isUserHQ = userRoles.some(ur => ur.company?.licenseHolderId === null);
    
    if (!isUserHQ) {
      throw new ForbiddenException('สิทธิ์ถูกปฏิเสธ: เฉพาะผู้ดูแลระบบของสำนักงานใหญ่ (HQ) เท่านั้นที่สามารถจัดการการตั้งค่าระบบส่วนกลางได้');
    }
  }

  // =========================================================

  async findAll(userId: number) {
    await this.ensureHQ(userId); // 🔒 เช็คสิทธิ์ก่อนดึงข้อมูล
    return this.prisma.cfgSystem.findMany();
  }

  async getValue(key: string, userId: number) {
    await this.ensureHQ(userId); // 🔒 เช็คสิทธิ์ก่อนดึงข้อมูล
    const config = await this.prisma.cfgSystem.findUnique({
      where: { key: key }, 
    });
    if (!config) throw new NotFoundException(`ไม่พบค่าคอนฟิก: ${key}`);
    return config;
  }

  async upsert(dto: CreateSystemConfigDto, userId: number) {
    await this.ensureHQ(userId); // 🔒 เช็คสิทธิ์ก่อนบันทึกข้อมูล
    return this.prisma.cfgSystem.upsert({
      where: { key: dto.configKey }, 
      update: { 
        value: dto.configValue, 
        description: dto.description 
      },
      create: {
        key: dto.configKey,     
        value: dto.configValue, 
        description: dto.description,
      },
    });
  }

  async remove(key: string, userId: number) {
    await this.ensureHQ(userId); // 🔒 เช็คสิทธิ์ก่อนลบข้อมูล
    return this.prisma.cfgSystem.delete({
      where: { key: key },
    });
  }

  // =========================================================
  // 🚀 ฟังก์ชันสำหรับ RunningFormat (ทำงานภายใน ไม่ต้องเช็ค HQ)
  // =========================================================
  async generateNextRunning(formatKey: string, companyId?: number): Promise<string> {
    const targetCompanyId = companyId || null;

    let format = await this.prisma.cfgRunningFormat.findFirst({
      where: { docCode: formatKey, companyId: targetCompanyId },
    });

    if (!format && targetCompanyId !== null) {
      format = await this.prisma.cfgRunningFormat.findFirst({
        where: { docCode: formatKey, companyId: null },
      });
    }

    if (!format) return `${formatKey}-${Date.now()}`;

    const now = new Date();
    let periodKey = 'ALL_TIME';
    if (format.resetCriteria === 'MONTHLY') {
      periodKey = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    } else if (format.resetCriteria === 'YEARLY') {
      periodKey = `${now.getFullYear()}`;
    } else if (format.resetCriteria === 'DAILY') {
      periodKey = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    }

    const counter = await this.prisma.cfgRunningCounter.upsert({
      where: {
        formatId_periodKey_companyId: {
          formatId: format.id,
          periodKey: periodKey,
          companyId: targetCompanyId || 0,
        },
      },
      update: { currentValue: { increment: 1 } },
      create: {
        formatId: format.id,
        periodKey: periodKey,
        companyId: targetCompanyId || 0,
        currentValue: 1,
      },
    });

    let code = format.formatPattern;
    code = code.replace(/{yyyy}/gi, now.getFullYear().toString());
    code = code.replace(/{yy}/gi, now.getFullYear().toString().slice(-2));
    code = code.replace(/{mm}/gi, (now.getMonth() + 1).toString().padStart(2, '0'));
    code = code.replace(/{dd}/gi, now.getDate().toString().padStart(2, '0'));

    const runningStr = counter.currentValue.toString().padStart(format.digitLength, '0');
    
    if (code.match(/{run}/gi)) {
      code = code.replace(/{run}/gi, runningStr);
    } else {
      code += runningStr;
    }

    return code;
  }
}