import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; // ✅ ปรับ Path ให้ตรง
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('pro/suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Post()
  @RequirePermissions('suppliers:create') // 🌟 เปลี่ยน . เป็น : ให้เป็นมาตรฐาน
  create(@Body() dto: CreateSupplierDto, @Request() req) {
    // 🔒 Security: บังคับใช้ Company ID ของ User
    dto.companyId = req.user.companyId;
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions('suppliers:view') // 🌟 เปลี่ยน . เป็น : ให้เป็นมาตรฐาน
  findAll(@Request() req) {
    // ดึงเฉพาะ Supplier ของบริษัทตัวเอง
    return this.service.findAll(req.user.companyId);
  }

  @Get(':id')
  @RequirePermissions('suppliers:view') // 🌟 เปลี่ยน . เป็น : ให้เป็นมาตรฐาน
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    // เช็คสิทธิ์การเข้าถึง
    return this.service.findOne(id, req.user.companyId);
  }

  @Patch(':id')
  @RequirePermissions('suppliers:update') // 🌟 เปลี่ยน . เป็น : ให้เป็นมาตรฐาน
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() dto: UpdateSupplierDto, 
    @Request() req
  ) {
    // ห้ามเปลี่ยน Company ID
    dto.companyId = req.user.companyId;
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @RequirePermissions('suppliers:delete') // 🌟 เปลี่ยน . เป็น : ให้เป็นมาตรฐาน
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.companyId);
  }
}