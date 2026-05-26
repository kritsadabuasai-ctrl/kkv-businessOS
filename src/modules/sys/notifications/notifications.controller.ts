import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ParseIntPipe ,Delete } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('sys/notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // 📢 1. Admin ประกาศข่าวหาสมาชิกทุกคนในบริษัทตัวเอง
  @Post('broadcast')
  @RequirePermissions('notifications:create')
  async broadcast(
    @Body() dto: CreateNotificationDto, 
    @Request() req,
    @Query('companyId') queryCompanyId?: string // 🌟 1. เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.broadcastToMembers(targetCompanyId, dto);
  }

  // 📥 2. ดูรายการแจ้งเตือนของฉัน
  @Get('me')
  @RequirePermissions('notifications:view')
  findMyNotifications(
    @Request() req,
    @Query('target') target: string, // 'MEMBER' | 'USER'
    @Query('page') page?: string,
    @Query('limit') limit?: string, // 🌟 1. เพิ่มการรับค่า limit จากหน้าบ้าน
    @Query('companyId') queryCompanyId?: string 
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    const recipient = target === 'MEMBER' 
      ? { memberId: req.user.id || req.user.userId } 
      : { userId: req.user.id || req.user.userId };

    // 🌟 2. แปลงค่าเป็นตัวเลข (ถ้าหน้าบ้านไม่ส่งมา ให้ Default page=1, limit=5)
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 5; 

    return this.service.findAll(targetCompanyId, recipient, pageNum, limitNum);
  }

  // ✅ 3. กดอ่านแจ้งเตือนรายตัว
  @Patch(':id/read')
  @RequirePermissions('notifications:update')
  markAsRead(
    @Param('id') id: string, 
    @Request() req,
    @Query('companyId') queryCompanyId?: string // 🌟 3. เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.markAsRead(targetCompanyId, id);
  }

  // ✅ 4. กดอ่านทั้งหมด
  @Patch('read-all')
  @RequirePermissions('notifications:update')
  markAllAsRead(
    @Request() req, 
    @Query('target') target: string,
    @Query('companyId') queryCompanyId?: string // 🌟 4. เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    const recipient = target === 'MEMBER' 
      ? { memberId: req.user.id || req.user.userId } 
      : { userId: req.user.id || req.user.userId };

    return this.service.markAllAsRead(targetCompanyId, recipient);
  }

  @Delete('broadcast')
  @RequirePermissions('notifications:delete') // 🔒 ต้องมีสิทธิ์ลบ
  async deleteBroadcast(
    @Request() req,
    @Query('iconUrl') iconUrl: string, // 🌟 หน้าบ้านต้องส่ง URL รูปมาเพื่อเป็นตัวอ้างอิงในการลบ
    @Query('companyId') queryCompanyId?: string 
  ) {
    if (!iconUrl) {
      return { success: false, message: 'กรุณาส่ง iconUrl ที่ต้องการลบ' };
    }

    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.deleteBroadcast(targetCompanyId, iconUrl);
  }

  // 🧪 เพิ่ม API สำหรับให้ Admin กด "ส่งทดสอบหาตัวเอง"
  @Post('test-in-app')
  @RequirePermissions('notifications:create')
  async sendTestInApp(
    @Body() dto: CreateNotificationDto, 
    @Request() req
  ) {
    // 1. บังคับเปลี่ยนผู้รับให้เป็น ID ของ Admin ที่กำลังล็อกอินอยู่เท่านั้น!
    const testDto = {
      ...dto,
      recipientMemberId: undefined, // 🌟 เปลี่ยนจาก null เป็น undefined ตรงนี้ครับ
      recipientUserId: req.user.id || req.user.userId, 
      title: `[TEST] ${dto.title || 'ทดสอบแจ้งเตือน'}`, 
    };

    // 2. เรียกใช้ Service ตัวเดิมเพื่อบันทึกลงกระดิ่งของ Admin
    return this.service.create(req.user.companyId, testDto);
  }
}