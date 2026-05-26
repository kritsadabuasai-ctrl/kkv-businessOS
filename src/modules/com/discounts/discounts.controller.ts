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
  Query,
  BadRequestException 
} from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/discounts')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class DiscountsController {
  constructor(private readonly service: DiscountsService) {}

  // 🎟️ 1. สร้างคูปองส่วนลดใหม่
  @Post()
  @RequirePermissions('discount:create') 
  create(@Body() dto: CreateDiscountDto, @Request() req) {
    dto.companyId = req.user.companyId;
    return this.service.create(dto);
  }

  // 🎟️ 2. เรียกดูรายการส่วนลดทั้งหมดภายในบริษัท (สามารถกรองตาม shopId ได้)
  @Get()
  @RequirePermissions('discount:view')
  findAll(@Request() req, @Query('shopId') shopId?: string) {
    return this.service.findAll(
      req.user.companyId, 
      shopId ? Number(shopId) : undefined
    );
  }

  // 🎟️ 3. ตรวจเช็คความถูกต้องของรหัสคูปองจากหน้าร้าน (Frontend Check)
  @Get('check/:code')
  findByCode(
    @Param('code') code: string, 
    @Request() req,
    @Query('shopId') shopId?: string,
    @Query('cid') cid?: string 
  ) {
    const companyId = req.user?.companyId || (cid ? Number(cid) : null);
    if (!companyId) throw new BadRequestException('กรุณาระบุรหัสบริษัทเป้าหมาย (Company ID)');
    
    return this.service.findByCode(
      companyId, 
      code, 
      shopId ? Number(shopId) : undefined
    );
  }

  // 🎟️ 4. ดูรายละเอียดคูปองส่วนลดรายตัว
  @Get(':id')
  @RequirePermissions('discount:view')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user.companyId);
  }

  // 🎟️ 5. แก้ไขข้อมูลส่วนลดโปรโมชั่น
  @Patch(':id')
  @RequirePermissions('discount:update') 
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Request() req, 
    @Body() dto: UpdateDiscountDto
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  // 🎟️ 6. ลบคูปองส่วนลดออกจากระบบ
  @Delete(':id')
  @RequirePermissions('discount:delete') 
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.remove(id, req.user.companyId);
  }
}