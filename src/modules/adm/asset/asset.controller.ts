import { Controller, Get, Post, Body, Param, ParseIntPipe, Query, Request, UseGuards } from '@nestjs/common';
import { AssetService } from './asset.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { CreateAssetCategoryDto, CreateAssetDto, CreateAssetRequestDto } from './asset.dto';

@Controller('adm/assets')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) // 🔒 Triple-Guard Standard
export class AssetController {
  constructor(private readonly service: AssetService) {}

  // --- หมวดหมู่ครุภัณฑ์ ---
  @Post('categories')
  @RequirePermissions('asset:create')
  createCategory(@Request() req, @Body() dto: CreateAssetCategoryDto) {
    return this.service.createCategory(req.user.companyId, dto);
  }

  @Get('categories')
  @RequirePermissions('asset:view')
  getCategories(@Request() req) {
    return this.service.findAllCategories(req.user.companyId);
  }

  // --- ทะเบียนครุภัณฑ์ ---
  @Post()
  @RequirePermissions('asset:create')
  createAsset(@Request() req, @Body() dto: CreateAssetDto) {
    return this.service.createAsset(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('asset:view')
  getAssets(@Request() req, @Query() query: any) {
    return this.service.findAllAssets(req.user.companyId, query);
  }

  // --- ใบคำร้อง (เบิก, ซ่อม, จัดซื้อ) ---
  @Post('requests')
  @RequirePermissions('asset:create')
  createRequest(@Request() req, @Body() dto: CreateAssetRequestDto) {
    return this.service.createRequest(req.user.companyId, dto);
  }

  @Get('requests')
  @RequirePermissions('asset:view')
  getRequests(@Request() req) {
    return this.service.findAllRequests(req.user.companyId);
  }
}