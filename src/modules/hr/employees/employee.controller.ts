import { 
  Controller, Get, Post, Put, Patch, Body, Param, ParseIntPipe, Query, Request, UseGuards ,Delete
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { 
  CreateEmployeeDto, 
  UpdateEmployeeDto, 
  ResignEmployeeDto, 
  RehireEmployeeDto, 
  CancelResignationDto 
} from './employee.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('hr/employees')
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 2. ใส่ PermissionsGuard คุมประตู
export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}

 @Post()
  @RequirePermissions('employee:create')
  create(@Body() dto: CreateEmployeeDto, @Request() req) {
    // ✅ ส่ง req.user.companyId แยกเป็น Argument ตัวแรกให้ตรงกับที่ Service ต้องการ
    return this.service.create(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('employee:view')
  findAll(@Request() req, @Query() query: any) {
    return this.service.findAll(req.user.companyId, query); // ✅ ปลอดภัย
  }

@Post('assign-manager')
@RequirePermissions('employee:update') // ใช้สิทธิ์การแก้ไขข้อมูลพนักงาน
async assignManager(@Request() req, @Body() dto: any) {
  // dto จะรับค่า: employeeId, targetDepartmentId, actionType, effectiveDate, remarks, roleType
  return this.service.assignDepartmentManager(req.user.companyId, dto);
}

  // 🌟 API สำหรับ Dropdown ค้นหาหัวหน้างาน / พนักงาน
  @Get('search-dropdown')
  @RequirePermissions('employee:view') 
  searchDropdown(
    @Request() req, 
    @Query('q') keyword?: string,
    @Query('departmentId') departmentId?: string,
    @Query('positionId') positionId?: string
  ) {
    return this.service.searchActiveEmployeesForDropdown(
      req.user.companyId, 
      keyword,
      departmentId ? parseInt(departmentId) : undefined,
      positionId ? parseInt(positionId) : undefined
    );
  }

  // 🛡️ SECURITY FIX: เพิ่ม @Request() req และส่ง companyId เข้าไปในฟังก์ชันด้านล่างทั้งหมด
  @Get(':id')
  @RequirePermissions('employee:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(req.user.companyId, id);
  }

  @Put(':id')
  @RequirePermissions('employee:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto
  ) {
    return this.service.update(req.user.companyId, id, dto);
  }

  @Patch(':id/resign')
  @RequirePermissions('employee:update')
  resign(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResignEmployeeDto
  ) {
    return this.service.resign(req.user.companyId, id, dto);
  }

  @Patch(':id/rehire')
  @RequirePermissions('employee:update')
  rehire(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RehireEmployeeDto
  ) {
    return this.service.rehire(req.user.companyId, id, dto);
  }

  @Patch(':id/cancel-resignation')
  @RequirePermissions('employee:update')
  cancelResignation(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelResignationDto
  ) {
    return this.service.cancelResignation(req.user.companyId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('employee:update') // 🛡️ ตรวจสอบสิทธิ์ (ใช้สิทธิ์ update หรือ delete ตามที่ตั้งไว้ในระบบ)
  remove(
    @Request() req,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.service.remove(req.user.companyId, id);
  }
}