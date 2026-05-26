import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, UseGuards, Request } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; // ✅ ปรับ Path ให้ตรง
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/bank-accounts')
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
export class BankAccountsController {
  constructor(private readonly service: BankAccountsService) {}

  @Post()
  @RequirePermissions('bank-account:create') // ✅ เพิ่ม Decorator สำหรับสิทธิ์
  create(@Body() dto: CreateBankAccountDto, @Request() req) {
    // ต้องส่ง companyId ของ user ไปเช็คด้วยว่ามีสิทธิ์เพิ่มใน shopId นี้ไหม
    return this.service.create(dto, req.user.companyId);
  }

  // ดึงบัญชีทั้งหมดของร้านค้า: /com/bank-accounts?shopId=1
  @Get()
  @RequirePermissions('bank-account:view') // ✅ เพิ่ม Decorator สำหรับสิทธิ์
  findAll(@Query('shopId', ParseIntPipe) shopId: number, @Request() req) {
    return this.service.findAllByShop(shopId, req.user.companyId);
  }

  @Get(':id')
    @RequirePermissions('bank-account:view') // ✅ เพิ่ม Decorator สำหรับสิทธิ์
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Patch(':id')
    @RequirePermissions('bank-account:update') // ✅ เพิ่ม Decorator สำหรับสิทธิ์
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBankAccountDto,
    @Request() req
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
    @RequirePermissions('bank-account:delete') // ✅ เพิ่ม Decorator สำหรับสิทธิ์
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.companyId);
  }
}