import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { InstagramConfigsService } from './instagram-configs.service';
import { CreateInstagramConfigDto, UpdateInstagramConfigDto } from './instagram-configs.dto';

import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('int/instagram-configs') // 🌟 Endpoint หลักคือ /api/int/instagram-configs
export class InstagramConfigsController {
  constructor(private readonly service: InstagramConfigsService) {}

  @Post()
  @RequirePermissions('int:instagram:create')
  create(@Request() req, @Body() dto: CreateInstagramConfigDto) {
    return this.service.create(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('int:instagram:view')
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  @Get(':id')
  @RequirePermissions('int:instagram:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Put(':id')
  @RequirePermissions('int:instagram:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInstagramConfigDto,
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @RequirePermissions('int:instagram:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user.companyId);
  }
}