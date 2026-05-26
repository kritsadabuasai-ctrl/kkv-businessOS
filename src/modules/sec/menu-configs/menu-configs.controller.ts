import { Controller, Get, Put, Body, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { MenuConfigsService } from './menu-configs.service';
import { UpdateMenuConfigDto } from './menu-configs.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard,SubscriptionGuard) // 🔒 2. เพิ่ม PermissionsGuard ควบคู่กับ JWT
@Controller('sec/menu-configs')
export class MenuConfigsController {
  constructor(private readonly service: MenuConfigsService) {}

  /**
   * 1. ดึงปุ่มลัด (Shortcuts) สำหรับ Dashboard
   * 🎫 สิทธิ์: menu:view
   */
  @Get('shortcuts')
  @RequirePermissions('menu:view') 
  getShortcuts(@Request() req) {
    return this.service.findShortcuts(req.user.companyId);
  }

  /**
   * 2. ตั้งค่าการแสดงผลเมนูรายบริษัท (เช่น ซ่อนเมนู, ย้ายตำแหน่ง, ตั้งปุ่มลัด)
   * 🎫 สิทธิ์: menu:update
   */
  @Put(':menuId')
  @RequirePermissions('menu:update') 
  updateConfig(
    @Request() req,
    @Param('menuId', ParseIntPipe) menuId: number,
    @Body() dto: UpdateMenuConfigDto
  ) {
    // 🛡️ ส่ง companyId ไปเสมอ ป้องกันการข้ามไปแก้ Config ของบริษัทอื่น
    return this.service.upsertConfig(req.user.companyId, menuId, dto);
  }
}