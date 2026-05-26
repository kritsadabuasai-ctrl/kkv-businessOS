import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator'; // ตรวจสอบ path ของ decorator นี้

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // ✅ ตรวจสอบว่าเมธอดนั้นมี @Public() หรือไม่
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // ถ้าเป็น Public ให้ผ่านไปได้เลยโดยไม่ต้องเช็ค Token
    if (isPublic) {
      return true;
    }

    // ถ้าไม่เป็น Public ให้ใช้ Logic มาตรฐานของ AuthGuard('jwt')
    return super.canActivate(context);
  }
}