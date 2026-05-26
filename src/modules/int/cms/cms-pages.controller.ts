import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { CmsPagesService } from './cms-pages.service';
import { CreateCmsPageDto, UpdateCmsPageDto } from './cms-pages.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { Public } from '../../sec/auth/public.decorator'; // 🌟 นำเข้า Public Decorator

@Controller('int/cms-pages') 
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 ล็อกตึกไว้เลย (คลุมทุกฟังก์ชันด้านล่าง)
export class CmsPagesController {
  constructor(private readonly service: CmsPagesService) {}

  // =========================================================
  // 🌍 Public Routes: สำหรับแสดงผลหน้าเว็บ
  // =========================================================
  
  @Public() // 🔓 แจ้งยามว่าฟังก์ชันนี้ "คนทั่วไปเข้าดูได้" ไม่ต้องถามหา Token 
  @Get('public/:companyId/:slug')
  async getPublicPage(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('slug') slug: string,
  ) {
    return this.service.findPublishedPage(companyId, slug);
  }

  // =========================================================
  // 🔒 Admin Routes: สำหรับจัดการหลังบ้าน (ถูกล็อกโดย Guard ด้านบนแล้ว)
  // =========================================================

  @Post()
  @RequirePermissions('cms:page:create') // 👈 ระบุแค่สิทธิ์ที่ต้องการก็พอ โค้ดจะสะอาดขึ้นมาก
  create(@Request() req, @Body() dto: CreateCmsPageDto) {
    return this.service.create(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('cms:page:view') 
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  @Get(':id')
  @RequirePermissions('cms:page:view') 
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Put(':id')
  @RequirePermissions('cms:page:update') 
  update(
    @Request() req, 
    @Param('id', ParseIntPipe) id: number, 
    @Body() dto: UpdateCmsPageDto
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @RequirePermissions('cms:page:delete') 
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user.companyId);
  }
}