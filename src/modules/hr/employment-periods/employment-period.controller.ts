import { 
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Request
} from '@nestjs/common';
import { EmploymentPeriodService } from './employment-period.service';
import { CreateEmploymentPeriodDto, UpdateEmploymentPeriodDto } from './employment-period.dto';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';

@Controller('hr/employment-periods')
@UseGuards(JwtAuthGuard,SubscriptionGuard,PermissionsGuard)
export class EmploymentPeriodController {
  constructor(private readonly service: EmploymentPeriodService) {}

  // =========================================================
  // 1. ดูรายการทั้งหมด
  // GET /hr/employment-periods?employeeId=1  -> ดูเฉพาะของคนนี้
  // GET /hr/employment-periods               -> ดูของทั้งบริษัท (รวมทุกคน)
  // =========================================================
  @Get()
  @RequirePermissions('employee:view')
  getAll(@Query('employeeId') employeeId: string, @Request() req) {
    if (employeeId) {
      return this.service.getPeriodsByEmployee(req.user.companyId, parseInt(employeeId));
    }
    // ✅ แก้ไข: ดึงทั้งหมดของบริษัทแทนการ return []
    return this.service.getAllPeriods(req.user.companyId);
  }

  // 2. ดูรายละเอียดรายอัน
  @Get(':id')
  @RequirePermissions('employee:view')
  getOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.getPeriodById(req.user.companyId, id);
  }

  // 3. เพิ่มประวัติ
  @Post()
  @RequirePermissions('employee:update')
  create(@Body() dto: CreateEmploymentPeriodDto, @Request() req) {
    return this.service.createPeriod(req.user.companyId, dto);
  }

  // 4. แก้ไข
  @Put(':id')
  @RequirePermissions('employee:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmploymentPeriodDto,
    @Request() req
  ) {
    return this.service.updatePeriod(req.user.companyId, id, dto);
  }

  // 5. ลบ
  @Delete(':id')
  @RequirePermissions('employee:update')
  delete(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.deletePeriod(req.user.companyId, id);
  }
}