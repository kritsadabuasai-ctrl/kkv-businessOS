import { Module } from '@nestjs/common';
import { HrShiftService } from './hr-shift.service';
import { HrShiftController } from './hr-shift.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HrShiftController],
  providers: [HrShiftService],
  exports: [HrShiftService]
})
export class HrShiftModule {}