import { 
  Controller, Get, Post, Body, Patch, Param, UseGuards, Request, ParseIntPipe, HttpCode, HttpStatus
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; // 🌟 อัปเดต Path
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 นำเข้า PermissionsGuard
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; // 🌟 อัปเดต Path
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Commerce: Orders (คำสั่งซื้อ)')
@Controller('api/com/orders')
@UseGuards(JwtAuthGuard) // 🌟 ด่านหน้า: ทุกคนต้องล็อกอิน
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  // =========================================================
  // 🛍️ ส่วนของลูกค้า (Customer / Member)
  // ไม่มี PermissionsGuard เพื่อให้ลูกค้าใช้งานได้
  // =========================================================

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'คำนวณราคาสุทธิ ค่าส่ง และส่วนลด (ใช้ในหน้า Checkout)' })
  calculateCheckout(@Body() dto: CreateOrderDto, @Request() req) {
    // 🌟 แก้ไข: Service ไม่ได้รับ memberId แล้ว จึงส่งแค่ companyId และ dto ไปให้
    return this.service.calculateCheckout(req.user.companyId, dto);
  }

  @Post()
  @ApiOperation({ summary: 'สร้างคำสั่งซื้อ (ตัดสต็อก, ลบตะกร้า, แจกแต้ม)' })
  create(@Body() dto: CreateOrderDto, @Request() req) {
    const memberId = req.user.id; 
    return this.service.create(memberId, req.user.companyId, dto);
  }

  @Post(':id/reorder')
  // 💡 ปลด RequirePermissions ออก เพราะ "ลูกค้า" ควรมีสิทธิ์กดปุ่มสั่งซื้อซ้ำจากประวัติเก่าได้ครับ
  reorder(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.reOrder(id, req.user.id, req.user.companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'ดูรายละเอียด Order (ลูกค้าดูของตัวเองได้)' })
  // 💡 ปลด RequirePermissions ออก (การกรองว่า Order นี้เป็นของใคร จะให้ Service จัดการตรวจสอบจาก req.user.id)
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'ยกเลิก Order (ลูกค้าทำได้ถ้าร้านยังไม่ส่งของ, แอดมินทำได้อิสระ)' })
  cancel(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const isAdmin = req.user.roles?.includes('ADMIN') || false; 
    return this.service.cancelOrder(id, req.user.id, req.user.companyId, isAdmin);
  }

  // =========================================================
  // 🏢 ส่วนของแอดมิน (Admin / Staff)
  // ต้องมี PermissionsGuard มาเฝ้าเป็นพิเศษ!
  // =========================================================

  @Get('dashboard')
  @UseGuards(PermissionsGuard) // 🌟 ยามเฝ้าประตูเฉพาะแอดมิน
  @RequirePermissions('order:view')
  getDashboard(@Request() req) {
    return this.service.getDashboardStats(req.user.companyId);
  }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard) // 🌟 ยามเฝ้าประตูเฉพาะแอดมิน
  @RequirePermissions('order:update')
  updateStatus(
    @Param('id', ParseIntPipe) id: number, 
    @Body('status') status: string,
    @Body('note') note: string,
    @Request() req
  ) {
    return this.service.updateStatus(id, status, req.user.id, req.user.companyId, note);
  }
}