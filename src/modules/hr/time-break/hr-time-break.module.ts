import { Module } from '@nestjs/common';
import { HrTimeBreakService } from './hr-time-break.service';
import { HrTimeBreakController } from './hr-time-break.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HrTimeBreakController],
  providers: [HrTimeBreakService],
  exports: [HrTimeBreakService] // เผื่อให้ Module อื่นๆ เรียกใช้งาน Service นี้ได้
})
export class HrTimeBreakModule {}