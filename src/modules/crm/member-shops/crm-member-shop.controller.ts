import { Controller, Get, Body, Patch, Param, UseGuards, Request, Query, ParseIntPipe } from '@nestjs/common';
import { CrmMemberShopService } from './crm-member-shop.service';
import { UpdateMemberShopDto, MemberShopQueryDto } from './dto/member-shop.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('crm/member-shops')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class CrmMemberShopController {
  constructor(private readonly service: CrmMemberShopService) {}

  @Get()
  @RequirePermissions('crm_member:view')
  findAll(@Request() req, @Query() query: MemberShopQueryDto) {
    return this.service.findAll(req.user.companyId, query);
  }

  @Get(':id')
  @RequirePermissions('crm_member:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(req.user.companyId, id);
  }

  @Patch(':id')
  @RequirePermissions('crm_member:update')
  update(
    @Request() req, 
    @Param('id', ParseIntPipe) id: number, 
    @Body() dto: UpdateMemberShopDto
  ) {
    return this.service.update(req.user.companyId, id, dto);
  }

  @Patch(':id/adjust-points')
  @RequirePermissions('crm_member:update')
  adjustPoints(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body('amount') amount: number
  ) {
    return this.service.adjustPoints(req.user.companyId, id, amount);
  }
}