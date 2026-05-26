import { Controller, Get, Param, ParseIntPipe, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../../../prisma/prisma.service'; // ตรวจสอบ Path
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // ตรวจสอบ Path
import { RequirePermissions } from '../auth/permissions.decorator'; // ตรวจสอบ Path
import { PermissionsGuard } from '../auth/permissions.guard'; // ตรวจสอบ Path

@ApiTags('Security Login Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sec-login-logs')
export class SecLoginLogController {
  constructor(private prisma: PrismaService) {}

  @ApiOperation({ summary: 'ดึงประวัติการเข้าสู่ระบบทั้งหมดของบริษัท' })
  // ควรกำหนด Permission สำหรับแอดมินหรือผู้ที่มีสิทธิ์ดู Log เท่านั้น
  @RequirePermissions('system:view_logs') 
  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'SUCCESS, FAILED, LOGOUT' })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  async getLoginLogs(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('userId') userIdStr?: string,
  ) {
    const companyId = req.user.companyId;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const whereCondition: any = {
      companyId: companyId,
    };

    if (status) {
      whereCondition.status = status;
    }

    if (userIdStr) {
      const userId = parseInt(userIdStr, 10);
      if (!isNaN(userId)) {
        whereCondition.userId = userId;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.secLoginLog.findMany({
        where: whereCondition,
        skip,
        take: limitNumber,
        orderBy: { loginAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, fullName: true }
          }
        }
      }),
      this.prisma.secLoginLog.count({ where: whereCondition }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  }

  @ApiOperation({ summary: 'ดูประวัติการเข้าสู่ระบบของตัวเอง' })
  @Get('me')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyLoginLogs(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const companyId = req.user.companyId;
    const userId = Number(req.user.userId || req.user.sub);
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const whereCondition = {
      companyId: companyId,
      userId: userId,
    };

    const [logs, total] = await Promise.all([
      this.prisma.secLoginLog.findMany({
        where: whereCondition,
        skip,
        take: limitNumber,
        orderBy: { loginAt: 'desc' },
      }),
      this.prisma.secLoginLog.count({ where: whereCondition }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  }
}