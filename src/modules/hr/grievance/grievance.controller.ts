import { Controller, Get, Post, Put, Body, Param, ParseIntPipe, Request, UseGuards, Query } from '@nestjs/common';
import { GrievanceService } from './grievance.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { CreateGrievanceTypeDto, CreateGrievanceTicketDto, ResolveGrievanceDto } from './grievance.dto';

@Controller('hr/grievance')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class GrievanceController {
  constructor(private readonly service: GrievanceService) {}

  // Master Settings
  @Post('types')
  @RequirePermissions('grievance:create')
  createType(@Request() req, @Body() dto: CreateGrievanceTypeDto) {
    return this.service.createType(req.user.companyId, dto);
  }

  @Get('types')
  @RequirePermissions('grievance:view')
  getTypes(@Request() req) {
    return this.service.findAllTypes(req.user.companyId);
  }

  // Transactions
  @Post('tickets')
  @RequirePermissions('grievance:create')
  createTicket(@Request() req, @Body() dto: CreateGrievanceTicketDto) {
    return this.service.createTicket(req.user.companyId, dto);
  }

  @Get('tickets')
  @RequirePermissions('grievance:view')
  getAllTickets(@Request() req, @Query() query: any) {
    return this.service.findAllTickets(req.user.companyId, query);
  }

  @Put('tickets/:id/resolve')
  @RequirePermissions('grievance:update')
  resolveTicket(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: ResolveGrievanceDto) {
    return this.service.resolveTicket(req.user.companyId, id, dto);
  }
}