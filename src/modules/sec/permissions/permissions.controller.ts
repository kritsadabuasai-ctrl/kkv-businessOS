import { 
  Controller, Get, Post, Body, Param, Delete, ParseIntPipe, 
  UseGuards, Put, Request, ForbiddenException 
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto, UpdatePermissionDto } from './permissions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 2. ใส่ PermissionsGuard เพื่อเช็คสิทธิ์ตามป้าย
@Controller('sec/permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get()
  @RequirePermissions('role:view')
  findAll() {
    return this.service.findAll(); // ดึงรายการสิทธิ์ทั้งหมดให้หน้าบ้านไปแสดงผลใน Matrix
  }

  // =========================================================
  // 🛑 โซนอันตราย: จัดการ Master Data ของระบบ (เฉพาะ Super Admin)
  // =========================================================
  
  @Post()
  @RequirePermissions('permission:create')
  create(@Request() req, @Body() dto: CreatePermissionDto) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException('เฉพาะ Super Admin เท่านั้นที่สามารถสร้างสิทธิ์หลักของระบบได้');
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions('permission:update')
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePermissionDto) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException('เฉพาะ Super Admin เท่านั้นที่สามารถแก้ไขสิทธิ์หลักของระบบได้');
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('permission:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException('เฉพาะ Super Admin เท่านั้นที่สามารถลบสิทธิ์หลักของระบบได้');
    return this.service.remove(id);
  }

  // =========================================================
  // ✅ โซนใช้งานทั่วไป: การจัดการสิทธิ์ของ Role (Admin บริษัททำได้)
  // =========================================================

  @Post('assign/:roleId/:permissionId')
  @RequirePermissions('role:update') // ใช้สิทธิ์ role:update เพราะเป็นการแก้ข้อมูล Role
  assign(
    @Request() req,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number
  ) {
    // 🛡️ ส่งข้อมูลของคนล็อกอินไปเช็คใน Service ด้วยว่า Role นี้เป็นของบริษัทตัวเองหรือไม่
    return this.service.assignToRole(roleId, permissionId, req.user.companyId, req.user.isSuperAdmin);
  }

  @Delete('assign/:roleId/:permissionId')
  @RequirePermissions('role:update')
  unassign(
    @Request() req,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number
  ) {
    // 🛡️ ส่งข้อมูลของคนล็อกอินไปเช็คใน Service ด้วย
    return this.service.removeFromRole(roleId, permissionId, req.user.companyId, req.user.isSuperAdmin);
  }
}