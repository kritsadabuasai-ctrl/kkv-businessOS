import { Module } from '@nestjs/common';
import { HrHolidayService } from './hr-holiday.service';
import { HrHolidayController } from './hr-holiday.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HrHolidayController],
  providers: [HrHolidayService],
  exports: [HrHolidayService],
})
export class HrHolidayModule {}