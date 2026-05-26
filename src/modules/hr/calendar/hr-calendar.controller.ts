import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { HrCalendarService } from './hr-calendar.service';
import { CreateHrCalendarDto, UpdateHrCalendarDto } from './hr-calendar.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. เพิ่ม Import PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';

@Controller('hr/calendars')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) // 🔒 2. ใส่ Guard คุมให้ครบ 3 ชั้น
export class HrCalendarController {
  constructor(private readonly service: HrCalendarService) {}

  @Post()
  @RequirePermissions('hr:calendar:create')
  create(@Request() req, @Body() dto: CreateHrCalendarDto) {
    return this.service.createCalendar(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('hr:calendar:view')
  findAll(@Request() req) {
    return this.service.findAllCalendars(req.user.companyId);
  }

  @Put(':id')
  @RequirePermissions('hr:calendar:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHrCalendarDto,
  ) {
    return this.service.updateCalendar(id, req.user.companyId, dto);
  }

  @Get(':id')
  @RequirePermissions('hr:calendar:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findCalendarById(id, req.user.companyId);
  }
}