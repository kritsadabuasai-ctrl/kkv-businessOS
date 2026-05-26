import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRoomDto, CreateBookingDto, UpdateBookingStatusDto } from './meeting-room.dto';

@Injectable()
export class MeetingRoomService {
  constructor(private prisma: PrismaService) {}

  // --- Master: จัดการห้องประชุม ---
  async createRoom(companyId: number, dto: CreateRoomDto) {
    return this.prisma.admMeetingRoom.create({
      data: { ...dto, companyId }
    });
  }

  async findAllRooms(companyId: number) {
    return this.prisma.admMeetingRoom.findMany({
      where: { companyId, isActive: true }
    });
  }

  // --- Transaction: จัดการการจอง ---
  async createBooking(companyId: number, dto: CreateBookingDto) {
    // 1. ตรวจสอบการจองซ้ำ (Overlap Check)
    const overlap = await this.prisma.admMeetingBooking.findFirst({
      where: {
        roomId: dto.roomId,
        status: { in: ['APPROVED', 'PENDING_APPROVE'] },
        OR: [
          { startDateTime: { lt: new Date(dto.endDateTime) }, endDateTime: { gt: new Date(dto.startDateTime) } }
        ]
      }
    });

    if (overlap) throw new BadRequestException('ห้องประชุมไม่ว่างในช่วงเวลาที่ระบุ');

    // 2. บันทึกการจองพร้อมรายชื่อผู้เข้าร่วม
    return this.prisma.admMeetingBooking.create({
      data: {
        companyId,
        roomId: dto.roomId,
        requesterId: dto.requesterId,
        subject: dto.subject,
        description: dto.description,
        startDateTime: new Date(dto.startDateTime),
        endDateTime: new Date(dto.endDateTime),
        participantCount: dto.participantCount,
        isExternalGuest: dto.isExternalGuest,
        cateringDetails: dto.cateringDetails,
        status: 'PENDING_APPROVE', // [cite: 651]
        attendees: {
          create: dto.attendees?.map(attr => ({
            employeeId: attr.employeeId,
            externalName: attr.externalName,
            externalEmail: attr.externalEmail,
          }))
        }
      },
      include: { attendees: true }
    });
  }

  async findBookings(companyId: number, roomId?: number) {
    return this.prisma.admMeetingBooking.findMany({
      where: { companyId, roomId },
      include: { room: true, requester: true, attendees: true },
      orderBy: { startDateTime: 'asc' }
    });
  }
}