import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { PasswordPolicyService } from './password-policy.service';
import { UpdatePasswordPolicyDto } from './password-policy.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 2. เพิ่ม PermissionsGuard ควบคู่กับ JWT
@Controller('sec/password-policy')
export class PasswordPolicyController {
  constructor(private readonly service: PasswordPolicyService) {}

  @Get('effective')
  @RequirePermissions('password-policy:view')
  getEffective(@Request() req) {
    // 🛡️ ส่ง companyId ของผู้ใช้ไปดึง Policy (ถ้าเป็น Super Admin อาจส่ง null ไปได้)
    return this.service.getEffectivePolicy(req.user.companyId);
  }

  @Put()
  @RequirePermissions('password-policy:update')
  update(@Request() req, @Body() dto: UpdatePasswordPolicyDto) {
    // 🛡️ บังคับอัปเดต Policy เฉพาะในขอบเขตบริษัทของตัวเองเท่านั้น (ป้องกัน IDOR)
    return this.service.updatePolicy(req.user.companyId, dto);
  }
}