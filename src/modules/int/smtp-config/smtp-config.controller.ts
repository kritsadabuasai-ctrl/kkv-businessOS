import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { SmtpConfigService } from './smtp-config.service';
import { UpsertSmtpConfigDto } from './smtp-config.dto';

// 🌟 นำเข้า 3 ทหารเสือเพื่อความปลอดภัย
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('int/smtp-configs')
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🛡️ ด่านแรก: ต้อง Login และมีระบบเช็คสิทธิ์
export class SmtpConfigController {
  constructor(private readonly smtpService: SmtpConfigService) {}

  // =========================================================
  // 1. ดึงข้อมูลการตั้งค่า SMTP
  // =========================================================
  @Get('me')
  @RequirePermissions('smtp_config:view') // 🔍 ด่านสอง: ต้องมีสิทธิ์อ่านการตั้งค่า
  async getMyConfig(@Request() req, @Query('shopId') shopId?: string) {
    const companyId = req.user.companyId; // ดึงจาก Token ที่ผ่าน Guard มาแล้ว
    const parsedShopId = shopId ? parseInt(shopId, 10) : null;
    
    return this.smtpService.getConfig(companyId, parsedShopId);
  }

  // =========================================================
  // 2. บันทึกหรืออัปเดตการตั้งค่า SMTP
  // =========================================================
  @Post('me')
  @RequirePermissions('smtp_config:update') // 🔍 ด่านสอง: ต้องมีสิทธิ์แก้ไขการตั้งค่า
  async updateMyConfig(@Request() req, @Body() dto: UpsertSmtpConfigDto) {
    const companyId = req.user.companyId; // ดึงจาก Token
    
    return this.smtpService.upsertConfig(companyId, dto);
  }
}