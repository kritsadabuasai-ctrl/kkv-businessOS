import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Put,
  Param, 
  Delete, 
  ParseIntPipe,
  UseGuards,
  Request,
  ForbiddenException
} from '@nestjs/common';
import { MasterDataService } from './data.service';
import { Prisma } from '@prisma/client';

// 🌟 เรียก 3 ทหารเสือมาประจำการ
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 ล็อกอินเข้าบ้าน + ตรวจป้ายห้อยคอ
@Controller('cfg/master/data')
export class DataController {
  constructor(private readonly service: MasterDataService) {}

  // ==========================================
  // 🌟 1. ดึงข้อมูลแบบ Merge (Global + Local)
  // ==========================================
  @Get('group/:groupCode')
  @RequirePermissions('cfg:master:view') // 🔑 สิทธิ์ในการดูข้อมูลการตั้งค่า
  findByGroup(@Param('groupCode') groupCode: string, @Request() req) {
    const companyId = req.user.companyId;
    return this.service.findByGroup(groupCode, companyId);
  }

 // 🌟 2. สำหรับให้บริษัท (Company) อัปเดต/เปิด-ปิด ค่าของตัวเอง
  // ==========================================
  @Put('override')
  @RequirePermissions('cfg:master:update') // 🔑 สิทธิ์ในการแก้ไขข้อมูลการตั้งค่า
  overrideMetadata(@Body() dto: any, @Request() req) {
    const companyId = req.user.companyId;
    
    // 🌟 1. ดึง userId จาก Token ของคนที่ Login อยู่
    const userId = Number(req.user.userId || req.user.sub);
    
    if (!companyId) {
      throw new ForbiddenException('เฉพาะผู้ใช้ระดับบริษัท (Company) เท่านั้นที่ตั้งค่านี้ได้');
    }
    
    // 🌟 2. โยน userId พ่วงไปให้ Service ด้วย เพื่อเช็คว่าเป็น HQ หรือไม่
    return this.service.overrideMetadata(companyId, dto, userId);
  }

  // ==========================================
  // 🛠️ CRUD พื้นฐาน (สำหรับ Super Admin จัดการค่ากลาง)
  // ==========================================
  
  @Get()
  @RequirePermissions('cfg:master:view')
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  @Get(':id')
  @RequirePermissions('cfg:master:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('cfg:master:create')
  create(@Body() dto: Prisma.CfgMasterDataUncheckedCreateInput, @Request() req) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException('เฉพาะ Super Admin เท่านั้นที่สร้างค่ากลางได้');
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('cfg:master:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Prisma.CfgMasterDataUncheckedUpdateInput, @Request() req) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException('เฉพาะ Super Admin เท่านั้นที่แก้ไขค่ากลางได้');
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('cfg:master:delete')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException('เฉพาะ Super Admin เท่านั้นที่ลบค่ากลางได้');
    return this.service.remove(id);
  }
}