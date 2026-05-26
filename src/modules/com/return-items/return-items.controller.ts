import { Controller, Patch, Delete, Param, Body, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { ReturnItemsService } from './return-items.service';
import { UpdateReturnItemDto } from './dto/update-return-item.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/return-items')
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
export class ReturnItemsController {
  constructor(private readonly service: ReturnItemsService) {}

  // 📝 Admin บันทึกสภาพสินค้า (Inspection)
  @Patch(':id')
  @RequirePermissions('return-items.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReturnItemDto,
    @Request() req
  ) {
    // TODO: ควรเช็ค Role ว่าเป็น Admin หรือ Staff ฝ่ายตรวจสอบ
    return this.service.update(id, req.user.companyId, dto);
  }

  // ❌ ลบรายการ (กรณีไม่ได้ส่งมา)
  @Delete(':id')
  @RequirePermissions('return-items.delete')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.companyId);
  }
}