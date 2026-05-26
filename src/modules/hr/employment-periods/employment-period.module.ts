import { Module } from '@nestjs/common';
import { EmploymentPeriodController } from './employment-period.controller';
import { EmploymentPeriodService } from './employment-period.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ Import ส่วนกลาง

@Module({
  imports: [PrismaModule], // ✅ ใส่ตรงนี้
  controllers: [EmploymentPeriodController],
  providers: [EmploymentPeriodService],
  exports: [EmploymentPeriodService], 
})
export class EmploymentPeriodModule {}