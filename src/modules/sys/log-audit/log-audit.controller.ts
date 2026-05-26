import { Controller, Get, Post, Body, Query, Param, UseGuards, Request, Ip, Headers } from '@nestjs/common';
import { LogAuditService } from './log-audit.service';
import { CreateLogAuditDto } from './dto/create-log-audit.dto';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
@Controller('sys/log-audit')
export class LogAuditController {
  constructor(private readonly service: LogAuditService) {}

  @Get()
  @RequirePermissions('audit:view')
  findAll(
    @Request() req, 
    @Query('companyId') queryCompanyId?: string,
    @Query('page') page: string = '1', // 🌟 รับ page (default 1)
    @Query('limit') limit: string = '20' // 🌟 รับ limit (default 20)
  ) { 
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    return this.service.findAll(targetCompanyId, pageNum, limitNum);
  }

  @Get('history')
  @RequirePermissions('audit:view')
  getHistory(
    @Request() req, 
    @Query('companyId') queryCompanyId: string, // 🌟 เพิ่มการรับค่า
    @Query('table') tableName: string,
    @Query('id') recordId: string
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.findByRecord(targetCompanyId, tableName, recordId);
  }

  @Get('user/:userId')
  @RequirePermissions('audit:view')
  getByUser(
    @Request() req, 
    @Query('companyId') queryCompanyId: string, // 🌟 เพิ่มการรับค่า
    @Param('userId') userId: string
  ) { 
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.findByUser(targetCompanyId, +userId);
  }

  @Post()
  @RequirePermissions('audit:create')
  create(
    @Body() dto: CreateLogAuditDto, 
    @Request() req,
    @Ip() ip: string, // 🌟 1. รับค่า IP
    @Headers('user-agent') userAgent: string // 🌟 2. รับค่า User Agent
  ) {
    // 🌟 ดักเผื่อกรณีหน้าบ้านไม่ส่ง companyId มาให้บังคับใช้ของคนล็อกอิน
    dto.companyId = dto.companyId || req.user.companyId;
    dto.userId = req.user.userId;
    // 🌟 3. ยัดค่าลง DTO ก่อนส่งให้ Service
    dto.ipAddress = ip;
    dto.userAgent = userAgent;

    return this.service.log(dto);
  }
}