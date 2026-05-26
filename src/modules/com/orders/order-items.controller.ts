import { Controller, Get, Patch, Param, Body, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { OrderItemsService } from './order-items.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; // 🌟 อัปเดต Path
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 อัปเดต Path
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; // 🌟 อัปเดต Path


@Controller('com/order-items') // 🌟 เติม api/ ให้เป็นมาตรฐาน
@UseGuards(JwtAuthGuard, PermissionsGuard) // 🌟 เป็นพื้นที่ของแอดมินล้วนๆ ล็อกกุญแจ 2 ชั้นที่ประตูหน้าได้เลย!
export class OrderItemsController {
  constructor(private readonly service: OrderItemsService) {}

  @Get('waiting-po')
  @RequirePermissions('order:view')
  findWaitingForPo(@Request() req) {
    return this.service.findWaitingForPo(req.user.companyId);
  }

  @Patch(':id/status')
  @RequirePermissions('order:update')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
    @Request() req
  ) {
    return this.service.updateItemStatus(id, status, req.user.companyId);
  }

  @Patch(':id/cancel')
  @RequirePermissions('order:update')
  cancelItem(
    @Param('id', ParseIntPipe) id: number,
    @Body('note') note: string,
    @Request() req
  ) {
    return this.service.cancelItem(id, req.user.companyId, note);
  }
}