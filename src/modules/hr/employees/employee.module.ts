import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RunningNumbersModule } from '../../cfg/running-numbers/running-numbers.module';

@Module({
  imports: [
    PrismaModule, 
    RunningNumbersModule
  ],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule {}