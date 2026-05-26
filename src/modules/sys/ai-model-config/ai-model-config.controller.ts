import { 
  Controller, Get, Post, Put, Delete, Body, Param, Query, 
  ParseIntPipe, UseGuards, Request, Res 
} from '@nestjs/common';
import type { Response } from 'express';
import { AiModelConfigService } from './ai-model-config.service';
import { CreateAiModelConfigDto, UpdateAiModelConfigDto } from './ai-model-config.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('sys/ai-model-configs')
export class AiModelConfigController {
  constructor(private readonly service: AiModelConfigService) {}

  // 🛡️ Helper สำหรับเช็คความเป็น HQ (บริษัทที่ licenseHolderId เป็น null)
  private checkIsHQ(user: any): boolean {
    // เช็คว่า licenseHolderId ไม่มีค่า หรือเป็น null หรือเป็น 0 (ตามโครงสร้าง DB ของคุณ)
    return !user.licenseHolderId;
  }

  @Get()
  @RequirePermissions('ai_config:view')
  async findAll(@Request() req, @Res() res: Response, @Query('activeOnly') activeOnly?: string) {
    const isActive = activeOnly === 'true';
    const isHQ = this.checkIsHQ(req.user); 
    
    const data = await this.service.findAll(req.user.companyId, isActive, req.user.isSuperAdmin, isHQ);

    // 🚀 แก้ปัญหาหน้าจอค้าง (304 Not Modified): บังคับเบราว์เซอร์ดึงข้อมูลใหม่ทุกครั้งห้ามใช้ Cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json(data);
  }

  @Get('effective/:modelCode')
  @RequirePermissions('ai_config:view')
  findEffective(@Request() req, @Param('modelCode') modelCode: string) {
    return this.service.findEffectiveConfig(req.user.companyId, modelCode);
  }

  @Post()
  @RequirePermissions('ai_config:create')
  create(@Request() req, @Body() dto: CreateAiModelConfigDto) {
    const isHQ = this.checkIsHQ(req.user);
    return this.service.create(dto, req.user.companyId, req.user.isSuperAdmin, isHQ);
  }

  @Put(':id')
  @RequirePermissions('ai_config:update')
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAiModelConfigDto) {
    const isHQ = this.checkIsHQ(req.user);
    return this.service.update(id, dto, req.user.companyId, req.user.isSuperAdmin, isHQ);
  }

  @Delete(':id')
  @RequirePermissions('ai_config:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const isHQ = this.checkIsHQ(req.user);
    return this.service.remove(id, req.user.companyId, req.user.isSuperAdmin, isHQ);
  }
}