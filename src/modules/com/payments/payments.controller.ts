import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/payments') 
@UseGuards(JwtAuthGuard, SubscriptionGuard) 
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  // =======================================================
  // 🛍️ API สำหรับลูกค้าหน้าบ้าน (Customer / Member)
  // =======================================================

  // 💸 ลูกค้าแจ้งโอนเงินและแนบรายการรูปภาพสลิปจาก DMS
  @Post()
  create(@Body() dto: CreatePaymentDto, @Request() req) {
    return this.service.create(req.user.userId, req.user.companyId, dto);
  }

  // 🔍 ลูกค้าเรียกดูประวัติยอดชำระเงินรายการเดี่ยวของตนเอง
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.companyId);
  }

  // =======================================================
  // 🏢 API สำหรับแอดมินหลังบ้าน (Admin / Staff Only)
  // =======================================================

  // 🔍 Admin ดูรายการรอตรวจสอบสลิปทั้งหมด (Pending) พร้อมรูปภาพประกอบจาก DMS
  @Get('pending')
  @UseGuards(PermissionsGuard) 
  @RequirePermissions('payment:view')
  findAllPending(@Request() req) {
    return this.service.findAllPending(req.user.companyId);
  }

  // ✅ Admin กดอนุมัติหรือปฏิเสธสลิปการโอนเงินของลูกค้า
  @Patch(':id/verify')
  @UseGuards(PermissionsGuard) 
  @RequirePermissions('payment:update')
  verifyPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerifyPaymentDto,
    @Request() req
  ) {
    return this.service.verifyPayment(id, req.user.companyId, req.user.userId, dto);
  }
}