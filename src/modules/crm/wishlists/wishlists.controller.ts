import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { WishlistsService } from './wishlists.service';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('crm/wishlists') // 🌟 ปรับ Route ให้มี api/ นำหน้าเป็นมาตรฐานเดียวกัน
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) // 🌟 ปิดประตู! บังคับล็อกอินและเช็คสิทธิ์
export class WishlistsController {
  constructor(private readonly service: WishlistsService) {}

  // 💖 สลับสถานะ: ถ้ายังไม่ชอบให้เพิ่ม ถ้าชอบแล้วให้เอาออก (Toggle)
  @Post('toggle')
  @RequirePermissions('crm_member:update') // 🌟 ล็อกสิทธิ์: การจัดการรายการโปรดถือเป็นการอัปเดตข้อมูลลูกค้า
  toggle(@Body() dto: ToggleWishlistDto, @Request() req) {
    // memberId ดึงจาก Token (req.user.id) เพื่อความปลอดภัย
    return this.service.toggle(req.user.companyId, req.user.id, dto);
  }

  // 🔍 ดูรายการที่ชื่นชอบทั้งหมดของฉัน
  @Get()
  @RequirePermissions('crm_member:view') // 🌟 ล็อกสิทธิ์
  getMyWishlist(@Request() req) {
    return this.service.findAll(req.user.companyId, req.user.id);
  }
}