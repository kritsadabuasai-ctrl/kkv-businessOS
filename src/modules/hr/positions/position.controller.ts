import { 
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Request
} from '@nestjs/common';
import { PositionService } from './position.service';
import { CreatePositionDto, UpdatePositionDto } from './position.dto';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('hr/positions')
@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 2. ใส่ PermissionsGuard คุมประตู
export class PositionController {
  constructor(private readonly service: PositionService) {}

  // 1. ดูรายชื่อตำแหน่งทั้งหมด
  @Get()
  @RequirePermissions('position:view')
  getAll(@Request() req) {
    return this.service.getAllPositions(req.user.companyId);
  }

  // 2. ดูรายละเอียดตำแหน่งเดียว
  @Get(':id')
  @RequirePermissions('position:view')
  getOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.getPositionById(req.user.companyId, id);
  }

  // 3. สร้างตำแหน่งใหม่
  @Post()
  @RequirePermissions('position:create')
  create(@Body() dto: CreatePositionDto, @Request() req) {
    dto.companyId = req.user.companyId; // ✅ Override ด้วย ID จริง ปลอดภัยแน่นอน
    return this.service.createPosition(dto);
  }

  // 4. แก้ไขตำแหน่ง
  @Put(':id')
  @RequirePermissions('position:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePositionDto,
    @Request() req
  ) {
    return this.service.updatePosition(req.user.companyId, id, dto);
  }

  // 5. ลบตำแหน่ง
  @Delete(':id')
  @RequirePermissions('position:delete')
  delete(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.deletePosition(req.user.companyId, id);
  }
}