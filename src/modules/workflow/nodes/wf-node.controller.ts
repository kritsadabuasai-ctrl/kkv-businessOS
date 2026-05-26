import { 
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Request 
} from '@nestjs/common';
import { WfNodeService } from './wf-node.service';
import { CreateWfNodeDto, UpdateWfNodeDto } from './wf-node.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 2. ล็อกประตูและเช็คสิทธิ์ระดับ Class
@Controller('workflow/nodes')
export class WfNodeController {
  constructor(private readonly service: WfNodeService) {}

  /**
   * 1. ดู Node ทั้งหมดของ Workflow นี้
   * GET /workflow/nodes?workflowId=1
   */
  @Get()
  @RequirePermissions('workflow_setup:view')
  findAll(@Request() req, @Query('workflowId', ParseIntPipe) workflowId: number) {
    // 🛡️ ส่ง companyId จาก Token ไปเช็คสิทธิ์ความเป็นเจ้าของ Workflow
    return this.service.findAllByWorkflow(workflowId, req.user.companyId);
  }

  /**
   * 2. ดูรายละเอียด Node เดียว
   */
  @Get(':id')
  @RequirePermissions('workflow_setup:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    // 🛡️ ส่ง companyId ไปเช็คสิทธิ์ความเป็นเจ้าของ Node
    return this.service.findOne(id, req.user.companyId);
  }

  /**
   * 3. สร้าง Node ใหม่
   */
  @Post()
  @RequirePermissions('workflow_setup:create')
  create(@Request() req, @Body() dto: CreateWfNodeDto) {
    // 🛡️ ส่ง companyId ไปล็อกไม่ให้สร้าง Node ใน Workflow ของบริษัทอื่น
    return this.service.create(dto, req.user.companyId);
  }

  /**
   * 4. แก้ไขข้อมูล Node
   */
 @Put(':id')
  @RequirePermissions('workflow_setup:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWfNodeDto
  ) {
    // 🌟 สลับให้ req.user.companyId เป็นตัวที่ 2 และ dto เป็นตัวที่ 3 [cite: 1]
    return this.service.update(id, req.user.companyId, dto); 
  }

  /**
   * 5. ลบ Node ออกจากกระบวนการ
   */
  @Delete(':id')
  @RequirePermissions('workflow_setup:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    // 🛡️ ส่ง companyId ไปตรวจสอบสิทธิ์ก่อนอนุญาตให้ลบ
    return this.service.remove(id, req.user.companyId);
  }
}