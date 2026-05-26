import { Controller, Get, Body, Patch, UseGuards, Request } from '@nestjs/common';
import { CompanyConfigsService } from './company-configs.service';
import { UpdateCrmConfigDto } from './dto/update-crm-config.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';


@Controller('crm/company-configs')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class CompanyConfigsController {
  constructor(private readonly service: CompanyConfigsService) {}

  @Get()
  @RequirePermissions('company-configs:view')
  getConfig(@Request() req) {
    return this.service.findOne(req.user.companyId);
  }

  @Patch()
    @RequirePermissions('company-configs:update') // ✅ เพิ่ม Decorator สำหรับสิทธิ์
    update(@Body() dto: UpdateCrmConfigDto, @Request() req) {
    // TODO: เพิ่มสิทธิ์การตรวจสอบว่าเป็นแอดมินระดับสูงของบริษัท
    return this.service.update(req.user.companyId, dto);
  }
}