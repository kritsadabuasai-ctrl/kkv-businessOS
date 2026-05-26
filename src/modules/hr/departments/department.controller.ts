import { 
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Request
} from '@nestjs/common';
import { DepartmentService } from './department.service';
import { 
  CreateDepartmentDto, 
  UpdateDepartmentDto, 
  UpdateDepartmentTreeDto 
} from './department.dto';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('hr/departments')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class DepartmentController {
  constructor(private readonly service: DepartmentService) {}

  // 🌟 1. ดึงข้อมูลรูปแบบ Tree (ย้ายมาบนสุดเพื่อไม่ให้ชนกับ :id)
  @Get('tree')
  @RequirePermissions('department:view')
  getTree(@Request() req) {
    // ดึงข้อมูลบริษัทจาก Token แล้วสั่งให้ Service ประกอบเป็น Tree ทันที
    return this.service.getAllDepartments(req.user.companyId, true);
  }

  // 2. ดูรายชื่อแผนกทั้งหมด (แบบ List ปกติ หรือส่ง Query ?tree=true ก็ได้)
  @Get()
  @RequirePermissions('department:view')
  getAll(
    @Request() req,
    @Query('tree') tree?: string 
  ) {
    const isTree = tree === 'true';
    return this.service.getAllDepartments(req.user.companyId, isTree);
  }

  // 3. อัปเดตโครงสร้าง Tree (ย้ายตำแหน่ง/จัดเรียง)
  // ต้องอยู่เหนือ Put(':id') เสมอ
  @Put('update-tree')
  @RequirePermissions('department:update')
  updateTree(@Body() dto: UpdateDepartmentTreeDto, @Request() req) {
    return this.service.updateDepartmentTree(req.user.companyId, dto.treeUpdates);
  }

  // 4. สร้างแผนกใหม่
  @Post()
  @RequirePermissions('department:create')
  create(@Body() dto: CreateDepartmentDto, @Request() req) {
    dto.companyId = req.user.companyId;
    return this.service.createDepartment(dto);
  }

  // 🌟 5. ดูรายละเอียด (Dynamic Path :id ต้องอยู่ล่างสุดของชุด Get)
  @Get(':id')
  @RequirePermissions('department:view')
  getOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.getDepartmentById(req.user.companyId, id);
  }

  // 6. แก้ไขข้อมูลแผนก
  @Put(':id')
  @RequirePermissions('department:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
    @Request() req
  ) {
    return this.service.updateDepartment(req.user.companyId, id, dto);
  }

  // 7. ลบแผนก
  @Delete(':id')
  @RequirePermissions('department:delete')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.deleteDepartment(req.user.companyId, id);
  }

  // 🌟 8. อัปเดตอัตรากำลังของแผนก (Headcount)
  @Put(':id/positions')
  @RequirePermissions('department:update')
  updatePositions(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any, // 👈 เปลี่ยนมารับแบบยืดหยุ่น (any) ก่อน
    @Request() req
  ) {
    // 🛡️ ดักทางเผื่อหน้าบ้านส่งมาเป็น { positions: [...] } หรือเป็น Array [...] มาตรงๆ
    const positionsArray = Array.isArray(body) ? body : (body?.positions || []);
    
    return this.service.updateDepartmentPositions(req.user.companyId, id, positionsArray);
  }

  // 🌟 9. ดึงอัตรากำลังของแผนก (GET)
  @Get(':id/positions')
  @RequirePermissions('department:view')
  getPositions(
    @Param('id', ParseIntPipe) id: number, 
    @Request() req
  ) {
    return this.service.getDepartmentPositions(req.user.companyId, id);
  }
}