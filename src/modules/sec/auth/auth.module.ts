import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module'; // ⚠️ ตัวนี้ต้องแก้ด้วยนะ (ดูข้อ 3)
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ ปรับ Path ให้ตรงกับโครงสร้างจริง
import { MailModule } from '../../int/mail/mail.module';

@Module({
  imports: [
    PrismaModule, 
    UsersModule, // 👈 ถ้าไฟล์นี้ยังมี TypeOrmModule.forFeature จะพังทันที
    PassportModule,
    MailModule,
    ConfigModule, 
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '1d') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}