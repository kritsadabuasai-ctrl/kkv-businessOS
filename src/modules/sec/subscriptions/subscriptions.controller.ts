import { 
  Controller, Get, Put, Body, Param, Query, 
  UseGuards, Request, ParseIntPipe 
} from '@nestjs/common';
import { OrgSubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('sec/subscriptions')
export class OrgSubscriptionsController {
  constructor(private readonly service: OrgSubscriptionsService) {}

  /**
   * 📊 1. ดึงข้อมูลสรุป Subscription ของบริษัทต่างๆ (ตามสิทธิ์การมองเห็น HQ/Reseller)
   */
  @Get('summary')
  @RequirePermissions('subscription:view')
  getSummary(
    @Request() req,
    @Query('companyId') queryCompanyId?: string
  ) {
    // แปลงค่า Query ถ้าส่งมาเป็น 'all' หรือ 'null' ให้กลายเป็น undefined 
    // เพื่อให้ Service ไปกวาดข้อมูลทุกบริษัทในเครือข่ายแทน
    const targetCompanyId = (queryCompanyId && queryCompanyId !== 'all' && queryCompanyId !== 'null') 
      ? parseInt(queryCompanyId) 
      : undefined;

    // ส่ง req.user ไปให้ Service คำนวณขอบเขตเครือข่าย (Licensed Group)
    return this.service.getSummary(targetCompanyId, req.user);
  }

  /**
   * 📜 2. ดึงประวัติการทำรายการ (Billing History) ของแต่ละบริษัท
   */
  @Get(':companyId/history')
  @RequirePermissions('subscription:view')
  getHistory(
    @Request() req,
    @Param('companyId', ParseIntPipe) companyId: number
  ) {
    // Service จะทำหน้าที่ดักจับ (Throw Error) เองหากเป็นการขอข้อมูลข้ามเครือข่าย
    return this.service.getBillingHistory(companyId, req.user);
  }

  /**
   * 📝 3. อัปเดตแพ็กเกจ โมดูล และต่ออายุ (รองรับ Trial / Billing History / Quota Sync)
   */
  @Put(':companyId')
  @RequirePermissions('subscription:update')
  updateSubscription(
    @Request() req,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: { 
      moduleIds: number[], 
      packageId?: number, 
      endDate?: string | null,
      status?: string // รองรับสถานะ ACTIVE, TRIAL
    }
  ) {
    // ส่ง req.user ไปให้ Service ทำ Security Check และดึง ID ไปบันทึกในตารางประวัติ (Operator)
    return this.service.updateSubscription(companyId, dto, req.user);
  }
}