import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('crm/addresses')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post(':memberId')
  @RequirePermissions('CRM_MEMBER:update')
  create(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    // หมายเหตุ: ถ้าในอนาคต create ฟ้อง Error แบบเดียวกัน ให้เติม @Request() req แล้วส่ง req.user.companyId ด้วยนะครับ
    return this.addressesService.create(memberId, createAddressDto);
  }

  @Get(':memberId')
  @RequirePermissions('CRM_MEMBER:view')
  findAllByMember(
    @Request() req, // 🌟 ดึง Request มา
    @Param('memberId', ParseIntPipe) memberId: number
  ) {
    // 🌟 ส่ง companyId เป็น Parameter ตัวแรก
    return this.addressesService.findAllByMember(req.user.companyId, memberId);
  }

  @Patch(':id')
  @RequirePermissions('CRM_MEMBER:update')
  update(
    @Request() req, // 🌟 ดึง Request มา
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    // 🌟 ส่ง companyId เป็น Parameter ตัวแรก
    return this.addressesService.update(req.user.companyId, id, updateAddressDto);
  }

  @Delete(':id')
  @RequirePermissions('CRM_MEMBER:update')
  remove(
    @Request() req, // 🌟 ดึง Request มา
    @Param('id', ParseIntPipe) id: number
  ) {
    // 🌟 ส่ง companyId เป็น Parameter ตัวแรก
    return this.addressesService.remove(req.user.companyId, id);
  }

  @Patch(':id/default')
  @RequirePermissions('CRM_MEMBER:update')
  setAsDefault(
    @Request() req, 
    @Param('id', ParseIntPipe) id: number,
    @Body('memberId', ParseIntPipe) memberId: number,
  ) {
    // 🌟 จุดที่ Error เกิดขึ้น: ต้องส่งตัวแปรให้ครบ 3 ตัวเรียงตามนี้ครับ
    // 1. req.user.companyId  2. id  3. memberId
    return this.addressesService.setAsDefault(req.user.companyId, id, memberId);
  }
}