import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRoundingRuleDto, UpdateRoundingRuleDto } from './rounding-rules.dto';

@Injectable()
export class RoundingRulesService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 1. สร้างกฎใหม่ (เช็คซ้ำเฉพาะในระดับบริษัทตัวเอง)
  // =========================================================
  async create(companyId: number, dto: CreateRoundingRuleDto) {
    const existing = await this.prisma.cfgRoundingRule.findFirst({
      where: { companyId, code: dto.code },
    });

    if (existing) throw new ConflictException(`รหัสกฎการปัดเศษ '${dto.code}' มีอยู่แล้วในระบบของบริษัทคุณ`);

    const { ranges, ...data } = dto;

    return this.prisma.cfgRoundingRule.create({
      data: {
        ...data,
        companyId,
        ranges: ranges && ranges.length > 0 ? {
          create: ranges.map(r => ({
            minVal: r.minVal, maxVal: r.maxVal, result: r.result, sortOrder: r.sortOrder ?? 0
          }))
        } : undefined
      },
      include: { ranges: { orderBy: { sortOrder: 'asc' } } }
    });
  }

  // =========================================================
  // 2. ดูทั้งหมด (Merge ของส่วนกลาง เข้ากับ ของบริษัท)
  // =========================================================
  async findAll(companyId: number) {
    const rules = await this.prisma.cfgRoundingRule.findMany({
      where: { OR: [{ companyId: companyId }, { companyId: null }] },
      include: { ranges: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ code: 'asc' }],
    });

    const ruleMap = new Map();
    
    // 🌟 เอาของส่วนกลางใส่ลง Map ก่อน
    for (const r of rules.filter(x => x.companyId === null)) {
      ruleMap.set(r.code, r);
    }

    // 🌟 เอาของบริษัทใส่ทับทีหลัง (Override)
    for (const r of rules.filter(x => x.companyId !== null)) {
      ruleMap.set(r.code, r);
    }

    return Array.from(ruleMap.values());
  }

  // =========================================================
  // 3. ดูรายตัว (ป้องกันดูของบริษัทอื่น)
  // =========================================================
  async findOne(id: number, companyId: number) {
    const rule = await this.prisma.cfgRoundingRule.findUnique({
      where: { id },
      include: { ranges: { orderBy: { sortOrder: 'asc' } } },
    });
    
    // ยอมให้ดูได้ถ้าเป็นของบริษัทตัวเอง หรือเป็นของส่วนกลาง (null)
    if (!rule || (rule.companyId !== null && rule.companyId !== companyId)) {
      throw new NotFoundException('ไม่พบกฎการปัดเศษ หรือคุณไม่มีสิทธิ์เข้าถึง');
    }
    return rule;
  }

  // =========================================================
  // 🚀 ฟังก์ชันพิเศษ: สำหรับระบบหลังบ้านใช้คำนวณยอดเงิน (Global Fallback)
  // =========================================================
  async getEffectiveRule(code: string, companyId: number) {
    // 1. หาของบริษัทตัวเองก่อน
    let rule = await this.prisma.cfgRoundingRule.findFirst({
      where: { companyId, code, isActive: true },
      include: { ranges: { orderBy: { sortOrder: 'asc' } } },
    });

    // 2. ถ้าไม่เจอ ไปหาของส่วนกลาง
    if (!rule) {
      rule = await this.prisma.cfgRoundingRule.findFirst({
        where: { companyId: null, code, isActive: true },
        include: { ranges: { orderBy: { sortOrder: 'asc' } } },
      });
    }
    return rule; // (สามารถ return null ได้ถ้าระบบไม่ได้บังคับใช้)
  }

// =========================================================
  // 4. แก้ไข (พร้อมระบบ Copy-on-Write หากเผลอแก้ของส่วนกลาง)
  // =========================================================
  async update(id: number, companyId: number, dto: UpdateRoundingRuleDto, userId: number) {
    const rule = await this.findOne(id, companyId); 
    const { ranges, ...data } = dto;

    // 🌟 1. เช็คว่าคนที่กำลังแก้ คือ แอดมินบริษัทแม่ (HQ) หรือไม่?
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId },
      include: { company: true }
    });
    const isUserHQ = userRoles.some(ur => ur.company?.licenseHolderId === null);

    // 🌟 2. ถ้านี่คือ Master Rule (ของส่วนกลาง)
    if (rule.companyId === null) {
      
      // 👑 กรณีที่เป็น HQ: อัปเดตทับของส่วนกลางได้เลย
      if (isUserHQ) {
        return this.prisma.cfgRoundingRule.update({
          where: { id },
          data: {
            ...data,
            ranges: ranges ? {
              deleteMany: {}, // ล้างช่วงเก่าของส่วนกลางทิ้ง
              create: ranges.map(r => ({
                minVal: r.minVal, maxVal: r.maxVal, result: r.result, sortOrder: r.sortOrder ?? 0
              }))
            } : undefined
          },
          include: { ranges: { orderBy: { sortOrder: 'asc' } } }
        });
      }
      
      // 🏢 กรณีเป็นสาขาทั่วไป: ปั๊มเป็นของบริษัทตัวเองแทน (Copy-on-Write)
      return this.prisma.cfgRoundingRule.create({
        data: {
          code: rule.code,
          name: data.name ?? rule.name,
          type: data.type ?? rule.type,
          digitIndex: data.digitIndex ?? rule.digitIndex,
          isActive: data.isActive ?? rule.isActive,
          companyId: companyId,
          
          // 🌟 ปรับตรงนี้: ถ้าส่ง ranges มาให้ใช้ของใหม่ ถ้าไม่ส่งมา ให้ก๊อปปี้ ranges ของเก่า (rule.ranges) ไปด้วย
          ranges: {
            create: (ranges && ranges.length > 0 ? ranges : rule.ranges).map(r => ({
              minVal: r.minVal, 
              maxVal: r.maxVal, 
              result: r.result, 
              sortOrder: r.sortOrder ?? 0
            }))
          }

        },
        include: { ranges: { orderBy: { sortOrder: 'asc' } } }
      });
    }

    // 🌟 3. ถ้าเป็นของบริษัทตัวเองอยู่แล้ว (ไม่ได้พยายามแก้ของส่วนกลาง)
    // ก็ Update และ Replace Ranges ทับไปได้เลย
    return this.prisma.cfgRoundingRule.update({
      where: { id },
      data: {
        ...data,
        ranges: ranges ? {
          deleteMany: {}, // ล้างกฎเก่า
          create: ranges.map(r => ({ // ใส่กฎใหม่
            minVal: r.minVal, maxVal: r.maxVal, result: r.result, sortOrder: r.sortOrder ?? 0
          }))
        } : undefined
      },
      include: { ranges: { orderBy: { sortOrder: 'asc' } } }
    });
  }

  // =========================================================
  // 5. ลบ (ป้องกันลบของส่วนกลาง)
  // =========================================================
  async remove(id: number, companyId: number) {
    const rule = await this.findOne(id, companyId); 
    
    if (rule.companyId === null) {
      throw new BadRequestException('ไม่สามารถลบกฎการปัดเศษมาตรฐานของส่วนกลางได้ แนะนำให้ใช้วิธีปิดการใช้งาน (isActive = false) แทน');
    }

    return this.prisma.cfgRoundingRule.delete({ where: { id } });
  }
}