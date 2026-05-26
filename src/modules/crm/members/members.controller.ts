import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('crm/members')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) // 🌟 เพิ่ม PermissionsGuard และ SubscriptionGuard ตรงนี้เพื่อเปิดระบบเช็คสิทธิ์และสมัครสมาชิก
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @RequirePermissions('crm_member:create') // 🌟 ล็อกสิทธิ์: ต้องมีสิทธิ์สร้าง
  create(@Request() req, @Body() createMemberDto: CreateMemberDto) {
    return this.membersService.create(req.user.companyId, createMemberDto);
  }

  @Get()
  @RequirePermissions('crm_member:view')
  findAll(
    @Request() req,
    @Query('search') search?: string,
    @Query('level') level?: string,
    @Query('shopId') shopId?: string, // 🌟 เพิ่มรับค่า shopId
  ) {
    // แปลง shopId เป็นตัวเลขก่อนส่งไป Service
    const parsedShopId = shopId ? parseInt(shopId, 10) : undefined;
    return this.membersService.findAll(req.user.companyId, search, level, parsedShopId);
  }

  @Get(':id')
  @RequirePermissions('crm_member:view') // 🌟 ล็อกสิทธิ์: ต้องมีสิทธิ์ดูข้อมูล
  findOne(@Request() req, @Param('id') id: string) {
    return this.membersService.findOne(req.user.companyId, +id);
  }

  @Patch(':id')
  @RequirePermissions('crm_member:update') // 🌟 ล็อกสิทธิ์: ต้องมีสิทธิ์แก้ไข
  update(@Request() req, @Param('id') id: string, @Body() updateMemberDto: UpdateMemberDto) {
    return this.membersService.update(req.user.companyId, +id, updateMemberDto);
  }

  @Delete(':id')
  @RequirePermissions('crm_member:delete') // 🌟 ล็อกสิทธิ์: ต้องมีสิทธิ์ลบ
  remove(@Request() req, @Param('id') id: string) {
    return this.membersService.remove(req.user.companyId, +id);
  }
}