import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; // 🌟 อัปเดต Path
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 อัปเดต Path
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; // 🌟 อัปเดต Path
import { Public } from '../../sec/auth/public.decorator'; // 🌟 อัปเดต Path


@Controller('com/reviews') // 🌟 เติม api/ ให้เป็นมาตรฐาน
@UseGuards(JwtAuthGuard) // 🌟 ด่านหน้า: บังคับล็อกอินเป็นพื้นฐาน (ยกเว้นตัวที่มี @Public)
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  // ========================================================
  // 🛍️ ส่วนของลูกค้าและสาธารณะ (Public / Member)
  // ========================================================

  // 🔍 ดูรีวิวรายสินค้า (สาธารณะ - ใครก็ดูได้)
  @Get('product/:productId')
  @Public() // 🔓 ปลดล็อกให้คนทั่วไปดูรีวิวได้โดยไม่ต้อง Login
  getReviews(@Param('productId', ParseIntPipe) productId: number) {
    return this.service.findByProduct(productId);
  }

  // 📝 ลูกค้าสร้างรีวิว (เฉพาะ Member ที่ Login แล้ว)
  @Post()
  // 💡 ไม่ใช้ PermissionsGuard เพื่อให้ลูกค้าทุกคนที่ซื้อของไปสามารถรีวิวได้
  create(@Body() dto: CreateReviewDto, @Request() req) {
    // 🛡️ ใช้ข้อมูลจาก Token เพื่อความปลอดภัย
    return this.service.create(req.user.companyId, req.user.id, dto);
  }

  // ========================================================
  // 🏢 ส่วนของแอดมิน/ร้านค้า (Admin / Staff Only)
  // ========================================================

  // 💬 ร้านค้าตอบกลับรีวิว
  @Patch(':id/reply')
  @UseGuards(PermissionsGuard) // 🌟 ยามเฝ้าประตูเฉพาะแอดมิน
  @RequirePermissions('reviews', 'update') 
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body('message') message: string,
    @Request() req
  ) {
    return this.service.reply(req.user.companyId, id, message);
  }

  // ❌ ลบรีวิว (Admin ลบคอมเมนต์ไม่เหมาะสม)
  @Delete(':id')
  @UseGuards(PermissionsGuard) // 🌟 ยามเฝ้าประตูเฉพาะแอดมิน
  @RequirePermissions('reviews', 'delete')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.companyId);
  }
}