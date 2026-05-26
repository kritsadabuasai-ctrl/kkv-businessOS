import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePositionSeatDto } from './position-seat.dto';

@Injectable()
export class PositionSeatService {
  constructor(private prisma: PrismaService) {}

  async createSeat(dto: CreatePositionSeatDto) {
    // ✅ 1. ตรวจสอบและบังคับ Type ให้เป็น number อย่างชัดเจน (แก้ปัญหา TS2322)
    if (!dto.companyId) {
      throw new BadRequestException('Company ID is required');
    }
    const companyId = dto.companyId;

    // ✅ 2. เช็คว่าเลขที่ตำแหน่งซ้ำในบริษัทไหม โดยใช้ตัวแปร companyId ที่แกะ Type มาแล้ว
    const existing = await this.prisma.hrPositionSeat.findUnique({
      where: {
        companyId_seatNumber: { companyId, seatNumber: dto.seatNumber },
      },
    });

    if (existing) {
      throw new ConflictException(`เลขที่ตำแหน่ง '${dto.seatNumber}' มีอยู่ในระบบแล้ว`);
    }

    // ✅ 3. สร้างตำแหน่งใหม่
    return this.prisma.hrPositionSeat.create({
      data: {
        companyId, // ส่งเป็น number แน่นอนแล้ว
        positionVerId: dto.positionVerId,
        seatNumber: dto.seatNumber,
        status: 'VACANT', // เริ่มต้นต้องเป็นเก้าอี้ว่าง
      },
    });
  }

  async assignEmployee(companyId: number, seatId: number, employeeId: number) {
    const seat = await this.prisma.hrPositionSeat.findFirst({
      where: { id: seatId, companyId },
    });

    if (!seat) throw new NotFoundException('ไม่พบเลขที่ตำแหน่งนี้');
    if (seat.status === 'FROZEN') throw new BadRequestException('ไม่สามารถบรรจุคนลงในอัตราที่ถูกระงับได้');
    if (seat.currentEmployeeId && seat.currentEmployeeId !== employeeId) {
      throw new BadRequestException('ตำแหน่งนี้มีผู้ดำรงตำแหน่งอยู่แล้ว');
    }

    // ทำ Transaction: อัปเดตเก้าอี้
    return this.prisma.$transaction([
      this.prisma.hrPositionSeat.update({
        where: { id: seatId },
        data: { currentEmployeeId: employeeId, status: 'OCCUPIED' },
      })
      // พื้นที่สำหรับเขียน Logic อัปเดตตาราง JobHistory ของ Employee ต่อไปในอนาคต
    ]);
  }

  async updateStatus(companyId: number, seatId: number, status: string) {
    // ✅ ค้นหาด้วย findFirst ก่อนเพื่อยืนยันว่าเป็นข้อมูลของบริษัทนั้นจริงๆ (Data Isolation)
    const seat = await this.prisma.hrPositionSeat.findFirst({
        where: { id: seatId, companyId }
    });

    if (!seat) {
        throw new NotFoundException('ไม่พบเลขที่ตำแหน่งนี้');
    }

    // ✅ ใช้ id อัปเดต เนื่องจาก where ใน update ของ Prisma ต้องเป็น Unique Key
    return this.prisma.hrPositionSeat.update({
        where: { id: seatId },
        data: { status }
    });
  }

  // 1. ดึงรายการเก้าอี้ตำแหน่งทั้งหมดในบริษัท (พร้อม Filter)
async findAll(companyId: number, positionVerId?: number) {
  return this.prisma.hrPositionSeat.findMany({
    where: { 
      companyId,
      ...(positionVerId && { positionVerId }) // ถ้าส่ง ID เวอร์ชันตำแหน่งมาให้ Filter ด้วย
    },
    include: {
      currentEmployee: {
        select: { id: true, firstName: true, lastName: true } // ดึงชื่อคนนั่งมาโชว์ที่หน้า List
      }
    },
    orderBy: { seatNumber: 'asc' }
  });
}

// 2. ดึงรายละเอียดเก้าอี้ตัวเดียว
async findOne(companyId: number, id: number) {
  const seat = await this.prisma.hrPositionSeat.findFirst({
    where: { id, companyId },
    include: { currentEmployee: true }
  });
  if (!seat) throw new NotFoundException('ไม่พบข้อมูลเลขที่ตำแหน่ง');
  return seat;
}

// 3. การลบเก้าอี้ตำแหน่ง
async remove(companyId: number, id: number) {
  const seat = await this.findOne(companyId, id);
  
  // Logic ป้องกัน: ถ้ามีคนนั่งอยู่ (OCCUPIED) ไม่ควรให้ลบจนกว่าจะย้ายคนออก
  if (seat.status === 'OCCUPIED') {
    throw new BadRequestException('ไม่สามารถลบตำแหน่งที่มีผู้ดำรงตำแหน่งอยู่ได้ กรุณาย้ายพนักงานออกก่อน');
  }

  return this.prisma.hrPositionSeat.delete({
    where: { id }
  });
}
}