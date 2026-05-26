import { 
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Request 
} from '@nestjs/common';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { CreateWorkflowDefinitionDto, UpdateWorkflowDefinitionDto } from './workflow-definition.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
@Controller('workflow/definitions')
export class WorkflowDefinitionController {
  constructor(private readonly service: WorkflowDefinitionService) {}

  // 1. ดูรายการ Workflow (เฉพาะของบริษัทตัวเอง)
  @Get()
  @RequirePermissions('workflow_setup:view')
  findAll(@Request() req, @Query('active') active?: string) {
    const isActiveOnly = active === 'true';
    // ✅ ส่ง companyId ไป
    return this.service.findAll(req.user.companyId, isActiveOnly);
  }

  // 2. ดูรายละเอียด (เช็คความเป็นเจ้าของใน Service)
  @Get(':id')
  @RequirePermissions('workflow_setup:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    // ✅ ส่ง companyId ไปเพื่อเช็คสิทธิ์ว่าห้ามดูของบริษัทอื่น
    return this.service.findOne(id, req.user.companyId);
  }

  // 3. สร้าง Workflow ใหม่ (ผูกบริษัทอัตโนมัติ)
  @Post()
  @RequirePermissions('workflow_setup:create')
  create(@Request() req, @Body() dto: CreateWorkflowDefinitionDto) {
    return this.service.create(req.user.companyId, dto);
  }

  // 4. แก้ไข
  @Put(':id')
  @RequirePermissions('workflow_setup:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkflowDefinitionDto
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  // 5. ลบ
  @Delete(':id')
  @RequirePermissions('workflow_setup:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user.companyId);
  }
}