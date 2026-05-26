import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. ตรวจสอบ Public Decorator (ถ้าเป็น Public API ให้ผ่านเลย)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 2. Super Admin ผ่านตลอด (ไม่ต้องเช็ควันหมดอายุ หรือสถานะบริษัท)
    if (user && user.isSuperAdmin) return true;

    // 3. ถ้าไม่มี companyId ให้ผ่านไปก่อน
    if (!user || !user.companyId) return true;

    // 4. ดึงข้อมูลสถานะบริษัทจาก DB
    const company = await this.prisma.orgCompany.findUnique({
      where: { id: Number(user.companyId) },
      select: { 
        isActive: true, 
        packageExpiresAt: true 
      }
    });

    if (!company) throw new ForbiddenException('ไม่พบข้อมูลบริษัท หรือคุณไม่มีสิทธิ์ในบริษัทนี้');

    // 🚫 เช็คว่าบริษัทถูกระงับ (Ban/Suspend) ถาวรหรือไม่
    if (!company.isActive) {
      throw new ForbiddenException('บัญชีบริษัทนี้ถูกระงับการใช้งาน (Suspended) กรุณาติดต่อผู้ดูแลระบบ');
    }

    // ✅ ข้อยกเว้น (Rescue Logic): URL ที่ยอมให้ผ่านไปจัดการบิลหรือตั้งค่าได้เสมอ
    const requestPath = request.path || request.url;
    const allowedKeywords = [
      '/billing', '/packages', '/subscription', 
      '/payments', '/me', '/auth/switch-company'
    ];
    if (allowedKeywords.some(keyword => requestPath.includes(keyword))) {
      return true; 
    }

    // 🌟 ตัวแปรเช็คว่าเป็นโหมด "อ่านอย่างเดียว" หรือไม่ (GET, OPTIONS, HEAD)
    const isReadOnlyMethod = ['GET', 'OPTIONS', 'HEAD'].includes(request.method);
    let isExpired = false;

    // ⚠️ 5. เช็ควันหมดอายุระดับ "บริษัท" (Package Expiry)
    if (company.packageExpiresAt && company.packageExpiresAt < new Date()) {
      isExpired = true;
    }

    // ⚠️ 6. เช็ควันหมดอายุระดับ "โมดูล" (Module Subscription)
    const requiredPermissions = this.reflector.get<string[]>('permissions', context.getHandler());
    if (requiredPermissions && requiredPermissions.length > 0) {
      const permissionCode = requiredPermissions[0]; // ค่าที่ได้มาจะเป็นแนวๆ 'customer:create'
      
      // 🌟 1. หั่นข้อความด้วยเครื่องหมาย ':' เพื่อแยก Resource กับ Action ออกจากกัน
      const [resource, action] = permissionCode.split(':');

      // 🌟 2. ใช้ findFirst และค้นหาจากฟิลด์ resource และ action ตาม Schema จริง
      const permission = await this.prisma.secPermission.findFirst({
        where: { 
          resource: resource,
          action: action
        },
        select: { moduleId: true }
      });

      if (permission && permission.moduleId) {
        // ดึงสถานะ Subscription ของโมดูลนั้นๆ
       const subscription = await this.prisma.orgSubscription.findUnique({
          where: {
            companyId_moduleId: {
              companyId: Number(user.companyId),
              moduleId: permission.moduleId
            }
          }
        });

        if (subscription) {
          if (subscription.status === 'SUSPENDED') {
             // ถ้าระงับเฉพาะโมดูลนี้ บล็อกการเข้าถึง 100%
             throw new ForbiddenException('SUSPENDED_MODE: โมดูลนี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ');
          }
          if (subscription.status === 'EXPIRED') {
             // ถ้าโมดูลนี้หมดอายุ ให้เข้าสู่สถานะ Expired
             isExpired = true;
          }
        }
      }
    }

    // 🛡️ 7. ลอจิก READ-ONLY MODE ทำงานตรงนี้ครับ
    if (isExpired) {
      if (isReadOnlyMethod) {
        // ถ้าระบบหมดอายุ แต่ลูกค้าแค่ดึงข้อมูลมาดู (GET) -> 🟢 อนุญาตให้ผ่าน
        return true; 
      } else {
        // ถ้าระบบหมดอายุ แล้วลูกค้าพยายาม กดเซฟ, เพิ่มข้อมูล, หรือลบ (POST, PUT, DELETE) -> 🔴 บล็อกพร้อมพ่น Error พิเศษ
        throw new ForbiddenException('READ_ONLY_MODE: แพ็กเกจหรือโมดูลนี้หมดอายุแล้ว ระบบอยู่ในโหมดอ่านอย่างเดียว (Read-Only) กรุณาต่ออายุเพื่อใช้งานฟังก์ชันนี้');
      }
    }

    return true; // ถ้าทุกอย่างปกติ (Active) ให้ผ่านได้ 100%
  }
}