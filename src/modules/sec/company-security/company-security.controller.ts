import { Controller, Get, Post, Body, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { CompanySecurityService } from './company-security.service';
import { UpdateSecurityConfigDto } from './dto/security-config.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sec/company-security')
export class CompanySecurityController {
  constructor(private readonly service: CompanySecurityService) {}

  /**
   * 1. เช็คเงื่อนไขความปลอดภัยก่อนเข้าเมนู (เช่น ต้องเปลี่ยน Password ก่อนไหม)
   * 🔓 ไม่ต้องใช้ RequirePermissions เพราะพนักงานทุกคนต้องสามารถเช็คสถานะตัวเองได้
   */
  @Get('check/:menuId')
  // ❌ ลบ @RequirePermissions ออกเพื่อให้ Guard ปล่อยผ่าน
  checkMenu(@Request() req, @Param('menuId', ParseIntPipe) menuId: number) {
    return this.service.checkRequirement(req.user.companyId, menuId);
  }

  /**
   * 2. ตั้งค่านโยบายความปลอดภัยของบริษัท (เช่น Password Policy, Session Timeout)
   * 🎫 เปลี่ยนมาใช้สิทธิ์: role:update
   */
  @Post('config')
  @RequirePermissions('company-security:update') // 🌟 แก้เป็น role:update
  updateConfig(@Request() req, @Body() dto: UpdateSecurityConfigDto) {
    return this.service.upsertConfig(req.user.companyId, dto);
  }

  /**
   * 3. ดูนโยบายความปลอดภัยทั้งหมดของบริษัท
   * 🎫 เปลี่ยนมาใช้สิทธิ์: role:view
   */
  @Get('all')
  @RequirePermissions('company-security:view') // 🌟 แก้เป็น role:view
  getAll(@Request() req) {
    return this.service.findAllByCompany(req.user.companyId);
  }
}