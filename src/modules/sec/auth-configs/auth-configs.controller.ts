import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, Query, ForbiddenException } from '@nestjs/common';
import { AuthConfigsService } from './auth-configs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard'; 
import { SubscriptionGuard } from '../auth/subscription.guard'; // 🌟 อัญเชิญทหารเสือคนที่ 4
import { Public } from '../auth/public.decorator';

@Controller('sec/auth-configs')
export class AuthConfigsController {
  constructor(private readonly service: AuthConfigsService) {}

  // =========================================================
  // 🌟 ส่วนของ Super Admin (ตั้งค่าส่วนกลาง)
  // =========================================================
  
  @Get('sys')
  @UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) // 🔒 คุมให้ครบ 3 ชั้น
  @RequirePermissions('auth:view') 
  getSystemProviders(@Request() req) {
    // 🌟 ส่ง req.user ไปให้ Service ตรวจสอบสิทธิ์แบบเข้มข้น
    return this.service.getSystemProviders(req.user);
  }

  @Patch('sys/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
  @RequirePermissions('auth:update') 
  updateSystemProvider(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: any 
  ) {
    // 🌟 ส่ง req.user ไปให้ Service ตรวจสอบสิทธิ์แบบเข้มข้น
    return this.service.updateSystemProvider(id, dto, req.user);
  }

  // =========================================================
  // 🏢 ส่วนของ Company Admin (ตั้งค่าระดับบริษัท)
  // =========================================================

  @Get('my-config')
  @UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
  @RequirePermissions('auth:view')
  getMyConfig(@Request() req, @Query('companyId') selectedCompanyId?: string) {
    // 🛡️ ป้องกัน IDOR แอบดู Config (Client Secret) ของบริษัทอื่น
    const targetCompanyId = (req.user.isSuperAdmin && selectedCompanyId) 
      ? Number(selectedCompanyId) 
      : req.user.companyId;

    return this.service.getMyConfig(targetCompanyId);
  }

  @Post('my-config')
  @UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
  @RequirePermissions('auth:update')
  updateMyConfig(@Request() req, @Body() dto: any) {
    // 🛡️ ป้องกัน IDOR แอบแก้ Config ของบริษัทอื่น
    const targetCompanyId = (req.user.isSuperAdmin && dto.companyId) 
      ? Number(dto.companyId) 
      : req.user.companyId;

    return this.service.updateMyConfig(targetCompanyId, dto);
  }

  // =========================================================
  // 🌐 ส่วนของหน้า Login (Public - ไม่ต้องมี Guard)
  // =========================================================

  @Public() 
  @Get('login-options')
  getLoginOptions(@Query('cid') cid: string) {
    if (!cid) return [];
    return this.service.getLoginOptions(Number(cid));
  }
}