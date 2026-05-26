import { 
  Controller, Get, Post, Body, Put, Param, Delete, 
  UseGuards, ParseIntPipe, Request, Query
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreatePackageDto, UpdatePackageDto , SetCustomPriceDto} from './packages.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('sec/packages') 
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) 
export class PackagesController {
  constructor(private readonly service: PackagesService) {}

  // 🌟 เพิ่ม API ใหม่ตรงนี้: ให้ตัวแทนตั้งราคาตัวเอง
  @Post('custom-price')
  @RequirePermissions('package:update') // ใช้สิทธิ์แก้ไขแพ็กเกจ
  setCustomPrice(@Request() req, @Body() dto: SetCustomPriceDto) {
    // ส่ง companyId ของคนที่ Login (ตัวแทน) เข้าไป
    return this.service.setCustomPrice(req.user.companyId, dto);
  }

  @Get('analytics')
  @RequirePermissions('package:view')
  getAnalytics(@Request() req) {
    // 🌟 ปล่อยให้ Service เป็นคนเช็คสิทธิ์ HQ / Reseller จาก Database เอง
    return this.service.getPackageAnalytics(req.user); 
  }

  @Post()
  @RequirePermissions('package:create')
  create(@Request() req, @Body() dto: CreatePackageDto) {
    // 🌟 ดัน companyId ของคนสร้าง (HQ หรือ ตัวแทน) ลงไปให้ Service
    return this.service.create(dto, req.user.companyId);
  }

  @Get()
  @RequirePermissions('package:view')
  findAll(
    @Request() req, 
    @Query('intent') intent?: string // 🌟 เพิ่มบรรทัดนี้ เพื่อให้รู้ว่าหน้าบ้านขอดึงไปทำอะไร
  ) { 
    return this.service.findAll(req.user, intent); // 🌟 ส่ง intent ไปให้ Service
  }

  @Get(':id')
  @RequirePermissions('package:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @RequirePermissions('package:update')
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePackageDto) {
    // 🌟 ปล่อยให้ Service เช็คสิทธิ์การแก้ไข
    return this.service.update(id, dto, req.user.companyId); 
  }

  @Delete(':id')
  @RequirePermissions('package:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    // 🌟 ปล่อยให้ Service เช็คสิทธิ์การลบ
    return this.service.remove(id, req.user.companyId); 
  }
}