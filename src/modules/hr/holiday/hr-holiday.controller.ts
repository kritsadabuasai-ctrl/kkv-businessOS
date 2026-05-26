import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request, ParseIntPipe, Query, Patch } from '@nestjs/common';
import { HrHolidayService } from './hr-holiday.service';
import { 
  CreateHrHolidayGroupDto, UpdateHrHolidayGroupDto, 
  CreateHrHolidayDto, UpdateHrHolidayDto, CopyHrHolidayGroupDto
} from './hr-holiday.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('hr/holidays')
export class HrHolidayController {
  constructor(private readonly service: HrHolidayService) {}

  @Post('groups')
  @RequirePermissions('hr:calendar:create')
  createGroup(@Request() req, @Body() dto: CreateHrHolidayGroupDto) {
    return this.service.createGroup(req.user.companyId, dto);
  }

  @Get('groups')
  @RequirePermissions('hr:calendar:view')
  findAllGroups(@Request() req, @Query('calendarId') calendarId?: string) {
    return this.service.findAllGroups(req.user.companyId, calendarId ? parseInt(calendarId) : undefined);
  }

  @Get('groups/:id')
  @RequirePermissions('hr:calendar:view')
  findGroupById(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findGroupById(id, req.user.companyId);
  }

  @Patch('groups/:id/publish')
  @RequirePermissions('hr:calendar:update')
  publishGroup(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.publishGroup(id, req.user.companyId);
  }

  @Put('groups/:id')
  @RequirePermissions('hr:calendar:update')
  updateGroup(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHrHolidayGroupDto) {
    return this.service.updateGroup(id, req.user.companyId, dto);
  }

  @Delete('groups/:id')
  @RequirePermissions('hr:calendar:delete')
  removeGroup(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.removeGroup(id, req.user.companyId);
  }

  @Post('groups/clone')
  @RequirePermissions('hr:calendar:create')
  cloneGroup(@Request() req, @Body() dto: CopyHrHolidayGroupDto) {
    return this.service.cloneHolidayGroup(req.user.companyId, dto);
  }

  @Post('items')
  @RequirePermissions('hr:calendar:create')
  createHoliday(@Request() req, @Body() dto: CreateHrHolidayDto) {
    return this.service.createHoliday(req.user.companyId, dto);
  }

  @Put('items/:id')
  @RequirePermissions('hr:calendar:update')
  updateHoliday(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHrHolidayDto) {
    return this.service.updateHoliday(id, req.user.companyId, dto);
  }

  @Delete('items/:id')
  @RequirePermissions('hr:calendar:delete')
  removeHoliday(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.removeHoliday(id, req.user.companyId);
  }
}