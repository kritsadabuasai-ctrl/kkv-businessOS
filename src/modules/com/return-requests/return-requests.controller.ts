import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { ReturnRequestsService } from './return-requests.service';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RmaStatus } from '@prisma/client'; // ✅ 1. Import Enum เข้ามา
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/return-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
export class ReturnRequestsController {
  constructor(private readonly service: ReturnRequestsService) {}

  // 📝 ลูกค้าสร้างคำขอคืนสินค้า
  @Post()
  @RequirePermissions('return-requests:create')
  create(@Body() dto: CreateReturnRequestDto, @Request() req) {
    // สมมติว่าใน req.user มี memberId หรือต้องไปหาจาก DB
    const memberId = req.user.id; // ใช้ userId ไปก่อนถ้าผูกกัน 1:1
    return this.service.create(req.user.id, req.user.companyId, memberId, dto);
  }

  // 🔍 ดูรายละเอียด (รวม Workflow Status)
  @Get(':id')
  @RequirePermissions('return-requests:view')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.companyId);
  }

  // 🚚 ลูกค้าแจ้งเลขพัสดุ (ส่งของกลับ)
  @Patch(':id/tracking')
  @RequirePermissions('return-requests:update')
  updateTracking(
    @Param('id', ParseIntPipe) id: number,
    @Body('trackingNo') trackingNo: string,
    @Body('courier') courier: string,
    @Request() req
  ) {
    return this.service.updateTracking(id, trackingNo, courier, req.user.id);
  }

  // 👮 Admin เปลี่ยนสถานะ (หรือใช้สำหรับ Workflow Callback)
  @Patch(':id/status')
  @RequirePermissions('return-requests:update')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: RmaStatus,
    @Request() req
  ) {
    // 🚩 [FIXED] เพิ่ม req.user.companyId เข้าไปเป็น Parameter ตัวที่ 4
    return this.service.updateStatus(id, status, req.user.id, req.user.companyId);
  }
}