import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  // 🌟 เพิ่ม Logger เพื่อให้ดูสาเหตุ 403 ใน Google Cloud Run ได้ง่ายขึ้น
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (user && user.isSuperAdmin) {
      return true;
    }
    
    if (!user || !user.userId) {
      throw new ForbiddenException('User context missing');
    }

    if (!user.companyId) {
       throw new ForbiddenException('Company context missing (Please select a company)');
    }

    const uId = Number(user.userId);
    const cId = Number(user.companyId);

    const activeSubscriptions = await this.prisma.orgSubscription.findMany({
      where: {
        companyId: cId,
        status: 'ACTIVE',
      }
    });
    
    const now = new Date();
    const validSubscriptions = activeSubscriptions.filter(sub => {
      if (!sub.endDate) return true;
      return new Date(sub.endDate).getTime() > now.getTime();
    });

    const activeModuleIds = validSubscriptions.map(sub => Number(sub.moduleId));

    const userRolesWithPermissions = await this.prisma.secUserRole.findMany({
      where: {
        userId: uId,
        companyId: cId,
      },
      include: {
        role: {
          include: {
            permissions: { 
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!userRolesWithPermissions || userRolesWithPermissions.length === 0) {
      this.logger.warn(`[403] User ${uId} ไม่มี Role ในบริษัท ${cId}`);
      throw new ForbiddenException('You have no roles in this company');
    }

    // 🌟 5. แปลงสิทธิ์ทั้งหมดที่ดึงมาจาก DB ให้เป็น "ตัวพิมพ์เล็ก (.toLowerCase())"
    const userPermissions = userRolesWithPermissions.flatMap((ur) =>
      ur.role.permissions
        .filter(rp => {
          const modId = rp.permission?.moduleId;
          if (!modId) return true; 
          return activeModuleIds.includes(Number(modId));
        })
        .map((rp) => `${rp.permission.resource}:${rp.permission.action}`.toLowerCase())
    );

    if (userPermissions.includes('*:*') || userPermissions.includes('all')) {
      return true;
    }

    // 🌟 6. แปลงสิทธิ์ที่ API ร้องขอให้เป็นตัวพิมพ์เล็กเหมือนกันก่อนเทียบ
    const reqPermsLower = requiredPermissions.map(p => p.toLowerCase());
    const hasPermission = reqPermsLower.some((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasPermission) {
      // 🌟 พิมพ์ Log สีแดงบอกชัดๆ ใน Console/Cloud Run ว่าขาดสิทธิ์อะไร!
      
      this.logger.error(`[403 Denied] User:${uId} | Company:${cId} | Req:[${reqPermsLower.join(',')}] | Pocket:[${userPermissions.join(',')}]`);
      throw new ForbiddenException('You do not have permission or the required module subscription has expired (403 Access Denied)');
    }

    return true;
  }
}