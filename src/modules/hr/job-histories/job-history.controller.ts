import { 
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Request
} from '@nestjs/common';
import { JobHistoryService } from './job-history.service';
import { CreateJobHistoryDto, UpdateJobHistoryDto } from './job-history.dto';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';

@Controller('hr/job-histories')
@UseGuards(JwtAuthGuard,SubscriptionGuard,PermissionsGuard)
export class JobHistoryController {
  constructor(private readonly service: JobHistoryService) {}

  // 1. ดูประวัติการทำงาน (กรองตามพนักงาน หรือ ดูทั้งหมด)
  @Get()
  @RequirePermissions('employee:view')
  getAll(@Query('employeeId') employeeId: string, @Request() req) {
    if (employeeId) {
      return this.service.getByEmployee(req.user.companyId, parseInt(employeeId));
    }
    // ✅ ปรับปรุง: ถ้าไม่ระบุคน ให้ดึง Log การโยกย้ายทั้งหมดของบริษัท
    return this.service.getAllHistories(req.user.companyId);
  }

  // 2. ดูรายละเอียดรายชิ้น
  @Get(':id')
  @RequirePermissions('employee:view')
  getOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.getById(req.user.companyId, id);
  }

  // 3. เพิ่มการโยกย้าย/เลื่อนตำแหน่ง
  @Post()
  @RequirePermissions('employee:update')
  create(@Body() dto: CreateJobHistoryDto, @Request() req) {
    return this.service.createJobHistory(req.user.companyId, dto);
  }

  // 4. แก้ไขข้อมูลย้อนหลัง
  @Put(':id')
  @RequirePermissions('employee:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJobHistoryDto,
    @Request() req
  ) {
    return this.service.updateJobHistory(req.user.companyId, id, dto);
  }

  // 5. ลบประวัติ
  @Delete(':id')
  @RequirePermissions('employee:update')
  delete(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.deleteJobHistory(req.user.companyId, id);
  }

// 🌟 เพิ่ม Endpoint สำหรับรองรับการลากวาง (Drag & Drop) จัดการผู้ดูแลแผนก
@Post('assign-manager')
@RequirePermissions('employee:update')
async assignManager(@Body() dto: any, @Request() req) {
  // dto จะรับค่า: employeeId, targetDepartmentId, actionType, effectiveDate, remarks
  return this.service.assignDepartmentManager(req.user.companyId, dto);
  }
}