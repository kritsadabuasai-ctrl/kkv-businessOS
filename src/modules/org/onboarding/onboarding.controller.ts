import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CreateTenantDto } from './onboarding.dto';

// 🌟 เรียก 3 ทหารเสือมาประจำการ
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

// 💡 เปลี่ยนจาก public เป็น api ธรรมดา เพราะตอนนี้เราล็อคประตูปิดสนิทแล้ว
@Controller('org/onboarding') 
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 ด่าน 1 & 2: ต้องล็อกอิน และตรวจสอบสิทธิ์
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('register-company')
  // 🔒 ด่าน 3: ระบุสิทธิ์ที่ต้องมี (เช่น ต้องเป็นแอดมินระดับระบบถึงจะสร้างบริษัทใหม่ได้)
  // ⚠️ อย่าลืมแก้ชื่อสิทธิ์ 'system:tenant:create' ให้ตรงกับในตาราง SecPermission ของคุณกฤษฎานะครับ
  @RequirePermissions('system:tenant:create') 
  async registerCompany(@Body() dto: CreateTenantDto) {
    return this.onboardingService.onboardNewTenant(dto);
  }
}