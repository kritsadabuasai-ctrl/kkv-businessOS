import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateHrCalendarDto, UpdateHrCalendarDto, CreateHrHolidayDto } from './hr-calendar.dto';

@Injectable()
export class HrCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async createCalendar(companyId: number, dto: CreateHrCalendarDto) {
    const existing = await this.prisma.hrCalendar.findFirst({
      where: { companyId, year: dto.year, type: dto.type }
    });
    if (existing) throw new BadRequestException(`มีปฏิทินปี ${dto.year} ประเภท ${dto.type} อยู่ในระบบแล้ว`);

    return await this.prisma.hrCalendar.create({
      data: { 
        ...dto, 
        companyId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate)
      }
    });
  }

  async updateCalendar(id: number, companyId: number, dto: UpdateHrCalendarDto) {
    // 1. ตรวจสอบว่ามีปฏิทินนี้อยู่จริงและเป็นของบริษัทนี้
    const calendar = await this.prisma.hrCalendar.findFirst({
      where: { id, companyId }
    });
    
    if (!calendar) {
      throw new NotFoundException('ไม่พบปฏิทินที่ระบุ');
    }

    // 2. อัปเดตข้อมูล
    return await this.prisma.hrCalendar.update({
      where: { id },
      data: {
        ...dto,
        // ถ้ามีการส่งวันที่มาใหม่ ให้แปลงเป็น Date object
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) })
      }
    });
  }

  async findAllCalendars(companyId: number) {
    return await this.prisma.hrCalendar.findMany({
      where: { companyId },
      // 🚩 เปลี่ยนการนับจาก holidays เป็น holidayGroups ให้ตรงกับ Schema ใหม่
      include: { _count: { select: { holidayGroups: true } } },
      orderBy: { year: 'desc' }
    });
  }

  async findCalendarById(id: number, companyId: number) {
    const calendar = await this.prisma.hrCalendar.findFirst({
      where: { id, companyId },
      // 🚩 ดึงข้อมูล Group ที่ผูกกับปฏิทินนี้
      include: { holidayGroups: true }
    });
    if (!calendar) throw new NotFoundException('ไม่พบปฏิทินที่ระบุ');
    return calendar;
  }




}