import { Module } from '@nestjs/common';
import { AuthConfigsService } from './auth-configs.service';
import { AuthConfigsController } from './auth-configs.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthConfigsController],
  providers: [AuthConfigsService],
  exports: [AuthConfigsService], // Export เผื่อ AuthService ต้องเรียกใช้
})
export class AuthConfigsModule {}