import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, ParseIntPipe } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('crm/rewards')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class RewardsController {
  constructor(private readonly service: RewardsService) {}

  // ➕ สร้างของรางวัลชิ้นใหม่
  @Post()
  @RequirePermissions('reward', 'create')
  create(@Request() req, @Body() dto: CreateRewardDto) {
    dto.companyId = req.user.companyId; 
    return this.service.create(dto);
  }

  // 🔍 เรียกดูรายการของรางวัลทั้งหมดภายใต้บริษัทสังกัด
  @Get()
  @RequirePermissions('reward:view')
  findAll(
    @Request() req,
    @Query('shopId') shopId?: string 
  ) {
    return this.service.findAll(req.user.companyId, shopId ? parseInt(shopId, 10) : undefined);
  }

  // 🔍 ดูรายละเอียดของรางวัลชิ้นเดี่ยว
  @Get(':id')
  @RequirePermissions('reward:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // 📝 อัปเดตรายละเอียดของรางวัลชิ้นที่กำหนด
  @Patch(':id')
  @RequirePermissions('reward:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRewardDto
  ) {
    return this.service.update(id, dto);
  }

  // ❌ สั่งลบข้อมูลของรางวัลชิ้นที่ระบุ
  @Delete(':id')
  @RequirePermissions('reward:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}