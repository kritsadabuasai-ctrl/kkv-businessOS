import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { PrismaModule } from '../../../prisma/prisma.module'; 
import { MailModule } from '../../int/mail/mail.module'; // 🌟 1. Import มา

@Module({
  imports: [PrismaModule, MailModule], // 🌟 2. เอาใส่ใน imports
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}