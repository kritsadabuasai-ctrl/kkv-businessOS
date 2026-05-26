import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; // 🌟 อัปเดต Path
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 อัปเดต Path
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; // 🌟 อัปเดต Path


@Controller('com/payment-methods') // 🌟 เติม api/ ให้เป็นมาตรฐาน
@UseGuards(JwtAuthGuard) // 🌟 ด่านหน้า: บังคับแค่ล็อกอิน เพื่อให้ลูกค้าใช้งานได้
export class PaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  // =======================================================
  // 🏢 API สำหรับแอดมิน (Admin Only)
  // =======================================================

  @Post()
  @UseGuards(PermissionsGuard) // 🌟 ยามตรวจสิทธิ์เฉพาะแอดมิน
  @RequirePermissions('payment-method:create')
  create(@Body() dto: CreatePaymentMethodDto, @Request() req) {
    dto.companyId = req.user.companyId;
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard) // 🌟 ยามตรวจสิทธิ์เฉพาะแอดมิน
  @RequirePermissions('payment-method:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentMethodDto,
    @Request() req,
  ) {
    dto.companyId = req.user.companyId; // ห้ามเปลี่ยน Company ข้ามไปมา
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard) // 🌟 ยามตรวจสิทธิ์เฉพาะแอดมิน
  @RequirePermissions('payment-method:delete')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.companyId);
  }

  // =======================================================
  // 🛍️ API สำหรับลูกค้าและแอดมิน (Public / Member)
  // ปลด PermissionsGuard ออก เพื่อให้หน้า Checkout ดึงไปโชว์ได้
  // =======================================================

  @Get()
  // 💡 ไม่ต้องใช้ RequirePermissions เพราะลูกค้าต้องเห็นช่องทางชำระเงิน
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  @Get(':id')
  // 💡 ไม่ต้องใช้ RequirePermissions 
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.companyId);
  }
}