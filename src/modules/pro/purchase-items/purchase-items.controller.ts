import { Controller, Patch, Delete, Param, Body, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { PurchaseItemsService } from './purchase-items.service';
import { ReceivePurchaseItemDto, UpdatePurchaseItemDto } from './dto/update-purchase-item.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('pro/purchase-items')
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
export class PurchaseItemsController {
  constructor(private readonly service: PurchaseItemsService) {}

  // 🚚 รับของรายชิ้น
  @Patch(':id/receive')
  @RequirePermissions('purchase-items:update') // ✅ เพิ่ม Decorator สำหรับสิทธิ์
  receive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceivePurchaseItemDto,
    @Request() req
  ) {
    return this.service.receive(id, req.user.companyId, dto);
  }

  // 📝 แก้ไข (ราคา/จำนวน)
  @Patch(':id')
    @RequirePermissions('purchase-items:update') // ✅ เพิ่ม Decorator สำหรับสิทธิ์
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePurchaseItemDto,
    @Request() req
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  // ❌ ลบรายการ (กรณีสั่งผิด หรือ Supplier ไม่มีของ)
  @Delete(':id')
  @RequirePermissions('purchase-items:delete') // ✅ เพิ่ม Decorator สำหรับสิทธิ์
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.companyId);
  }
}