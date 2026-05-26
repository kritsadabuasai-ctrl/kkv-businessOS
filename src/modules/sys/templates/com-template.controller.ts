import { 
  Controller, Get, Post, Body, Param, Put, Delete, 
  ParseIntPipe, UseGuards, Query, Request 
} from '@nestjs/common';
import { ComTemplateService } from './com-template.service';
import { CreateTemplateDto, UpdateTemplateDto } from './com-template.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
@Controller('sys/templates')
export class ComTemplateController {
  constructor(private readonly service: ComTemplateService) {}

  @Post()
  @RequirePermissions('template:create')
  create(
    @Request() req, 
    @Body() dto: CreateTemplateDto,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.create(targetCompanyId, dto);
  }

  @Get()
  @RequirePermissions('template:view')
  findAll(
    @Request() req,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.findAll(targetCompanyId);
  }

  @Get(':id')
  @RequirePermissions('template:view')
  findOne(
    @Request() req, 
    @Param('id', ParseIntPipe) id: number,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.findOne(id, targetCompanyId);
  }

  @Get('find/specific')
  @RequirePermissions('template:view')
  findSpecific(
    @Request() req,
    @Query('code') code: string,
    @Query('channel') channel: string,
    @Query('locale') locale?: string,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.getTemplate(targetCompanyId, code, channel, locale);
  }

 @Put(':id')
  @RequirePermissions('sys:template:update') 
  update(
    @Param('id', ParseIntPipe) id: number, // 🌟 ใช้ ParseIntPipe แปลง String เป็น Number ให้อัตโนมัติ
    @Request() req, 
    @Body() dto: UpdateTemplateDto,
    @Query('companyId') queryCompanyId?: string
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    
    // 🌟 ดึง userId จาก Token 
    const userId = Number(req.user.userId || req.user.sub);

    // 🌟 ส่งตัวแปรทั้ง 4 ตัวให้ Service จัดการต่อ
    return this.service.update(id, targetCompanyId, dto, userId);
  }

  @Delete(':id')
  @RequirePermissions('template:delete')
  remove(
    @Request() req, 
    @Param('id', ParseIntPipe) id: number,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.remove(id, targetCompanyId);
  }
}