import { Controller, Get, Post, Body, Param, ParseIntPipe, Request, UseGuards, Query } from '@nestjs/common';
import { DecorationService } from './decoration.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { CreateDecorationClassDto, CreateDecorationRecordDto } from './decoration.dto';

@Controller('hr/decorations')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class DecorationController {
  constructor(private readonly service: DecorationService) {}

  // จัดการชั้นตรา (Master)
  @Post('classes')
  @RequirePermissions('decoration:create')
  createClass(@Request() req, @Body() dto: CreateDecorationClassDto) {
    return this.service.createClass(req.user.companyId, dto);
  }

  @Get('classes')
  @RequirePermissions('decoration:view')
  getClasses(@Request() req) {
    return this.service.findAllClasses(req.user.companyId);
  }

  // บันทึกประวัติ (Transaction)
  @Post('records')
  @RequirePermissions('decoration:create')
  createRecord(@Request() req, @Body() dto: CreateDecorationRecordDto) {
    return this.service.createRecord(req.user.companyId, dto);
  }

  @Get('records')
  @RequirePermissions('decoration:view')
  getAllRecords(@Request() req, @Query('year') year?: string) {
    return this.service.findAllRecords(
      req.user.companyId, 
      year ? parseInt(year) : undefined
    );
  }

  @Get('employee/:id')
  @RequirePermissions('decoration:view')
  getEmployeeHistory(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.findEmployeeHistory(req.user.companyId, id);
  }
}