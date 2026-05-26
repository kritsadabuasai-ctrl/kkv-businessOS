import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { RunningNumbersService } from './running-numbers.service';
import { CreateRunningFormatDto, UpdateRunningFormatDto } from './running-numbers.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('cfg/running-numbers')
export class RunningNumbersController {
  constructor(private readonly service: RunningNumbersService) {}

  // 📋 1. ดูรูปแบบทั้งหมด (ระบบจะ Merge ของบริษัททับของส่วนกลางให้)
  @Get()
  @RequirePermissions('cfg:running:view')
  findAll(@Request() req) {
    return this.service.findAll(req.user);
  }

  // 🔍 2. ดูรายละเอียดรายตัว
  @Get(':id')
  @RequirePermissions('cfg:running:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // ✨ 3. สร้างรูปแบบใหม่
  @Post('format')
  @RequirePermissions('cfg:running:create')
  createFormat(@Request() req, @Body() dto: CreateRunningFormatDto) {
    return this.service.upsertFormat(dto, req.user);
  }

  // 📝 4. แก้ไขรูปแบบ (จะทำการ Override สร้างของบริษัทตัวเองให้อัตโนมัติ)
  @Put(':id')
  @RequirePermissions('cfg:running:update')
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRunningFormatDto) {
    // ใช้วิธี Upsert โดยใช้ docCode แทน ID เพื่อรักษาความปลอดภัยของข้อมูลส่วนกลาง
    return this.service.upsertFormat(dto, req.user);
  }

  // ❌ 5. ลบรูปแบบ (อนุญาตให้ลบได้เฉพาะรูปแบบที่บริษัทสร้างเองเท่านั้น)
  @Delete(':id')
  @RequirePermissions('cfg:running:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user);
  }

  // 🧪 6. API สำหรับทดสอบการ Gen เลข
  @Get('test/:docCode')
  @RequirePermissions('cfg:running:view')
  testGen(@Request() req, @Param('docCode') docCode: string) {
    return this.service.generateNextNumber(req.user.companyId, docCode);
  }
}