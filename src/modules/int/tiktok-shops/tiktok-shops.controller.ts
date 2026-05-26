import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { TiktokShopsService } from './tiktok-shops.service';
import { CreateTiktokShopDto, UpdateTiktokShopDto } from './tiktok-shops.dto';

import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('int/tiktok-shops') 
export class TiktokShopsController {
  constructor(private readonly service: TiktokShopsService) {}

  // ==========================================
  // 🟢 NEW: API สำหรับนำ Auth Code มาแลกเป็น Token
  // ==========================================
  @Post('exchange-token')
  @RequirePermissions('int:tiktok:create')
  exchangeToken(@Request() req, @Body('authCode') authCode: string) {
    return this.service.exchangeTokenAndFetchShops(req.user.companyId, authCode);
  }

  @Post()
  @RequirePermissions('int:tiktok:create')
  create(@Request() req, @Body() dto: CreateTiktokShopDto) {
    return this.service.create(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('int:tiktok:view')
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  @Get(':id')
  @RequirePermissions('int:tiktok:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Put(':id')
  @RequirePermissions('int:tiktok:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTiktokShopDto,
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @RequirePermissions('int:tiktok:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user.companyId);
  }

  @Post(':shopId/refresh')
  @RequirePermissions('int:tiktok:update') // ใช้สิทธิ์เดียวกับการแก้ไขข้อมูล 
  async refreshShopToken(@Param('shopId') shopId: string) {
    // เรียกใช้ฟังก์ชัน refreshTiktokToken ที่เราเพิ่มไว้ใน Service 
    return await this.service.refreshTiktokToken(shopId);
  }
}