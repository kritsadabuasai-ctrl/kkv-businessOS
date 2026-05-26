import { Module, forwardRef } from '@nestjs/common';
import { ManpowerRequestController } from './manpower-request.controller';
import { ManpowerRequestService } from './manpower-request.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { WfRequestModule } from '../../workflow/requests/wf-request.module';
import { PositionSeatModule } from '../../hr/position-seat/position-seat.module';

@Module({
  imports: [
    PrismaModule,
    // 🛡️ ป้องกัน Circular Dependency
    forwardRef(() => WfRequestModule),
    forwardRef(() => PositionSeatModule),
  ],
  controllers: [ManpowerRequestController],
  providers: [ManpowerRequestService],
  exports: [ManpowerRequestService],
})
export class ManpowerRequestModule {}