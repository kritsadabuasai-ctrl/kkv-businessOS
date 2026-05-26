import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  SetMetadata, // ✨ เพิ่ม SetMetadata เข้ามา
  Query
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './companies.dto';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

// ✨ สร้าง Decorator สำหรับ Public Route ชั่วคราว (ถ้าในระบบมีไฟล์ public.decorator อยู่แล้วสามารถ Import มาใช้แทนได้ครับ)
export const Public = () => SetMetadata('isPublic', true);

@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('org/companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // =========================================================
  // 1. GET ALL COMPANIES (ดึงข้อมูลบริษัททั้งหมดที่ User มีสิทธิ์เห็น)
  // =========================================================
  @Get()
  @RequirePermissions('company:view')
  findAll(@Req() req: any) {
    return this.companiesService.findAll(req.user.userId);
  }

 @Get('public/branding')
  @Public() // 🔓 ปลดล็อกให้ยิง API เส้นนี้ได้โดยไม่ต้อง Login
  getPublicBranding(@Query('cid') cid?: string) {
    // ถ้าหน้าบ้านแนบ ?cid= มา ก็แปลงเป็นตัวเลข แต่ถ้าไม่แนบมา จะกลายเป็น undefined
    const companyId = cid ? parseInt(cid, 10) : undefined;
    
    // โยนให้ Service จัดการต่อ
    return this.companiesService.getPublicBranding(companyId);
  }

  // =========================================================
  // ✨ [เพิ่มใหม่] 1.5 GET CURRENT COMPANY (ต้องวางไว้ก่อน :id เสมอ!)
  // =========================================================
  @Get('current')
  @RequirePermissions('company:view')
  findCurrent(@Req() req: any) {
    // 🛡️ ดึง companyId จาก JWT Token ของคนที่ Login อยู่ในขณะนั้น
    const companyId = req.user.companyId; 
    return this.companiesService.findOne(companyId, req.user.userId);
  }

  // =========================================================
  // 2. GET COMPANY BY ID (ดูข้อมูลบริษัทรายตัว)
  // =========================================================
  @Get(':id')
  @RequirePermissions('company:view')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.companiesService.findOne(id, req.user.userId);
  }

  // =========================================================
  // 🌟 [เพิ่มใหม่] 2.5 GET COMPANY SUBSCRIPTIONS (ดึงโมดูลที่บริษัทสมัครแล้ว)
  // =========================================================
  @Get(':id/subscriptions')
  @RequirePermissions('subscription:view') // 🛡️ ตรวจสิทธิ์การดู Subscription
  async getCompanySubscriptions(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any
  ) {
    // 🔗 เรียกใช้งานฟังก์ชันที่เตรียมไว้ใน Service
    return this.companiesService.getSubscriptions(id, req.user.userId);
  }

  // =========================================================
  // 3. CREATE COMPANY (สร้างบริษัทใหม่ / ลูกข่าย)
  // =========================================================
  @Post()
  @RequirePermissions('company:create') // ⚠️ อย่าลืมแก้ชื่อสิทธิ์ 'company:create' ให้ตรงกับในตาราง SecPermission ของคุณกฤษฎานะครับ
  create(@Body() dto: CreateCompanyDto, @Req() req: any) {
    return this.companiesService.create(dto, req.user.userId);
  }

  // =========================================================
  // 4. UPDATE COMPANY (อัปเดตข้อมูลบริษัท และ ข้อมูลนิติบุคคล/เอกสาร)
  // =========================================================
  @Put(':id')
  @RequirePermissions('company:update') // ⚠️ อย่าลืมแก้ชื่อสิทธิ์ 'company:update' ให้ตรงกับในตาราง SecPermission ของคุณกฤษฎานะครับ
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
    @Req() req: any
  ) {
    return this.companiesService.update(id, dto, req.user.userId);
  }

  // =========================================================
  // 5. DELETE COMPANY (ลบบริษัท)
  // =========================================================
  @Delete(':id')
  @RequirePermissions('company:delete')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.companiesService.remove(id, req.user.userId);
  }

  
}