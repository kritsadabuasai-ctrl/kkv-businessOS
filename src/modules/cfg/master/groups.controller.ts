
import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateMasterGroupDto, UpdateMasterGroupDto } from './master.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
@Controller('cfg/master-groups')
export class GroupsController {
  constructor(private readonly service: GroupsService) {}

  @Post()
  @RequirePermissions('cfg:master:create') // เฉพาะ Admin ที่จัดการกลุ่มได้
  create(@Body() dto: CreateMasterGroupDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions('cfg:master:view')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermissions('cfg:master:view')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('activeOnly') activeOnly?: string // 👈 เพิ่มบรรทัดนี้
  ) {
    return this.service.findOne(id, activeOnly); // 👈 ส่งค่าต่อไป
  }

  // 🌟 [เพิ่มใหม่] API สำหรับรับคำสั่งแก้ไขกลุ่มข้อมูล
  @Put(':id')
  @RequirePermissions('cfg:master:edit') 
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMasterGroupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('cfg:master:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}