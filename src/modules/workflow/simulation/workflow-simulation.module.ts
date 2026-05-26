import { Module } from '@nestjs/common';
import { WorkflowSimulationController } from './workflow-simulation.controller';
import { WorkflowSimulationService } from './workflow-simulation.service';
import { PrismaService } from '../../../prisma/prisma.service'; // ปรับ path ตามโปรเจกต์จริง

@Module({
  controllers: [WorkflowSimulationController],
  providers: [WorkflowSimulationService, PrismaService],
  exports: [WorkflowSimulationService]
})
export class WorkflowSimulationModule {}