// src/modules/int/social/social.controller.ts
import { Controller, Post, Delete, Body, Query, UseGuards, Request } from '@nestjs/common'; // 🌟 เพิ่ม Delete, Query
import { SocialService } from './social.service';
import { BroadcastDto } from './dto/broadcast.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) 
@Controller('int/social') 
export class SocialController {
  constructor(private readonly service: SocialService) {}

  @Post('broadcast')
  @RequirePermissions('announcement:create') 
  broadcast(@Request() req, @Body() dto: BroadcastDto) {
    return this.service.broadcast(req.user.companyId, dto);
  }

  // 🌟 [NEW] เพิ่ม API สำหรับทดสอบส่งเข้ากระดิ่งตัวเอง
  @Post('broadcast/test')
  @RequirePermissions('announcement:create')
  async testBroadcast(
    @Request() req,
    @Body() dto: BroadcastDto // 👈 ใช้ DTO ตัวเดียวกับของจริงเลย หน้าบ้านจะได้ไม่ต้องเปลี่ยน Data
  ) {
    const adminUserId = req.user.id || req.user.userId;
    return this.service.testBroadcast(req.user.companyId, adminUserId, dto);
  }

  // 🌟 เพิ่ม Endpoint สำหรับลบรูปภาพประวัติการส่ง Social และคืนพื้นที่
  @Delete('broadcast/image')
  @RequirePermissions('announcement:delete') // ต้องมีสิทธิ์ลบ
  async deleteBroadcastImage(
    @Request() req,
    @Query('imageUrl') imageUrl: string // รับ URL รูปภาพที่ต้องการลบ
  ) {
    if (!imageUrl) {
      return { success: false, message: 'กรุณาส่ง imageUrl ที่ต้องการลบ' };
    }
    return this.service.deleteBroadcastImage(req.user.companyId, imageUrl);
  }
}