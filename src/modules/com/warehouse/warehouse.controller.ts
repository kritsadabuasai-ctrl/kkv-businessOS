import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Request, UseGuards } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/warehouse')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@RequirePermissions('warehouse:view') // 🛡️ สิทธิ์พื้นฐานในการเข้าถึงโมดูลคลังสินค้า
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @RequirePermissions('warehouse:create')
  create(@Request() req, @Body() createWarehouseDto: CreateWarehouseDto) {
    const companyId = req.user.companyId; // ดึงรหัสความปลอดภัยจาก JWT Token
    return this.warehouseService.create(companyId, createWarehouseDto);
  }

  @Get()
  @RequirePermissions('warehouse:view')
  findAll(@Request() req) {
    const companyId = req.user.companyId;
    return this.warehouseService.findAll(companyId);
  }

  @Get(':id')
  @RequirePermissions('warehouse:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const companyId = req.user.companyId;
    return this.warehouseService.findOne(companyId, id);
  }

  @Patch(':id')
  @RequirePermissions('warehouse:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
  ) {
    const companyId = req.user.companyId;
    return this.warehouseService.update(companyId, id, updateWarehouseDto);
  }

  @Delete(':id')
  @RequirePermissions('warehouse:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const companyId = req.user.companyId;
    return this.warehouseService.remove(companyId, id);
  }
}