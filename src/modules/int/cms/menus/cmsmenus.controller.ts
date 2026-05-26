import { Controller, Get, Post, Body, Delete, Param, ParseIntPipe, UseGuards, Request, Put } from '@nestjs/common';
import { CmsMenusService } from './cmsmenus.service';
import { CreateMenuDto } from './dto/create-cmsmenu.dto';
import { JwtAuthGuard } from '../../../sec/auth/jwt-auth.guard'; // ปรับ path ตามจริง
import { RequirePermissions } from '../../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../../sec/auth/permissions.guard'; 

@Controller('int/cms/menus')
export class CmsMenusController {
  constructor(private readonly menusService: CmsMenusService) {}

  // 1. สร้างเมนูใหม่
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms:create')
  @Post()
  create(@Request() req, @Body() dto: CreateMenuDto) {
    return this.menusService.create(req.user.companyId, dto);
  }

  // 2. ดึงเมนูทั้งหมด (ไม่ต้องใส่ Guard เผื่อให้หน้าบ้านยิงมาแสดง Navbar ได้เลย)
  // แต่ถ้าอยากให้ดึงตาม Company ให้หน้าบ้านส่ง companyId มา หรืออิงจาก Domain ก็ได้ครับ
  @Get('tree/:companyId')
  findTree(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.menusService.findTree(companyId);
  }

  // 3. เซฟการเรียงลำดับใหม่ (ลาก Drag & Drop ฝั่งซ้าย)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms:update')
  @Put('reorder')
  updateOrder(@Request() req, @Body() items: any[]) {
    return this.menusService.updateBulkOrder(req.user.companyId, items);
  }

  // 4. ลบเมนู
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms:delete')
  @Delete(':id')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.menusService.remove(id, req.user.companyId);
  }
}