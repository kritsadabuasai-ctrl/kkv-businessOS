import { 
  Controller, Get, Post, Put, Body, Param, ParseIntPipe, Query, UseGuards, Request 
} from '@nestjs/common';
import { WfRequestService } from './wf-request.service';
import { CreateWfRequestDto, UpdateWfRequestDto } from './wf-request.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('workflow/requests')
export class WfRequestController {
  constructor(private readonly service: WfRequestService) {}

  @Post()
  @RequirePermissions('workflow_request:create')
  create(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Request() req, 
    @Body() dto: CreateWfRequestDto
  ) {
    // ใช้ userId จาก Token เป็นผู้ส่งคำขอ
    return this.service.create(companyId, req.user.userId, dto);
  }

 @Get()
  @RequirePermissions('workflow_request:view')
  findAll(
    @Request() req, // 🌟 1. เปลี่ยนมารับ Request จาก Token
    @Query('status') status?: string
  ) {
    const companyId = req.user.companyId; // 🌟 2. ดึง companyId ออกมาจาก Token
    return this.service.findAll(companyId, status);
  }

  @Get('my-inbox')
  @RequirePermissions('workflow_request:view')
  getMyInbox(@Request() req) {
    const companyId = req.user.companyId;
    const userId = Number(req.user.userId || req.user.sub || req.user.id);
    return this.service.getMyInbox(companyId, userId);
  }

  @Get(':id')
  @RequirePermissions('workflow_request:view')
  findOne(
    @Request() req, // 🌟 1. เปลี่ยนมารับ Request
    @Param('id', ParseIntPipe) id: number // 🌟 2. เหลือไว้แค่ id ของเอกสาร
  ) {
    const companyId = req.user.companyId; // 🌟 3. ดึง companyId ออกมาจาก Token
    return this.service.findOne(id, companyId);
  }

  
}