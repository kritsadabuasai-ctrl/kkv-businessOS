import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('pro/purchase-orders')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  // =========================================================
  // 🛒 1. เปิดใบสั่งซื้อสินค้าใหม่ (Create PO)
  // =========================================================
  @Post()
  @RequirePermissions('purchase-orders:create') 
  create(@Body() dto: CreatePurchaseOrderDto, @Request() req) {
    // 🚩 [FIXED] แกะรหัสพนักงาน/ผู้ใช้งานจาก Token ส่งต่อไปให้ Service 
    const userId = req.user.userId || req.user.id;
    return this.service.create(req.user.companyId, userId, dto);
  }

  // =========================================================
  // 📋 2. ดึงข้อมูลใบสั่งซื้อทั้งหมดภายในบริษัท
  // =========================================================
  @Get()
  @RequirePermissions('purchase-orders:view') 
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  // =========================================================
  // 🔍 3. เรียกดูรายละเอียดใบสั่งซื้อเดี่ยว (รวมประวัติไฟล์ DMS)
  // =========================================================
  @Get(':id')
  @RequirePermissions('purchase-orders:view')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.companyId);
  }

  // =========================================================
  // 🚚 4. กดบันทึกรับสินค้าเข้าคลังคัดแยก
  // =========================================================
  @Patch(':id/receive')
  @RequirePermissions('purchase-orders:update') 
  receive(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.receiveItems(id, req.user.companyId);
  }
}