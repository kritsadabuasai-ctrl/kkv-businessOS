import { 
  Controller, Get, Post, Put, Body, Param, ParseIntPipe, Query, UseGuards, Request ,Patch
} from '@nestjs/common';
import { WfRequestService } from './wf-request.service';
import { CreateWfRequestDto, UpdateWfRequestDto } from './wf-request.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { WfActionService } from '../actions/wf-action.service'; 
import { CreateWfActionDto } from '../actions/wf-action.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('workflow/requests')
export class WfRequestController {
 constructor(
    private readonly service: WfRequestService,
    private readonly actionService: WfActionService 
  ) {}

  @Post()
  @RequirePermissions('workflow_request:create')
  create(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Request() req, 
    @Body() dto: CreateWfRequestDto
  ) {
    return this.service.create(companyId, req.user.userId, dto);
  }

  @Get()
  @RequirePermissions('workflow_request:view')
  findAll(
    @Request() req, 
    @Query('status') status?: string
  ) {
    const companyId = req.user.companyId; 
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
    @Request() req, 
    @Param('id', ParseIntPipe) id: number 
  ) {
    const companyId = req.user.companyId; 
    return this.service.findOne(id, companyId);
  }

  // 🌟 จุดที่แก้ไขบั๊ก: ต้องเรียก actionService ไม่ใช่ service
  @Patch(':id/action')
  @RequirePermissions('workflow_request:create')
  processAction(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateWfActionDto
  ) {
    dto.requestId = id; 
    // 🛑 แก้ไขบรรทัดนี้ ให้เรียก this.actionService แทน this.service
    return this.actionService.create(req.user.companyId, req.user.userId, dto);
  }
}