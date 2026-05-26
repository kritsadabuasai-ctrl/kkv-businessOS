import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards, Request, Query } from '@nestjs/common';
import { CloudConfigsService } from './cloud-configs.service';
import { CreateCloudConfigDto, UpdateCloudConfigDto } from './cloud-configs.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
@Controller('int/cloud-configs')
export class CloudConfigsController {
  constructor(private readonly service: CloudConfigsService) {}

  @Post()
  @RequirePermissions('int:cloud:create')
  create(
    @Request() req, 
    @Body() dto: CreateCloudConfigDto,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.create(targetCompanyId, dto);
  }

  @Get()
  @RequirePermissions('int:cloud:view')
  findAll(
    @Request() req,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.findAll(targetCompanyId);
  }

  @Put(':id')
  @RequirePermissions('int:cloud:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCloudConfigDto,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.update(id, targetCompanyId, dto);
  }

  @Delete(':id')
  @RequirePermissions('int:cloud:delete')
  remove(
    @Request() req, 
    @Param('id', ParseIntPipe) id: number,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.remove(id, targetCompanyId);
  }
}