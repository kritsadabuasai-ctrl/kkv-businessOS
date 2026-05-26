import { 
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Request, UseGuards, ForbiddenException 
} from '@nestjs/common';
import { SecUserDelegationService } from './sec-user-delegation.service';
import { CreateDelegationDto, UpdateDelegationDto } from './sec-user-delegation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard'; 
import { SubscriptionGuard } from '../auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('sec/delegations')
export class SecUserDelegationController {
  constructor(private readonly service: SecUserDelegationService) {}

  @Post()
  @RequirePermissions('delegation:create')
  create(@Request() req, @Body() dto: CreateDelegationDto & { ownerUserId?: number }) {
    const loggedInUserId = req.user.userId;
    const companyId = req.user.companyId;
    const roleId = req.user.roleId; // ดึง roleId มาตรวจสอบสิทธิ์ Admin

    // 🌟 หากหน้าบ้านส่ง ownerUserId มา (เคส Admin/HR คีย์แทนคนอื่น) ให้ใช้ค่านั้น หากไม่มีส่งมาให้ใช้ของคนที่ล็อกอิน
    const targetOwnerId = dto.ownerUserId ? Number(dto.ownerUserId) : loggedInUserId;

    // 🛡️ Security Check: ถ้าเป็นการคีย์แทนคนอื่น คนกดปุ่มต้องเป็น Admin (Role ID: 1) เท่านั้น
    if (targetOwnerId !== loggedInUserId && roleId !== 1) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ตั้งค่าการมอบหมายงานแทนพนักงานท่านอื่นครับ');
    }

    return this.service.create(targetOwnerId, companyId, dto);
  }

  @Get('given')
  @RequirePermissions('delegation:view')
  getMyGiven(@Request() req) {
    return this.service.getMyGivenDelegations(req.user.userId);
  }

  @Get('received')
  @RequirePermissions('delegation:view')
  getMyReceived(@Request() req) {
    return this.service.getMyReceivedDelegations(req.user.userId);
  }

  @Put(':id')
  @RequirePermissions('delegation:update')
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDelegationDto) {
    // 🌟 ส่ง roleId เข้าไปใน Service เพิ่มเติมเพื่อให้ Admin สามารถเข้าไปแก้ไขรายการแทนคนอื่นได้
    return this.service.update(id, req.user.userId, req.user.roleId, dto);
  }

  @Delete(':id')
  @RequirePermissions('delegation:delete')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    // 🌟 ส่ง roleId เข้าไปใน Service เพิ่มเติมเพื่อให้ Admin สามารถลบรายการโอนสิทธิ์ฉุกเฉินได้
    return this.service.remove(id, req.user.userId, req.user.roleId);
  }
}