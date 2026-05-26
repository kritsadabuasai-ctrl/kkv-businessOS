import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, UseGuards, Request } from '@nestjs/common';
import { ShopProductsService } from './shop-products.service';
import { CreateShopProductDto } from './dto/create-shop-product.dto';
import { UpdateShopProductDto } from './dto/update-shop-product.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/shop-products') 
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) 
export class ShopProductsController {
  constructor(private readonly service: ShopProductsService) {}

  @Post()
  @RequirePermissions('shop-product:create')
  create(@Request() req, @Body() dto: CreateShopProductDto) {
    const companyId = req.user.companyId; // 🌟 ดึง Company ID จาก Token
    return this.service.create(companyId, dto);
  }

  @Delete(':shopId/:productId')
  @RequirePermissions('shop-product:delete')
  remove(
    @Request() req,
    @Param('shopId', ParseIntPipe) shopId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    const companyId = req.user.companyId;
    return this.service.remove(companyId, shopId, productId);
  }

  @Get()
  @RequirePermissions('shop-product:view')
  findAll(@Request() req, @Query('shopId', ParseIntPipe) shopId: number) {
    const companyId = req.user.companyId;
    return this.service.findAllByShop(companyId, shopId);
  }

  @Get('product/:productId')
  @RequirePermissions('shop-product:view')
  findAllByProduct(@Request() req, @Param('productId', ParseIntPipe) productId: number) {
    const companyId = req.user.companyId;
    return this.service.findAllByProduct(companyId, productId);
  }

  @Get(':shopId/:productId')
  @RequirePermissions('shop-product:view')
  findOne(
    @Request() req,
    @Param('shopId', ParseIntPipe) shopId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    const companyId = req.user.companyId;
    return this.service.findOne(companyId, shopId, productId);
  }

  @Patch(':shopId/:productId')
  @RequirePermissions('shop-product:update')
  update(
    @Request() req,
    @Param('shopId', ParseIntPipe) shopId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateShopProductDto,
  ) {
    const companyId = req.user.companyId;
    return this.service.update(companyId, shopId, productId, dto);
  }
}