import { Controller, Get, Post, Body, Query, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { StockLogsService } from './stock-logs.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/stock-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
export class StockLogsController {
  constructor(private readonly service: StockLogsService) {}

  @Post('adjustment')
  @RequirePermissions('stock:update') // ✅ เช็คแล้ว ถูกต้อง
  adjust(@Body() dto: CreateStockAdjustmentDto, @Request() req) {
    return this.service.createAdjustment(req.user.companyId, req.user.id, dto);
  }

  @Get()
  @RequirePermissions('stock:view') // 🌟 แก้ไข: เปลี่ยน . เป็น :
  findAll(
    @Request() req,
    @Query('productId') productId?: string
  ) {
    const pId = productId ? parseInt(productId) : undefined;
    return this.service.findAll(req.user.companyId, pId);
  }
}