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

 // ==========================================================
  // ⚡ 2. API สำหรับการกดอนุมัติ (Action)
  // ==========================================================
  @Patch('requests/:id/action')
  @RequirePermissions('workflow_request:create') // หรือ 'workflow:update' ตามสมควร
  async takeAction(
    @Request() req,
    @Param('id', ParseIntPipe) requestId: number,
    @Body() body: { action: 'APPROVE' | 'REJECT'; comment?: string }
  ) {
    // 🛡️ Security: ดึง userId และ companyId จาก Token
    const userId = req.user.id || req.user.userId;
    const companyId = req.user.companyId;

    // ✅ เปลี่ยนจาก .takeAction เป็น .processAction ให้ตรงกับ Service
    return this.service.processAction(
      companyId,
      userId,
      requestId,
      body.action,
      body.comment
    );
  }
}