import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { ShippingRulesService } from './shipping-rules.service';
import { CreateShippingRuleDto } from './dto/create-shipping-rule.dto';
import { UpdateShippingRuleDto } from './dto/update-shipping-rule.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; // 🌟 อัปเดต Path
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 อัปเดต Path
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; // 🌟 อัปเดต Path
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/shipping-rules') // 🌟 เติม api/ ให้เป็นมาตรฐานเดียวกัน
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 ล็อก 2 ชั้นสำหรับงาน Admin ทั้งหมด
export class ShippingRulesController {
  constructor(private readonly service: ShippingRulesService) {}

  @Post()
  @RequirePermissions('shipping-rule:create')
  create(@Body() dto: CreateShippingRuleDto, @Request() req) {
    // 🛡️ ส่ง companyId จาก Token เข้าไปเพื่อเช็คสิทธิ์ในระดับ Service
    return this.service.create(dto, req.user.companyId);
  }

  // 🔍 ดึงกฎทั้งหมดของ Method หนึ่ง: /api/com/shipping-rules/method/1
  @Get('method/:methodId')
  @RequirePermissions('shipping-rule:view')
  findAllByMethod(
    @Param('methodId', ParseIntPipe) methodId: number,
    @Request() req
  ) {
    return this.service.findAllByMethod(methodId, req.user.companyId);
  }

  @Get(':id')
  @RequirePermissions('shipping-rule:view')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Patch(':id')
  @RequirePermissions('shipping-rule:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShippingRuleDto,
    @Request() req,
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @RequirePermissions('shipping-rule:delete')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.companyId);
  }
}