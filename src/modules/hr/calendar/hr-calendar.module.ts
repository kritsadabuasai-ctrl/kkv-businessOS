import { Module } from '@nestjs/common';
import { HrCalendarService } from './hr-calendar.service';
import { HrCalendarController } from './hr-calendar.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HrCalendarController],
  providers: [HrCalendarService],
  exports: [HrCalendarService],
})
export class HrCalendarModule {}