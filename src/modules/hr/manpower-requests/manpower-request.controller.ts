import { 
  Controller, Get, Post, Put, Delete, Body, Param, 
  ParseIntPipe, Request, UseGuards 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ManpowerRequestService } from './manpower-request.service';
import { CreateManpowerRequestDto } from './dto/create-manpower-request.dto';
import { UpdateManpowerRequestDto } from './dto/update-manpower-request.dto';

import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@ApiTags('HR - Manpower Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('hr/manpower-requests')
export class ManpowerRequestController {
  constructor(private readonly manpowerRequestService: ManpowerRequestService) {}

  @Post()
  @ApiOperation({ summary: 'สร้างใบขออนุมัติอัตรากำลัง (Draft)' })
  @RequirePermissions('manpower_request:create')
  create(@Request() req, @Body() createDto: CreateManpowerRequestDto) {
    return this.manpowerRequestService.create(req.user.companyId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'ดูรายการใบขออัตรากำลังทั้งหมด' })
  @RequirePermissions('manpower_request:read')
  findAll(@Request() req) {
    return this.manpowerRequestService.findAll(req.user.companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'ดูรายละเอียดใบขออัตรากำลังรายตัว' })
  @RequirePermissions('manpower_request:read')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.manpowerRequestService.findOne(req.user.companyId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'แก้ไขใบขออัตรากำลัง (เฉพาะสถานะ Draft)' })
  @RequirePermissions('manpower_request:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateManpowerRequestDto,
    @Request() req
  ) {
    return this.manpowerRequestService.update(req.user.companyId, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบใบขออัตรากำลัง' })
  @RequirePermissions('manpower_request:delete')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.manpowerRequestService.remove(req.user.companyId, id);
  }

  @Post(':id/submit-workflow')
  @ApiOperation({ summary: 'ส่งใบขออัตรากำลังเข้าสู่ระบบ Workflow' })
  @RequirePermissions('manpower_request:submit') 
  submitWorkflow(@Param('id', ParseIntPipe) id: number, @Request() req) {
    // 🌟 [แก้ไข] ส่ง req.user.id เพิ่มเข้าไปด้วยเพื่อให้รู้ว่าใครเป็นคนกดขออนุมัติ (Requester)
    return this.manpowerRequestService.submitToWorkflow(req.user.companyId, id, req.user.id);
  }
}