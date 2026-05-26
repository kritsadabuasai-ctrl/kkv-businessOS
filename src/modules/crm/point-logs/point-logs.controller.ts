import { Controller, Get, Post, Body, Param, UseGuards, Request, Query, ParseIntPipe } from '@nestjs/common';
import { PointLogsService } from './point-logs.service';
import { CreatePointAdjustmentDto } from './dto/create-point-adjustment.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('crm/point-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class PointLogsController {
  constructor(private readonly pointLogsService: PointLogsService) {}

  @Post()
  @RequirePermissions('crm_member:update')
  createAdjustment(@Request() req, @Body() dto: CreatePointAdjustmentDto) {
    // ส่ง companyId และ userId(คนที่ล็อกอิน) ไปให้ Service
    return this.pointLogsService.createAdjustment(req.user.companyId, req.user.id, dto);
  }

  @Get()
  @RequirePermissions('crm_member:view')
  findAll(
    @Request() req,
    @Query('action') action?: string,
  ) {
    // เรียกใช้ findAll ให้ตรงกับ Service
    return this.pointLogsService.findAll(req.user.companyId, action);
  }

  @Get('member/:memberId')
  @RequirePermissions('crm_member:view')
  findByMember(
    @Request() req,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    // เรียกใช้ findByMember ให้ตรงกับ Service
    return this.pointLogsService.findByMember(req.user.companyId, memberId);
  }
}