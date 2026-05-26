import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls'; // ✅ เพิ่มการ Import ClsService

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private readonly cls: ClsService, // ✅ Inject ClsService เข้ามาใน Constructor
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'FALLBACK_SECRET_KEY',
    });
  }

async validate(payload: any) {
    if (!payload) {
      throw new UnauthorizedException();
    }

    // ข้อมูลที่จะส่งคืนให้ NestJS User Object
    const user = { 
      userId: payload.sub, 
      username: payload.username,
      companyId: payload.companyId,
      isSuperAdmin: payload.isSuperAdmin || false,
      
      // 🌟 [แก้ไขตรงนี้] ถ้าใน Token ไม่มี roleId ส่งมา แต่เป็น SuperAdmin ให้แปลงเป็น 1 อัตโนมัติ!
      roleId: payload.roleId || (payload.isSuperAdmin ? 1 : 0)
    };

    // 🔥 บรรทัดสำคัญ: ฝากข้อมูลลงในกระเป๋าเป้ (CLS)
    this.cls.set('user', user);

    return user;
  }
}