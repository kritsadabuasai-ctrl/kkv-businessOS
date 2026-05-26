import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request } from '@nestjs/common';
import { SystemConfigsService } from './system-configs.service';
import { CreateSystemConfigDto } from './system-configs.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('cfg/system-configs')
export class SystemConfigsController {
  constructor(private readonly service: SystemConfigsService) {}

  @Get()
  @RequirePermissions('cfg:system:view')
  findAll(@Request() req) {
    const userId = Number(req.user.userId || req.user.sub); // 🌟 ดึง userId จาก Token
    return this.service.findAll(userId); // โยนให้ Service เช็ค HQ
  }

  @Get(':key')
  @RequirePermissions('cfg:system:view')
  getOne(@Request() req, @Param('key') key: string) {
    const userId = Number(req.user.userId || req.user.sub);
    return this.service.getValue(key, userId);
  }

  @Post()
  @RequirePermissions('cfg:system:update') 
  setup(@Request() req, @Body() dto: CreateSystemConfigDto) {
    const userId = Number(req.user.userId || req.user.sub);
    return this.service.upsert(dto, userId);
  }

  @Delete(':key')
  @RequirePermissions('cfg:system:delete')
  remove(@Request() req, @Param('key') key: string) {
    const userId = Number(req.user.userId || req.user.sub);
    return this.service.remove(key, userId);
  }
}