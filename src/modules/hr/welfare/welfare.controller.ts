import { Controller, Get, Post, Body, Param, ParseIntPipe, Request, UseGuards, Query } from '@nestjs/common';
import { WelfareService } from './welfare.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { CreateWelfareTypeDto, CreateWelfarePolicyDto, CreateWelfareRequestDto } from './welfare.dto';

@Controller('hr/welfare')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class WelfareController {
  constructor(private readonly service: WelfareService) {}

  // Master: ประเภทสวัสดิการ
  @Post('types')
  @RequirePermissions('welfare:create')
  createType(@Request() req, @Body() dto: CreateWelfareTypeDto) {
    return this.service.createType(req.user.companyId, dto);
  }

  @Get('types')
  @RequirePermissions('welfare:view')
  getTypes(@Request() req) {
    return this.service.findAllTypes(req.user.companyId);
  }

  // Config: นโยบายวงเงิน
  @Post('policies')
  @RequirePermissions('welfare:create')
  createPolicy(@Request() req, @Body() dto: CreateWelfarePolicyDto) {
    return this.service.createPolicy(req.user.companyId, dto);
  }

  @Get('policies')
  @RequirePermissions('welfare:view')
  getPolicies(@Request() req, @Query('year') year: string) {
    return this.service.findPolicies(req.user.companyId, parseInt(year));
  }

  // Transaction: การเบิกสวัสดิการ
  @Post('requests')
  @RequirePermissions('welfare:create')
  createRequest(@Request() req, @Body() dto: CreateWelfareRequestDto) {
    return this.service.createRequest(req.user.companyId, dto);
  }

  @Get('requests')
  @RequirePermissions('welfare:view')
  getAllRequests(@Request() req) {
    return this.service.findAllRequests(req.user.companyId);
  }
}