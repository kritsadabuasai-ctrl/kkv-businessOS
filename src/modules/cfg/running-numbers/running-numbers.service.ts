import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRunningFormatDto, UpdateRunningFormatDto } from './running-numbers.dto';

@Injectable()
export class RunningNumbersService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 🛡️ Helper: คำนวณหา Company ID (ถ้าเป็น HQ จะส่งค่า Null กลับไปเพื่อแก้ส่วนกลาง)
  // =========================================================
  private async getRequestCompanyId(user: any): Promise<number | null> {
    if (!user || !user.companyId) return null;
    
    const company = await this.prisma.orgCompany.findUnique({
      where: { id: Number(user.companyId) },
      select: { licenseHolderId: true }
    });

    const isHQ = company?.licenseHolderId === null;
    if (isHQ && user.isSuperAdmin) {
      return null; // ระดับ HQ + Super Admin ให้จัดการข้อมูลส่วนกลาง (Global)
    }
    return Number(user.companyId); 
  }

  // =========================================================

  // 1. ดูทั้งหมด (Merge ข้อมูลส่วนกลาง กับ ข้อมูล Override ของบริษัท)
  async findAll(user: any) {
    const companyId = await this.getRequestCompanyId(user);

    // ดึงข้อมูลส่วนกลางทั้งหมด
    const globalFormats = await this.prisma.cfgRunningFormat.findMany({
      where: { companyId: null }
    });

    if (companyId === null) {
      return globalFormats.sort((a, b) => a.docCode.localeCompare(b.docCode));
    }

    // ดึงข้อมูลเฉพาะของบริษัทตัวเอง
    const myFormats = await this.prisma.cfgRunningFormat.findMany({
      where: { companyId: companyId }
    });

    // นำมา Merge กัน (เอาของบริษัททับของส่วนกลาง ถ้า docCode ตรงกัน)
    const combined = globalFormats.map(gf => {
      const override = myFormats.find(mf => mf.docCode === gf.docCode);
      return override ? override : gf;
    });

    // เพิ่มรูปแบบที่บริษัทอาจจะสร้างขึ้นมาเองเดี่ยวๆ 
    const myOnly = myFormats.filter(mf => !globalFormats.some(gf => gf.docCode === mf.docCode));
    
    return [...combined, ...myOnly].sort((a, b) => a.docCode.localeCompare(b.docCode));
  }

  // 2. ดูรายตัว
  async findOne(id: number) {
    const format = await this.prisma.cfgRunningFormat.findUnique({ where: { id } });
    if (!format) throw new NotFoundException('ไม่พบรูปแบบ Running Number');
    return format;
  }

  // 3 & 4. สร้างหรืออัปเดต (ระบบ Override แก้ไขปัญหา Prisma Nullable Unique)
  async upsertFormat(dto: CreateRunningFormatDto | UpdateRunningFormatDto, user: any) {
    const companyId = await this.getRequestCompanyId(user);

    // 🌟 1. หาข้อมูลของบริษัทตัวเองก่อน
    const existing = await this.prisma.cfgRunningFormat.findFirst({
      where: { 
        docCode: dto.docCode, 
        companyId: companyId 
      }
    });

    // 🌟 2. ถ้าบริษัทตัวเองมีอยู่แล้ว ให้ทำการ Update ทับไปเลย
    if (existing) {
      return this.prisma.cfgRunningFormat.update({
        where: { id: existing.id }, 
        data: {
          docName: dto.docName,
          formatPattern: dto.formatPattern,
          digitLength: dto.digitLength,
          resetCriteria: dto.resetCriteria,
          isActive: (dto as any).isActive ?? existing.isActive // ใช้ค่าเดิมถ้าไม่ส่งมา
        }
      });
    }

    // 🌟 3. ถ้ายังไม่มี (กำลังจะ Copy-on-Write) ให้แอบไปดูต้นฉบับ Global ก่อนเผื่อขาดข้อมูล
    let globalRef: any = null; // ใช้วิธีที่ง่ายที่สุดคือเติม : any เข้าไปครับ

    if (companyId !== null) { // ถ้าไม่ใช่ HQ กำลังสร้างใหม่
      globalRef = await this.prisma.cfgRunningFormat.findFirst({
        where: { docCode: dto.docCode, companyId: null }
      });
    }

    // 🌟 4. สร้าง Record ใหม่ (Merge ข้อมูลที่ส่งมา เข้ากับ ต้นฉบับ Global)
    return this.prisma.cfgRunningFormat.create({
      data: {
        companyId: companyId,
        docCode: dto.docCode,
        // ดึงจาก DTO -> ถ้าไม่มีดึงจาก Global -> ถ้าไม่มีใช้อันตั้งต้น
        docName: dto.docName ?? globalRef?.docName ?? dto.docCode,
        formatPattern: dto.formatPattern ?? globalRef?.formatPattern ?? 'DOC-{yy}{mm}-{run}',
        digitLength: dto.digitLength ?? globalRef?.digitLength ?? 4,
        resetCriteria: dto.resetCriteria ?? globalRef?.resetCriteria ?? 'MONTHLY',
        isActive: (dto as any).isActive ?? globalRef?.isActive ?? true
      }
    });
  }

  // 5. ลบ (ป้องกันการลบข้อมูลส่วนกลาง และการลบที่ถูกใช้งานไปแล้ว)
  async remove(id: number, user: any) {
    const format = await this.findOne(id);
    const companyId = await this.getRequestCompanyId(user);

    if (format.companyId !== companyId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ลบรูปแบบของส่วนกลาง แนะนำให้ใช้วิธีปิดการใช้งาน (isActive = false) แทน');
    }
    
    const usageCount = await this.prisma.cfgRunningCounter.count({
      where: { formatId: id }
    });

    if (usageCount > 0) {
      throw new BadRequestException('ไม่สามารถลบได้ เนื่องจากมีการรันเลขที่เอกสารไปแล้ว แนะนำให้ปิดการใช้งาน (isActive = false) แทน');
    }

    return this.prisma.cfgRunningFormat.delete({ where: { id } });
  }

  // 🚀 6. ฟังก์ชันขอเลขถัดไป (Global Fallback Algorithm)
  async generateNextNumber(companyId: number, docCode: string): Promise<string> {
    const targetCompanyId = companyId || null;

    // 6.1 หาของบริษัทตัวเองก่อน (ใช้ findFirst แทน findUnique)
    let format = await this.prisma.cfgRunningFormat.findFirst({
      where: { 
        docCode: docCode, 
        companyId: targetCompanyId 
      },
    });

    // 6.2 ถ้าไม่เจอ ให้ Fallback ถอยไปหาค่าตั้งต้นของส่วนกลาง
    if (!format && targetCompanyId !== null) {
      format = await this.prisma.cfgRunningFormat.findFirst({
        where: { 
          docCode: docCode, 
          companyId: null 
        },
      });
    }

    if (!format) throw new NotFoundException(`ไม่พบการตั้งค่า Running Format สำหรับเอกสาร ${docCode}`);
    if (!format.isActive) throw new BadRequestException(`รูปแบบ Running Format ของ ${docCode} ถูกปิดการใช้งานอยู่`);

    const now = new Date();
    const periodKey = this.generatePeriodKey(now, format.resetCriteria as any);

    // 6.3 ตัวนับ (Counter) จะถูกบันทึกแยกรายบริษัทเสมอ (0 = ระบบส่วนกลาง)
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

    // 6.4 แทนที่คีย์ด้วยวันที่ปัจจุบัน (รองรับตัวพิมพ์เล็ก-ใหญ่ ด้วย Regex /gi)
    let result = format.formatPattern
      .replace(/{yyyy}/gi, now.getFullYear().toString())
      .replace(/{yy}/gi, now.getFullYear().toString().slice(-2))
      .replace(/{mm}/gi, (now.getMonth() + 1).toString().padStart(2, '0'))
      .replace(/{dd}/gi, now.getDate().toString().padStart(2, '0'));

    result += counter.currentValue.toString().padStart(format.digitLength, '0');
    return result;
  }

  // ฟังก์ชันจัดรูปแบบ Period Key ให้สอดคล้องกับเงื่อนไขการรีเซ็ต
  private generatePeriodKey(date: Date, criteria: string): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');

    if (criteria === 'DAILY') return `${y}${m}${d}`;
    if (criteria === 'MONTHLY') return `${y}${m}`;
    if (criteria === 'YEARLY') return `${y}`;
    return 'GLOBAL'; // สำหรับ NEVER
  }
}