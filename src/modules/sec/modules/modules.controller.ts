import { 
  Controller, Get, Post, Body, Param, Put, Delete, 
  ParseIntPipe, UseGuards, Request ,Query
} from '@nestjs/common';
import { ModulesService } from './modules.service';
import { CreateModuleDto, UpdateModuleDto } from './modules.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) 
@Controller('sec/modules') 
export class ModulesController {
  constructor(private readonly service: ModulesService) {}

 @Get()
  @RequirePermissions('module:view')
  findAll(@Request() req, @Query('targetCompanyId') targetCompanyId?: string) {
    // 🌟 รับ targetCompanyId จากหน้าบ้าน (ถ้ามี) ส่งไปให้ Service
    const targetId = targetCompanyId ? parseInt(targetCompanyId) : undefined;
    return this.service.findAll(req.user, targetId); 
  }

  @Get(':id')
  @RequirePermissions('module:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('module:create')
  create(@Request() req, @Body() dto: CreateModuleDto) {
    return this.service.create(dto, req.user); // 🌟 ส่ง user ไปตรวจสิทธิ์
  }

  @Put(':id')
  @RequirePermissions('module:update')
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateModuleDto) {
    return this.service.update(id, dto, req.user); // 🌟 ส่ง user ไปตรวจสิทธิ์
  }

  @Delete(':id')
  @RequirePermissions('module:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user); // 🌟 ส่ง user ไปตรวจสิทธิ์
  }
}