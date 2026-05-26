import { Controller, Get, Post, Delete,Put,Query, Body, Param, ParseIntPipe, Request, UseGuards } from '@nestjs/common';
import { PositionSeatService } from './position-seat.service';
import { CreatePositionSeatDto, AssignSeatDto, UpdateSeatStatusDto } from './position-seat.dto';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('hr/position-seats')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class PositionSeatController {
  constructor(private readonly service: PositionSeatService) {}

  @Post()
  @RequirePermissions('position_seat:create')
  create(@Body() dto: CreatePositionSeatDto, @Request() req) {
    dto.companyId = req.user.companyId;
    return this.service.createSeat(dto);
  }

  // API สำหรับจับคนมานั่งเก้าอี้
  @Put(':id/assign')
  @RequirePermissions('position_seat:update')
  assignEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignSeatDto,
    @Request() req
  ) {
    return this.service.assignEmployee(req.user.companyId, id, dto.employeeId);
  }

  // API สำหรับอัปเดตสถานะ (เช่น ระงับอัตรา)
  @Put(':id/status')
  @RequirePermissions('position_seat:update')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSeatStatusDto,
    @Request() req
  ) {
    return this.service.updateStatus(req.user.companyId, id, dto.status);
  }

  @Get()
@RequirePermissions('position_seat:view')
findAll(@Request() req, @Query('positionVerId') positionVerId?: string) {
  return this.service.findAll(
    req.user.companyId, 
    positionVerId ? parseInt(positionVerId) : undefined
  );
}

@Get(':id')
@RequirePermissions('position_seat:view')
findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
  return this.service.findOne(req.user.companyId, id);
}

@Delete(':id')
@RequirePermissions('position_seat:delete')
remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
  return this.service.remove(req.user.companyId, id);
}
}