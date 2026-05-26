import { Module, forwardRef } from '@nestjs/common';
import { PositionSeatController } from './position-seat.controller';
import { PositionSeatService } from './position-seat.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ManpowerRequestModule } from '../manpower-requests/manpower-request.module';

@Module({
  imports: [
    PrismaModule,
    // 🛡️ ป้องกันงูกินหางกรณีมีการอ้างอิงกลับไปยังใบคำร้องต้นทาง
    forwardRef(() => ManpowerRequestModule),
  ],
  controllers: [PositionSeatController],
  providers: [PositionSeatService],
  exports: [PositionSeatService],
})
export class PositionSeatModule {}