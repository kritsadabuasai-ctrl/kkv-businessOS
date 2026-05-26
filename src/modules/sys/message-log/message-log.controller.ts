import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { MessageLogService } from './message-log.service';
import { CreateMessageLogDto } from './dto/create-message-log.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
@Controller('sys/message-log')
export class MessageLogController {
  constructor(private readonly service: MessageLogService) {}

  @Get()
  @RequirePermissions('msg_log:view')
  findAll(@Request() req, @Query('companyId') queryCompanyId?: string) {
    // 🌟 1. รับค่า companyId จากหน้าบ้าน (Dropdown) ถ้าไม่ส่งมาให้ใช้บริษัทหลัก
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.findAll(targetCompanyId);
  }

  @Get('search')
  @RequirePermissions('msg_log:view')
  search(
    @Request() req, 
    @Query('q') query: string,
    @Query('companyId') queryCompanyId?: string // 🌟 2. เปิดรับ companyId สำหรับตอนค้นหาด้วย
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.findByRecipient(targetCompanyId, query);
  }

  @Post()
  @RequirePermissions('msg_log:create')
  create(@Body() dto: CreateMessageLogDto, @Request() req) { 
    // 🌟 3. ใช้ companyId ที่ส่งมา (ถ้ามี) ถ้าไม่มีค่อยใช้ของคนล็อกอิน
    dto.companyId = dto.companyId || req.user.companyId;

    return this.service.log(dto);
  }
}