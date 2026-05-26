import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { MessageQueueService } from './message-queue.service';
import { CreateMessageQueueDto } from './message-queue.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; // 👈 1. Import ตัวตรวจสอบสิทธิ์เข้ามา
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
@Controller('int/message-queue')
export class MessageQueueController {
  constructor(private readonly service: MessageQueueService) {}

  @Post()
  @RequirePermissions('notifications:create') // 👈 2. บังคับว่าต้องมีสิทธิ์สร้างแจ้งเตือน/ข้อความ
  async create(@Request() req: any, @Body() dto: CreateMessageQueueDto) {
    const companyId = req.user.companyId; // ดึงจาก Token
    return this.service.enqueue(Number(companyId), dto);
  }

  @Get()
  @RequirePermissions('notifications:view') // 👈 3. บังคับว่าต้องมีสิทธิ์ดูประวัติข้อความ
  async findAll(@Request() req: any) {
    const companyId = req.user.companyId;
    return this.service.findAll(Number(companyId));
  }
}