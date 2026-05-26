import { 
  Controller, Get, Post, Put, Body, Param, ParseIntPipe, Request, UseGuards, Query 
} from '@nestjs/common';
import { DisciplinaryService } from './disciplinary.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { 
  CreateDisciplinaryIncidentDto, 
  UpdateDisciplinaryStatusDto, 
  CreateDisciplinaryActionDto 
} from './disciplinary.dto';

@Controller('hr/disciplinary')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class DisciplinaryController {
  constructor(private readonly service: DisciplinaryService) {}

  // --- Master Data ---
  @Get('offense-types')
  @RequirePermissions('disciplinary:view')
  getOffenseTypes(@Request() req) {
    return this.service.findAllOffenseTypes(req.user.companyId);
  }

  @Get('penalty-types')
  @RequirePermissions('disciplinary:view')
  getPenaltyTypes(@Request() req) {
    return this.service.findAllPenaltyTypes(req.user.companyId);
  }

  // --- Incidents (การแจ้งความผิด) ---
  @Post('incidents')
  @RequirePermissions('disciplinary:create')
  createIncident(@Request() req, @Body() dto: CreateDisciplinaryIncidentDto) {
    return this.service.createIncident(req.user.companyId, req.user.id, dto);
  }

  @Get('incidents')
  @RequirePermissions('disciplinary:view')
  findAllIncidents(@Request() req, @Query() query: any) {
    return this.service.findAllIncidents(req.user.companyId, query);
  }

  // --- Actions (การลงโทษ) ---
  @Post('actions')
  @RequirePermissions('disciplinary:update')
  recordAction(@Request() req, @Body() dto: CreateDisciplinaryActionDto) {
    // บันทึกบทลงโทษ โดยใช้สิทธิ์ผู้มีอำนาจ (เช่น HR Manager)
    return this.service.recordAction(req.user.companyId, req.user.id, dto);
  }
}