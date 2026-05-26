import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { 
  CreateHrHolidayGroupDto, UpdateHrHolidayGroupDto, 
  CreateHrHolidayDto, UpdateHrHolidayDto,
  CopyHrHolidayGroupDto 
} from './hr-holiday.dto';
import { HolidayGroupStatus, HolidayCategory } from '@prisma/client';

@Injectable()
export class HrHolidayService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // HOLIDAY GROUP METHODS (MASTER)
  // ==========================================
  async createGroup(companyId: number, dto: CreateHrHolidayGroupDto) {
    const existing = await this.prisma.hrHolidayGroup.findFirst({
      where: { companyId, calendarId: dto.calendarId, code: dto.code }
    });
    if (existing) throw new BadRequestException(`รหัสกลุ่มวันหยุด ${dto.code} มีอยู่แล้วในปฏิทินนี้`);

    return await this.prisma.hrHolidayGroup.create({
      data: { ...dto, companyId, status: HolidayGroupStatus.DRAFT }
    });
  }

  async findAllGroups(companyId: number, calendarId?: number) {
    return await this.prisma.hrHolidayGroup.findMany({
      where: { companyId, ...(calendarId && { calendarId }) },
      include: { calendar: true, _count: { select: { holidays: true } } },
      orderBy: { code: 'asc' }
    });
  }

  async findGroupById(id: number, companyId: number) {
    const group = await this.prisma.hrHolidayGroup.findFirst({
      where: { id, companyId },
      include: { holidays: { orderBy: { date: 'asc' } } }
    });
    if (!group) throw new NotFoundException('ไม่พบกลุ่มวันหยุดที่ระบุ');
    return group;
  }

  async publishGroup(id: number, companyId: number) {
    const group = await this.findGroupById(id, companyId);
    if (group.status !== HolidayGroupStatus.DRAFT) {
      throw new BadRequestException('กลุ่มวันหยุดนี้ถูกประกาศใช้ไปแล้ว');
    }
    return await this.prisma.hrHolidayGroup.update({
      where: { id },
      data: { status: HolidayGroupStatus.PUBLISHED, publishedAt: new Date() }
    });
  }

  async updateGroup(id: number, companyId: number, dto: UpdateHrHolidayGroupDto) {
    const group = await this.findGroupById(id, companyId);
    if (group.status === HolidayGroupStatus.PUBLISHED) {
      throw new BadRequestException('ไม่สามารถแก้ไขหัวข้อกลุ่มที่ประกาศใช้แล้วได้');
    }
    return await this.prisma.hrHolidayGroup.update({ where: { id }, data: dto });
  }

  async removeGroup(id: number, companyId: number) {
    const group = await this.findGroupById(id, companyId);
    if (group.status === HolidayGroupStatus.PUBLISHED) {
      throw new BadRequestException('ไม่สามารถลบกลุ่มที่ประกาศใช้แล้วได้');
    }
    return await this.prisma.hrHolidayGroup.delete({ where: { id } });
  }

  // ==========================================
  // HOLIDAY DETAIL METHODS (DETAIL)
  // ==========================================
  async createHoliday(companyId: number, dto: CreateHrHolidayDto) {
    const group = await this.findGroupById(dto.groupId, companyId);
    const holidayDate = new Date(dto.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 🚩 Logic: ถ้า Published แล้ว
    if (group.status === HolidayGroupStatus.PUBLISHED) {
      if (holidayDate < today) throw new BadRequestException('ไม่สามารถเพิ่มวันหยุดย้อนหลังในกลุ่มที่ประกาศแล้วได้');
      // บังคับเป็น SPECIAL สำหรับการเพิ่มทีหลัง
      dto.category = HolidayCategory.SPECIAL;
    }

    const existing = await this.prisma.hrHoliday.findFirst({
      // 🌟 อัปเดต: เพิ่มการเช็ค companyId ให้ตรงกับ Schema ที่แก้ใหม่
      where: { companyId, groupId: dto.groupId, date: holidayDate }
    });
    if (existing) throw new BadRequestException('มีวันหยุดในวันที่นี้อยู่แล้ว');

    return await this.prisma.hrHoliday.create({
      // 🌟 อัปเดต: บันทึก companyId ลงไปในตารางลูกด้วย
      data: { ...dto, companyId, date: holidayDate } 
    });
  }

  async updateHoliday(id: number, companyId: number, dto: UpdateHrHolidayDto) {
    const holiday = await this.prisma.hrHoliday.findFirst({
      // 🌟 อัปเดต: ค้นหาจาก companyId ของตารางตัวเองได้เลย (เร็วกว่าเดิม)
      where: { id, companyId }, 
      include: { group: true }
    });
    if (!holiday) throw new NotFoundException('ไม่พบวันหยุด');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 🚩 Logic: ถ้า Published แล้ว และเป็นวันในอดีต ห้ามแก้
    if (holiday.group.status === HolidayGroupStatus.PUBLISHED && holiday.date < today) {
      throw new BadRequestException('ไม่สามารถแก้ไขวันหยุดที่ผ่านมาแล้วได้');
    }

    const updateData: any = { ...dto };
    if (dto.date) updateData.date = new Date(dto.date);

    return await this.prisma.hrHoliday.update({ where: { id }, data: updateData });
  }

  async removeHoliday(id: number, companyId: number) {
    const holiday = await this.prisma.hrHoliday.findFirst({
      // 🌟 อัปเดต: ค้นหาจาก companyId ของตารางตัวเองได้เลย
      where: { id, companyId },
      include: { group: true }
    });
    if (!holiday) throw new NotFoundException('ไม่พบวันหยุด');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (holiday.group.status === HolidayGroupStatus.PUBLISHED && holiday.date < today) {
      throw new BadRequestException('ไม่สามารถลบวันหยุดที่ผ่านมาแล้วได้');
    }

    return await this.prisma.hrHoliday.delete({ where: { id } });
  }

  // ==========================================
  // CLONE FEATURE
  // ==========================================
  async cloneHolidayGroup(companyId: number, dto: CopyHrHolidayGroupDto) {
    const sourceGroup = await this.prisma.hrHolidayGroup.findFirst({
      where: { id: dto.sourceGroupId, companyId },
      include: { holidays: true }
    });
    if (!sourceGroup) throw new NotFoundException('ไม่พบชุดวันหยุดต้นทาง');

    const targetCalendar = await this.prisma.hrCalendar.findFirst({
      where: { id: dto.targetCalendarId, companyId }
    });
    if (!targetCalendar) throw new NotFoundException('ไม่พบปฏิทินปลายทาง');

    return await this.prisma.$transaction(async (tx) => {
      const newGroup = await tx.hrHolidayGroup.create({
        data: {
          companyId,
          calendarId: dto.targetCalendarId,
          code: dto.newCode,
          nameTh: dto.newNameTh,
          nameEn: dto.newNameEn || sourceGroup.nameEn,
          isCompensateWhenOffDay: sourceGroup.isCompensateWhenOffDay,
          status: HolidayGroupStatus.DRAFT // Clone มาเป็น Draft เสมอ
        }
      });

      if (sourceGroup.holidays.length > 0) {
        const newHolidays = sourceGroup.holidays.map(h => ({
          companyId: companyId, // 🌟 อัปเดต: ยัด companyId ลงตารางลูกตอน Clone ด้วย
          groupId: newGroup.id,
          date: new Date(targetCalendar.year, h.date.getMonth(), h.date.getDate()),
          nameTh: h.nameTh,
          nameEn: h.nameEn,
          category: h.category,
          isActive: h.isActive
        }));
        await tx.hrHoliday.createMany({ data: newHolidays });
      }
      return newGroup;
    });
  }
}