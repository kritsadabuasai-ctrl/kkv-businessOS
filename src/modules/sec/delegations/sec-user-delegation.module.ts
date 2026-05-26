import { Module } from '@nestjs/common';
import { SecUserDelegationController } from './sec-user-delegation.controller';
import { SecUserDelegationService } from './sec-user-delegation.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // ✅ สำคัญมาก
  controllers: [SecUserDelegationController],
  providers: [SecUserDelegationService],
  exports: [SecUserDelegationService], 
})
export class SecUserDelegationModule {}