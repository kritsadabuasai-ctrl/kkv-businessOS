import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GenerateRosterDto } from './roster.dto';

@Injectable()
export class RosterService {
  constructor(private prisma: PrismaService) {}

  async generateRoster(companyId: number, dto: GenerateRosterDto) {
    // 🚩 จุดที่ 1: เปลี่ยนจาก details เป็น items (หรือชื่อที่ตรงกับใน schema.prisma)
    const pattern = await this.prisma.hrWorkPattern.findFirst({
      where: { id: dto.patternId, companyId },
      include: { items: { orderBy: { dayIndex: 'asc' } } } // 👈 แก้ตรงนี้
    });
    if (!pattern) throw new NotFoundException('ไม่พบรูปแบบการทำงาน (Work Pattern)');

    // 🚩 จุดที่ 2: เติม : any[] เพื่อแก้ Error never[]
    let holidays: any[] = []; // 👈 แก้ตรงนี้
    if (dto.holidayGroupId) {
      holidays = await this.prisma.hrHoliday.findMany({
        where: { groupId: dto.holidayGroupId }
      });
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) throw new BadRequestException('วันที่เริ่มต้นต้องน้อยกว่าวันที่สิ้นสุด');

    return await this.prisma.$transaction(async (tx) => {
      const roster = await tx.hrRoster.create({
        data: {
          companyId,
          code: dto.code,
          name: dto.name,
          patternId: dto.patternId,
          holidayGroupId: dto.holidayGroupId,
          startDate,
          endDate,
        }
      });

      // 🚩 จุดที่ 3: เติม : any[] เพื่อแก้ Error never[]
      const detailsData: any[] = []; // 👈 แก้ตรงนี้
      let currentDate = new Date(startDate);
      let daysPassed = 0; 

      while (currentDate <= endDate) {
        const cycleOffset = (daysPassed + (dto.startDayIndex - 1)) % pattern.cycleDays;
        const currentDayIndex = cycleOffset + 1; 

        // 🚩 จุดที่ 4: เปลี่ยนจาก pattern.details เป็น pattern.items
        const targetDetail = pattern.items.find(d => d.dayIndex === currentDayIndex); // 👈 แก้ตรงนี้

        const currentIsoDate = currentDate.toISOString().split('T')[0];
        const holidayMatch = holidays.find(h => 
          h.date.toISOString().split('T')[0] === currentIsoDate
        );

        detailsData.push({
          rosterId: roster.id,
          companyId,
          date: new Date(currentDate),
          shiftId: targetDetail?.shiftId || null, 
          isHoliday: !!holidayMatch,
          holidayId: holidayMatch?.id || null,
          holidayName: holidayMatch?.name || null
        });

        currentDate.setDate(currentDate.getDate() + 1);
        daysPassed++;
      }

      await tx.hrRosterDetail.createMany({
        data: detailsData
      });

      return await tx.hrRoster.findUnique({
        where: { id: roster.id },
        include: { details: { orderBy: { date: 'asc' }, include: { shift: true } } }
      });
    });
  }

  // =========================================================
  // ดึงข้อมูล Roster ทั้งหมดของบริษัท
  // =========================================================
  async findAll(companyId: number) {
    return await this.prisma.hrRoster.findMany({
      where: { companyId },
      include: {
        pattern: true,        // ดึงชื่อ Work Pattern มาแสดงด้วย
        holidayGroup: true,   // ดึงชื่อกลุ่มวันหยุดมาแสดงด้วย
      },
      orderBy: { startDate: 'desc' } // เรียงจากอันใหม่ล่าสุดขึ้นก่อน
    });
  }
}