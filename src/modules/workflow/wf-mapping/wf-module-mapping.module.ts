import { Module } from '@nestjs/common';
import { WfModuleMappingService } from './wf-module-mapping.service';
import { WfModuleMappingController } from './wf-module-mapping.controller';
import { PrismaModule } from '../../../prisma/prisma.module';  // ปรับ path ให้ตรงกับโปรเจกต์คุณกฤษฎา

@Module({
  imports: [PrismaModule], // จำเป็นต้อง import PrismaModule เพื่อให้ Service เรียกใช้งานได้
  controllers: [WfModuleMappingController],
  providers: [WfModuleMappingService],
  exports: [WfModuleMappingService], // เผื่อโมดูลอื่น (เช่น EmployeeModule) ต้องการเอาไปใช้สับราง Workflow
})
export class WfModuleMappingModule {}