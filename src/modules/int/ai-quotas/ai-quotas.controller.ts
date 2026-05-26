import { Controller, Get, Put, Body, UseGuards, Request, Param, ParseIntPipe } from '@nestjs/common';
import { AiQuotasService } from './ai-quotas.service';
import { UpdateQuotaDto } from './dto/ai-quota.dto'; 
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 ต้อง Login และมีสิทธิ์ก่อนเข้าใช้งาน
@Controller('int/ai-quotas')
export class AiQuotasController {
  constructor(private readonly service: AiQuotasService) {}

  /**
   * 1. สำหรับ User ทั่วไปดูสถานะโควตาของบริษัทตนเอง
   * 🎫 สิทธิ์: int:ai:view
   */
  @Get('my-status')
  @RequirePermissions('int:ai:view') // ✅ ใช้สิทธิ์ View ตามมาตรฐาน 4 ขุนพล
  getQuota(@Request() req) {
    return this.service.getQuota(req.user.companyId);
  }

  /**
   * 2. สำหรับ Admin จัดการปรับปรุงโควตา (เช่น เพิ่มพื้นที่ หรือจำนวนข้อความ)
   * 🎫 สิทธิ์: int:ai:update 
   */
  @Put('manage/:companyId')
  @RequirePermissions('int:ai:update') // ✅ เปลี่ยนจาก sys:admin เป็น int:ai:update เพื่อให้ตรงกับ Seed
  update(
    @Param('companyId', ParseIntPipe) companyId: number, 
    @Body() dto: UpdateQuotaDto
  ) {
    return this.service.updateQuota(companyId, dto);
  }
}