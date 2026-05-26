import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  ParseIntPipe, 
  Request, 
  UseGuards 
} from '@nestjs/common';
import { ShopProfilesService } from './shop-profiles.service';
import { CreateShopProfileDto } from './dto/create-shop-profile.dto';
import { UpdateShopProfileDto } from './dto/update-shop-profile.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('com/shop-profiles')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@RequirePermissions('shop-profile:view') // 🛡️ สิทธิ์พื้นฐานในการเข้าถึงโมดูลนี้
export class ShopProfilesController {
  constructor(private readonly service: ShopProfilesService) {}

  @Post()
  @RequirePermissions('shop-profile:create')
  create(@Request() req, @Body() dto: CreateShopProfileDto) {
    return this.service.create(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('shop-profile:view')
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  @Get(':id')
  @RequirePermissions('shop-profile:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Patch(':id')
  @RequirePermissions('shop-profile:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShopProfileDto
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @RequirePermissions('shop-profile:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user.companyId);
  }
}