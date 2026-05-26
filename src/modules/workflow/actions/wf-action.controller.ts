import { 
  Controller, Post, Get, Body, Param, ParseIntPipe, UseGuards, Request 
} from '@nestjs/common';
import { WfActionService } from './wf-action.service';
import { CreateWfActionDto } from './wf-action.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
@Controller('workflow/actions')
export class WfActionController {
  constructor(private readonly service: WfActionService) {}

  // 1. ส่งผลการอนุมัติ (Approve / Reject)
  @Post()
  @RequirePermissions('workflow_request:create') // หรือใช้ชื่ออื่นตาม Permission ที่คุณออกแบบ
  create(@Request() req, @Body() dto: CreateWfActionDto) {
    // ส่ง companyId ไปเพื่อตรวจสอบสิทธิ์ความเป็นเจ้าของ
    return this.service.create(req.user.companyId, req.user.userId, dto);
  }

  // 2. ดูประวัติการอนุมัติของ Request นี้
  @Get('history/:requestId')
  @RequirePermissions('workflow_request:view')
  getHistory(
    @Request() req, 
    @Param('requestId', ParseIntPipe) requestId: number
  ) {
    return this.service.getHistory(req.user.companyId, requestId);
  }
}