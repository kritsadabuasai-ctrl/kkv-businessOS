import { 
  Controller, Get, Post, Delete, Body, Param, 
  Query, ParseIntPipe, UseGuards, Request
} from '@nestjs/common';
import { PackageModulesService } from './package-modules.service';
import { AddPackageModuleDto } from './package-modules.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('sec/package-modules') 
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) 
export class PackageModulesController {
  constructor(private readonly service: PackageModulesService) {}

  @Post()
  @RequirePermissions('package:update')
  add(@Request() req, @Body() dto: AddPackageModuleDto) {
    // 🌟 ส่ง req.user ไปให้ Service ตรวจสอบสิทธิ์แบบละเอียด
    return this.service.add(dto, req.user);
  }

  @Get(':packageId') 
  @RequirePermissions('package:view')
  findByPath(@Param('packageId', ParseIntPipe) packageId: number) {
    return this.service.findByPackage(packageId);
  }

  @Get() 
  @RequirePermissions('package:view')
  findByQuery(@Query('packageId', ParseIntPipe) packageId: number) {
    return this.service.findByPackage(packageId);
  }

  @Delete(':packageId/:moduleId')
  @RequirePermissions('package:update')
  remove(
    @Request() req,
    @Param('packageId', ParseIntPipe) packageId: number,
    @Param('moduleId', ParseIntPipe) moduleId: number
  ) {
    // 🌟 ส่ง req.user ไปให้ Service ตรวจสอบสิทธิ์แบบละเอียด
    return this.service.remove(packageId, moduleId, req.user);
  }
}