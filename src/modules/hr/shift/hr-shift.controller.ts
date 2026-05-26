import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { HrShiftService } from './hr-shift.service';
import { CreateHrShiftDto, UpdateHrShiftDto } from './hr-shift.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('hr/shifts')
export class HrShiftController {
  constructor(private readonly service: HrShiftService) {}

  @Post()
  @RequirePermissions('hr:shift:create')
  create(@Request() req, @Body() dto: CreateHrShiftDto) {
    return this.service.create(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('hr:shift:view')
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  @Get(':id')
  @RequirePermissions('hr:shift:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Put(':id')
  @RequirePermissions('hr:shift:update')
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHrShiftDto) {
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @RequirePermissions('hr:shift:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user.companyId);
  }
}