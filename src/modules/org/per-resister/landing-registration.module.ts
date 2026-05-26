import { Module } from '@nestjs/common';
import { LandingRegistrationController } from './landing-registration.controller';
import { LandingRegistrationService } from './landing-registration.service';
import { MailModule } from '../../int/mail/mail.module'; // ตรวจสอบ Path ของ MailModule อีกครั้งครับ

@Module({
  imports: [MailModule], // ต้อง Import MailModule เข้ามาด้วยเพื่อให้ Service เรียกใช้ได้
  controllers: [LandingRegistrationController],
  providers: [LandingRegistrationService],
})
export class LandingRegistrationModule {}