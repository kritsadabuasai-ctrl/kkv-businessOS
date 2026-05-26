import { Module } from '@nestjs/common';
import { SlipVerificationsService } from './slip-verifications.service';
import { SlipVerificationsController } from './slip-verifications.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SlipVerificationsController],
  providers: [SlipVerificationsService],
  exports: [SlipVerificationsService], // Export ไว้ให้ ComOrderModule เรียกใช้ตอนเช็คเอาต์ได้ด้วย!
})
export class SlipVerificationsModule {}