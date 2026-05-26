import { 
  Controller, Get, Post, Put, Delete, Body, Param, 
  ParseIntPipe, Request, UseGuards, Query, ForbiddenException 
} from '@nestjs/common';
import { MenusService } from './menus.service';
import { CreateMenuDto, UpdateMenuDto } from './menus.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { SubscriptionGuard } from '../auth/subscription.guard';

// 🔒 2. ใส่ PermissionsGuard และ SubscriptionGuard ให้ครบ (ลบตัวที่ซ้ำออก)
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) 
@Controller('sec/menus')
export class MenusController {
  constructor(private readonly service: MenusService) {}

  @Get('tree')
  // @RequirePermissions('menu:view') // (ถ้าจะบังคับสิทธิ์ด้วยก็เปิดใช้บรรทัดนี้ได้ครับ แต่ต้องไปสร้างสิทธิ์ 'menu:view' ไว้ใน DB)
  getMenuTree(@Request() req, @Query('companyId') queryCompanyId?: string) {
    let targetCompanyId = req.user.companyId;

    if (queryCompanyId) {
      targetCompanyId = parseInt(queryCompanyId);
    }
    
    // 🌟 ส่ง req.user ไปให้ Service จัดการเช็คสิทธิ์ HQ
    return this.service.findAllTree(targetCompanyId, req.user);
  }

  @Get(':id')
  @RequirePermissions('menu:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // =========================================================
  // 🛑 โซนจัดการ Master Data (เฉพาะ Super Admin)
  // =========================================================

  @Post()
  @RequirePermissions('menu:create')
  create(@Request() req, @Body() dto: CreateMenuDto) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException('เฉพาะ Super Admin เท่านั้นที่สร้างเมนูระบบได้');
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions('menu:update')
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuDto) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException('เฉพาะ Super Admin เท่านั้นที่แก้ไขเมนูระบบได้');
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('menu:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException('เฉพาะ Super Admin เท่านั้นที่ลบเมนูระบบได้');
    return this.service.remove(id);
  }

  @Post('import')
  @RequirePermissions('menu:create')
  importMenus(@Request() req, @Body() menuJson: any[]) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException('เฉพาะ Super Admin เท่านั้นที่ Import เมนูได้');
    return this.service.importMenus(menuJson);
  }
}