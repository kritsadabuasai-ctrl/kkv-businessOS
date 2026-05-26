import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  ParseIntPipe, 
  UseGuards, 
  Request 
} from '@nestjs/common';
import { WfModuleMappingService } from './wf-module-mapping.service';
import { CreateWfModuleMappingDto, UpdateWfModuleMappingDto } from './wf-module-mapping.dto';

// ✅ นำเข้า Security Guards และ Decorators
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('workflow/wf-mappings')
@UseGuards(JwtAuthGuard, SubscriptionGuard, PermissionsGuard)
export class WfModuleMappingController {
  constructor(private readonly mappingService: WfModuleMappingService) {}

  // 1. สร้างการจับคู่ใหม่ (POST /workflow/wf-mappings)
  @Post()
  @RequirePermissions('workflow_setup:create')
  create(
    @Request() req,
    @Body() createDto: CreateWfModuleMappingDto,
  ) {
    // 🛡️ ดึง companyId จาก Token เพื่อความปลอดภัย
    const companyId = req.user.companyId;
    return this.mappingService.create(companyId, createDto);
  }

  // 2. ดึงข้อมูลทั้งหมดของบริษัท (GET /workflow/wf-mappings)
  @Get()
  @RequirePermissions('workflow_setup:view')
  findAll(@Request() req) {
    const companyId = req.user.companyId;
    return this.mappingService.findAll(companyId);
  }

  // 3. ดึงข้อมูลรายอัน (GET /workflow/wf-mappings/:id)
  @Get(':id')
  @RequirePermissions('workflow_setup:view')
  findOne(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const companyId = req.user.companyId;
    return this.mappingService.findOne(companyId, id);
  }

  // 4. แก้ไขข้อมูล (PATCH /workflow/wf-mappings/:id)
  @Patch(':id')
  @RequirePermissions('workflow_setup:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateWfModuleMappingDto,
  ) {
    const companyId = req.user.companyId;
    return this.mappingService.update(companyId, id, updateDto);
  }

  // 5. ลบข้อมูล (DELETE /workflow/wf-mappings/:id)
  @Delete(':id')
  @RequirePermissions('workflow_setup:delete')
  remove(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const companyId = req.user.companyId;
    return this.mappingService.remove(companyId, id);
  }
}