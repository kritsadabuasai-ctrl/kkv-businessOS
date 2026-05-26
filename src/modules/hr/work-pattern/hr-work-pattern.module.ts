import { Module } from '@nestjs/common';
import { HrWorkPatternService } from './hr-work-pattern.service';
import { HrWorkPatternController } from './hr-work-pattern.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HrWorkPatternController],
  providers: [HrWorkPatternService],
  exports: [HrWorkPatternService]
})
export class HrWorkPatternModule {}