import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { RoundingRulesService } from './rounding-rules.service';
import { CreateRoundingRuleDto, UpdateRoundingRuleDto } from './rounding-rules.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; // 🌟 อัปเดต Path
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 นำเข้า PermissionsGuard
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; // 🌟 อัปเดต Path
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('cfg/rounding-rules') // 🌟 เติม api/ ให้เป็นมาตรฐาน
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🌟 ปิดประตู! ล็อกสิทธิ์ระดับคลาส (บังคับใช้กับทุก Endpoint)
export class RoundingRulesController {
  constructor(private readonly service: RoundingRulesService) {}

  @Post()
  @RequirePermissions('cfg:rounding:create')
  create(@Request() req, @Body() dto: CreateRoundingRuleDto) {
    return this.service.create(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('cfg:rounding:view')
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  @Get(':id')
  @RequirePermissions('cfg:rounding:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id, req.user.companyId);
  }

 @Put(':id')
  @RequirePermissions('cfg:rounding:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoundingRuleDto
  ) {
    // 🌟 ดึง userId จาก Token
    const userId = Number(req.user.userId || req.user.sub);
    const companyId = Number(req.user.companyId);

    // 🌟 ส่ง userId ไปให้ Service ตรวจสอบ
    return this.service.update(id, companyId, dto, userId);
  }

  @Delete(':id')
  @RequirePermissions('cfg:rounding:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user.companyId);
  }
}