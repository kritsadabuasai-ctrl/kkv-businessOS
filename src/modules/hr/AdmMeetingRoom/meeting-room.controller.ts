import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, Request, UseGuards, Query } from '@nestjs/common';
import { MeetingRoomService } from './meeting-room.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard'; // 🌟 1. เพิ่ม Import SubscriptionGuard
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { CreateRoomDto, CreateBookingDto, UpdateBookingStatusDto } from './meeting-room.dto';

@Controller('adm/meeting-rooms')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) // 🔒 2. ใส่ Guard คุมให้ครบ 3 ชั้น
export class MeetingRoomController {
  constructor(private readonly service: MeetingRoomService) {}

  @Post()
  @RequirePermissions('meeting_room:create')
  createRoom(@Request() req, @Body() dto: CreateRoomDto) {
    return this.service.createRoom(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('meeting_room:view')
  getRooms(@Request() req) {
    return this.service.findAllRooms(req.user.companyId);
  }

  @Post('bookings')
  @RequirePermissions('meeting_room:create')
  createBooking(@Request() req, @Body() dto: CreateBookingDto) {
    return this.service.createBooking(req.user.companyId, dto);
  }

  @Get('bookings')
  @RequirePermissions('meeting_room:view')
  getBookings(@Request() req, @Query('roomId') roomId?: string) {
    return this.service.findBookings(
      req.user.companyId, 
      roomId ? parseInt(roomId) : undefined
    );
  }
}