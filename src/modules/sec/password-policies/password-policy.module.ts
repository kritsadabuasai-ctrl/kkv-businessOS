import { Module } from '@nestjs/common';
import { PasswordPolicyService } from './password-policy.service';
import { PasswordPolicyController } from './password-policy.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // ✅ เชื่อมต่อฐานข้อมูลเพื่ออ่านเขียน Policy
  controllers: [PasswordPolicyController],
  providers: [PasswordPolicyService],
  exports: [PasswordPolicyService], // ✅ Export เพื่อให้ AuthService เรียกไปตรวจสอบรหัสผ่านตอน Register/Login
})
export class PasswordPolicyModule {}