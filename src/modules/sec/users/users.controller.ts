import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards, Request, ForbiddenException ,Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, AdminResetPasswordDto } from './users.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard'; // 🌟 1. นำเข้า Guard เพิ่ม
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';


@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🌟 2. ใส่ PermissionsGuard คุมคู่กับ Jwt
@Controller('sec/users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post()
  @RequirePermissions('user:create')
  create(@Request() req, @Body() dto: CreateUserDto) {
    if (!req.user.isSuperAdmin) {
      dto.userRoles.forEach(role => {
        if (role.companyId !== req.user.companyId) {
          throw new ForbiddenException('คุณไม่มีสิทธิ์สร้างผู้ใช้ในบริษัทอื่น');
        }
      });
    }
    return this.service.createWithRoles(dto);
  }

  @Get()
  @RequirePermissions('user:view')
  findAll(@Request() req, @Query('companyId') queryCompanyId?: string) {
    // 1. เช็คว่าหน้าบ้านส่งมาเป็นตัวเลข หรือส่งคำว่า 'all'/ว่างเปล่า มา
    const targetCompanyId = (queryCompanyId && queryCompanyId !== 'all' && queryCompanyId !== 'null') 
      ? parseInt(queryCompanyId) 
      : undefined;
    
    // 2. โยนค่าให้ Service เป็นคนจัดการลอจิก (ส่ง req.user ไปด้วยเพื่อให้รู้ว่าเป็นใคร)
    return this.service.findAll(targetCompanyId, req.user);
  }

  @Get(':id')
  @RequirePermissions('user:view')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const user = await this.service.findById(id);
    if (!req.user.isSuperAdmin && !user.roles.some(r => r.companyId === req.user.companyId)) {
      throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้นี้');
    }
    return user;
  }

  @Put(':id')
  @RequirePermissions('user:update')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @Request() req) {
    const user = await this.service.findById(id);
    if (!req.user.isSuperAdmin && !user.roles.some(r => r.companyId === req.user.companyId)) {
      throw new ForbiddenException('ไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้นี้');
    }
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('user:delete')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    // 🛡️ ป้องกันการลบตัวเอง (Security Best Practice)
    if (Number(req.user.userId || req.user.sub) === id) {
       throw new ForbiddenException('ไม่สามารถลบตัวเองได้');
    }
    
    const user = await this.service.findById(id);
    if (!req.user.isSuperAdmin && !user.roles.some(r => r.companyId === req.user.companyId)) {
      throw new ForbiddenException('ไม่มีสิทธิ์ลบผู้ใช้นี้');
    }
    return this.service.remove(id);
  }

 // =========================================================
  // 🔑 แอดมินรีเซ็ตรหัสผ่านให้พนักงาน
  // =========================================================
  @Post(':id/reset-password')
  // 🔒 สามารถใส่ @RequirePermissions('user:update') เพื่อจำกัดสิทธิ์
  async adminResetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminResetPasswordDto,
    @Request() req
  ) {
    const adminId = Number(req.user.userId || req.user.sub);
    // 🌟 แก้ไขจาก this.usersService เป็น this.service
    return this.service.adminResetPassword(id, dto.newPassword, adminId);
  }
}