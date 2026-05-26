import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { LineConfigsService } from './line-configs.service';
import { CreateLineConfigDto, UpdateLineConfigDto } from './line-configs.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
@Controller('int/line-configs')
export class LineConfigsController {
  constructor(private readonly service: LineConfigsService) {}

  @Post()
  @RequirePermissions('int:line:create')
  create(@Request() req, @Body() dto: CreateLineConfigDto) {
    return this.service.create(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('int:line:view')
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  @Put(':id')
  @RequirePermissions('int:line:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLineConfigDto,
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @RequirePermissions('int:line:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user.companyId);
  }
}