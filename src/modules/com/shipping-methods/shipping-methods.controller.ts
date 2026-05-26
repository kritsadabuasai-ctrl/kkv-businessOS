import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { ShippingMethodsService } from './shipping-methods.service';
import { CreateShippingMethodDto } from './dto/create-shipping-method.dto';
import { UpdateShippingMethodDto } from './dto/update-shipping-method.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('api/com/shipping-methods')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class ShippingMethodsController {
  constructor(private readonly service: ShippingMethodsService) {}

  @Post()
  @RequirePermissions('shipping-method:create')
  create(@Body() dto: CreateShippingMethodDto, @Request() req) {
    // 🛡️ ดึงจาก Token แล้วส่งเข้า Service โดยตรง ไม่ผ่าน DTO
    const companyId = req.user.companyId;
    return this.service.create(companyId, dto);
  }

  @Get()
  @RequirePermissions('shipping-method:view')
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  @Get(':id')
  @RequirePermissions('shipping-method:view')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Patch(':id')
  @RequirePermissions('shipping-method:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShippingMethodDto,
    @Request() req,
  ) {
    const companyId = req.user.companyId;
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @RequirePermissions('shipping-method:delete')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.companyId);
  }
}