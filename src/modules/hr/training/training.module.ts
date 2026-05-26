import { Module } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { PrismaModule } from '../../../prisma/prisma.module'; 

@Module({
  imports: [PrismaModule],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}