import { Controller, Get, Post, Body, Request, UseGuards, Query } from '@nestjs/common';
import { TrainingService } from './training.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { CreateCourseDto, CreateSessionDto, EnrollEmployeeDto } from './training.dto';

@Controller('hr/training')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class TrainingController {
  constructor(private readonly service: TrainingService) {}

  @Post('courses')
  @RequirePermissions('training:create')
  createCourse(@Request() req, @Body() dto: CreateCourseDto) {
    return this.service.createCourse(req.user.companyId, dto);
  }

  @Get('courses')
  @RequirePermissions('training:view')
  getCourses(@Request() req) {
    return this.service.findAllCourses(req.user.companyId);
  }

  @Post('sessions')
  @RequirePermissions('training:create')
  createSession(@Request() req, @Body() dto: CreateSessionDto) {
    // 🌟 ดึง userId ส่งไปด้วยเพื่อให้ Workflow รู้ว่าใครเป็นคนขอตั้งเบิก
    const userId = req.user.id || req.user.userId;
    return this.service.createSession(req.user.companyId, userId, dto);
  }

  @Get('sessions')
  @RequirePermissions('training:view')
  getSessions(@Request() req, @Query('year') year: string) {
    return this.service.findSessions(req.user.companyId, parseInt(year));
  }

  @Post('enroll')
  @RequirePermissions('training:update')
  enroll(@Request() req, @Body() dto: EnrollEmployeeDto) {
    // 🌟 ดึง userId ส่งไปด้วยเพื่อให้ Workflow รู้ว่าใครเป็นคนกดขออนุญาต
    const userId = req.user.id || req.user.userId;
    return this.service.enrollEmployees(req.user.companyId, userId, dto);
  }
}