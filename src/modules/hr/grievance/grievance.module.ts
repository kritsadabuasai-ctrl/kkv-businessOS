import { Module } from '@nestjs/common';
import { GrievanceController } from './grievance.controller';
import { GrievanceService } from './grievance.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GrievanceController],
  providers: [GrievanceService],
})
export class GrievanceModule {}