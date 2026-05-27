import { Controller, Get, Post, Body, Query, UseGuards, Param, ParseIntPipe, Patch, Request } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../sec/auth/jwt-auth.guard'; // ✅ ปรับ Path ให้ตรง
import { RequirePermissions } from '../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../sec/auth/permissions.guard'; // 🌟 นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../sec/auth/subscription.guard';

@Controller('workflow') // ✅ แนะนำใช้ workflow ให้เป็นมาตรฐานเดียวกัน
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 ล็อกประตูและเช็คสิทธิ์
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  // ==========================================================
  // 📋 1. API ให้หน้าบ้านดึง List ไปใส่ Dropdown
  // ==========================================================
  // Usage: GET /workflow/options?docType=PO
  @Get('options')
  @RequirePermissions('workflow:view')
  async getOptions(
    @Request() req, 
    @Query('docType') docType: string
  ) {
    // 🛡️ Security: ใช้ companyId จาก Token ของผู้ที่ Login อยู่เท่านั้น
    const companyId = req.user.companyId;
    return this.service.getAvailableWorkflows(companyId, docType);
  }

 
}