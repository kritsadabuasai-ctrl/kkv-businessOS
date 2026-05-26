import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  ParseIntPipe, 
  Query, 
  UseGuards, 
  Request // 🌟 อย่าลืม Import Request
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/tags')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class TagsController {
  constructor(private readonly service: TagsService) {}

  // สร้าง Tag ใหม่
  @Post()
  @RequirePermissions('tag:create')
  create(@Body() dto: CreateTagDto, @Request() req) {
    // 🏢 ส่ง companyId เข้าไปด้วย
    return this.service.create(req.user.companyId, dto);
  }

  // ค้นหา Tag: /com/tags?search=เสื้อ
  @Get()
  @RequirePermissions('tag:view')
  findAll(@Request() req, @Query('search') search?: string) {
    // 🏢 ดึงเฉพาะ Tag ของบริษัทตัวเอง
    return this.service.findAll(req.user.companyId, search);
  }

  // ดูรายละเอียด
  @Get(':id')
  @RequirePermissions('tag:view')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(req.user.companyId, id);
  }

  // แก้ไขคำผิดของ Tag
  @Patch(':id')
  @RequirePermissions('tag:update')
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() dto: UpdateTagDto, 
    @Request() req
  ) {
    return this.service.update(req.user.companyId, id, dto);
  }

  // ลบ Tag
  @Delete(':id')
  @RequirePermissions('tag:delete')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(req.user.companyId, id);
  }
}