import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { FacebookPagesService } from './facebook-pages.service';
import { CreateFacebookPageDto, UpdateFacebookPageDto } from './facebook-pages.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('int/facebook-pages')
export class FacebookPagesController {
  constructor(private readonly service: FacebookPagesService) {}

  // ==========================================
  // 🟢 NEW: API สำหรับนำ Short-lived token มาแลกเพื่อดึงเพจ
  // ==========================================
  @Post('exchange-token')
  @RequirePermissions('int:facebook:create')
  exchangeToken(@Request() req, @Body('shortLivedToken') shortLivedToken: string) {
    return this.service.exchangeTokenAndFetchPages(req.user.companyId, shortLivedToken);
  }

  @Post()
  @RequirePermissions('int:facebook:create')
  create(@Request() req, @Body() dto: CreateFacebookPageDto) {
    return this.service.create(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('int:facebook:view')
  findAll(@Request() req) {
    return this.service.findAll(req.user.companyId);
  }

  @Get(':id')
  @RequirePermissions('int:facebook:view')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id, req.user.companyId);
  }

@Post(':pageId/refresh') // เช่น POST /api/int/facebook-pages/12345/refresh
@ApiOperation({ summary: 'บังคับต่ออายุ Token ของเพจด้วยตัวเอง' })
async refreshPageToken(@Param('pageId') pageId: string) {
  return await this.service.refreshPageToken(pageId);
}

  @Put(':id')
  @RequirePermissions('int:facebook:update')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFacebookPageDto,
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @RequirePermissions('int:facebook:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user.companyId);
  }

  
}