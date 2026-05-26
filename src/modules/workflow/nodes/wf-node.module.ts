import { Module } from '@nestjs/common';
import { WfNodeController } from './wf-node.controller';
import { WfNodeService } from './wf-node.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ นำเข้า PrismaModule

@Module({
  imports: [PrismaModule], // ✅ เชื่อมต่อ Prisma
  controllers: [WfNodeController],
  providers: [WfNodeService],
  exports: [WfNodeService], // อาจต้องใช้ตอน Process Workflow เพื่อหา Node ถัดไป
})
export class WfNodeModule {}