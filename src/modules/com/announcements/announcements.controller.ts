import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  ParseIntPipe, 
  UseGuards, 
  Request, 
  Query 
} from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/announcements')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Post()
  @RequirePermissions('announcement:create')
  create(@Body() dto: CreateAnnouncementDto, @Request() req) {
    dto.companyId = req.user.companyId;
    return this.service.create(dto);
  }

  // 1. ดึงทั้งหมด (สำหรับ Backoffice Admin ดู)
  @Get()
  @RequirePermissions('announcement:view')
  findAll(
    @Request() req,
    @Query('shopId') shopId?: number 
  ) {
    return this.service.findAll(req.user.companyId, shopId);
  }

  // 2. ดึงเฉพาะที่ "กำลังแสดงผล" (สำหรับ Frontend / App)
  @Get('active')
  @RequirePermissions('announcement:view')
  findActive(
    @Request() req,
    @Query('shopId') shopId?: number,   
    @Query('position') position?: string
  ) {
    return this.service.findActive(req.user.companyId, shopId, position); 
  }

  @Get(':id')
  @RequirePermissions('announcement:view')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Patch(':id')
  @RequirePermissions('announcement:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
    @Request() req
  ) {
    // 🚩 แก้ไขลำดับการส่ง Parameter เป็น: id, dto, companyId
    return this.service.update(id, dto, req.user.companyId);
  }

  @Delete(':id')
  @RequirePermissions('announcement:delete')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    // 🚩 แก้ไขลำดับการส่ง Parameter เป็น: id, companyId
    return this.service.remove(id, req.user.companyId);
  }
}