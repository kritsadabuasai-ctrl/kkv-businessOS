import { Module } from '@nestjs/common';
import { WorkflowDefinitionController } from './workflow-definition.controller';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ นำเข้า PrismaModule

@Module({
  imports: [PrismaModule], // ✅ เชื่อมต่อ Prisma
  controllers: [WorkflowDefinitionController],
  providers: [WorkflowDefinitionService],
  exports: [WorkflowDefinitionService], // เผื่อเอาไปใช้ตอนสร้าง Request
})
export class WorkflowDefinitionModule {}