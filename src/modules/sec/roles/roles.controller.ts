import { Controller, Get, Post, Body, Param, Delete, Put, ParseIntPipe, Request, UseGuards, Query, ForbiddenException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';
import { RequirePermissions } from '../auth/permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 2. ใส่ PermissionsGuard คุมประตูคู่กับ Jwt
@Controller('sec/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * 1. สร้าง Role ใหม่
   * 🎫 สิทธิ์: role:create
   */
  @Post()
  @RequirePermissions('role:create')
  async create(@Body() dto: CreateRoleDto, @Request() req) {
    // 🛡️ ป้องกัน User ทั่วไปแอบส่ง companyId ของบริษัทอื่นมาสร้าง
    const companyId = req.user.isSuperAdmin && dto.companyId 
      ? dto.companyId 
      : req.user.companyId;

    return this.rolesService.create({ ...dto, companyId });
  }

  /**
   * 2. ดูรายการ Role ทั้งหมด
   * 🎫 สิทธิ์: role:view
   */
  @Get()
  @RequirePermissions('role:view')
  findAll(@Request() req, @Query('companyId') queryCompanyId?: string) {
    // 🌟 1. ดักจับค่า 'all' หรือ ค่าว่าง
    const targetCompanyId = (queryCompanyId && queryCompanyId !== 'all' && queryCompanyId !== 'null') 
      ? parseInt(queryCompanyId) 
      : undefined;

    // 🌟 2. ส่งให้ Service ไปจัดการลอจิกเครือข่ายบริษัท (ส่ง req.user ไปด้วย)
    return this.rolesService.findAll(targetCompanyId, req.user);
  }

  @Get(':id')
  @RequirePermissions('role:view')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const role = await this.rolesService.findOne(id);
    
    // 🛡️ เช็คว่า Role นี้เป็นของบริษัทผู้เรียกใช้งานหรือไม่
    if (!req.user.isSuperAdmin && role.companyId !== req.user.companyId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงข้อมูลสิทธิ์ของบริษัทอื่น');
    }
    return role;
  }

  /**
   * 3. ดูรายชื่อผู้ใช้ที่ถือ Role นี้ (สำหรับ Matrix/List)
   */
  @Get(':id/users')
  @RequirePermissions('role:view')
  async getUsersByRole(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const role = await this.rolesService.findOne(id);
    if (!req.user.isSuperAdmin && role.companyId !== req.user.companyId) {
      throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้ในสิทธิ์นี้');
    }
    return this.rolesService.getUsersByRole(id);
  }

  @Put(':id/menus')
@RequirePermissions('role:update')
async updateMenus(
  @Param('id', ParseIntPipe) id: number, 
  @Body() dto: { menuIds: number[] }, 
  @Request() req
) {
  const role = await this.rolesService.findOne(id);
  
  // 🛡️ Security Check: ป้องกันข้ามบริษัท
  if (!req.user.isSuperAdmin && role.companyId !== req.user.companyId) {
    throw new ForbiddenException('คุณไม่มีสิทธิ์แก้ไขเมนูของบทบาทในบริษัทอื่น');
  }

  return this.rolesService.updateRoleMenus(id, dto.menuIds);
}

  /**
   * 4. แก้ไข Role
   * 🎫 สิทธิ์: role:update
   */
  @Put(':id')
  @RequirePermissions('role:update')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto, @Request() req) {
    const role = await this.rolesService.findOne(id);
    if (!req.user.isSuperAdmin && role.companyId !== req.user.companyId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์แก้ไขสิทธิ์ของบริษัทอื่น');
    }
    return this.rolesService.update(id, dto);
  }

  /**
   * 5. ลบ Role
   * 🎫 สิทธิ์: role:delete
   */
  @Delete(':id')
  @RequirePermissions('role:delete')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const role = await this.rolesService.findOne(id);
    if (!req.user.isSuperAdmin && role.companyId !== req.user.companyId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ลบสิทธิ์ของบริษัทอื่น');
    }
    return this.rolesService.remove(id);
  }
}