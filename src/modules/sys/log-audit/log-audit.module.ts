import { Module, Global } from '@nestjs/common';
import { LogAuditController } from './log-audit.controller';
import { LogAuditService } from './log-audit.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ นำเข้า PrismaModule

@Global() // ✅ ทำให้ Module อื่นๆ เรียกใช้ LogAuditService ได้โดยไม่ต้อง Import ซ้ำ
@Module({
  imports: [PrismaModule], // ✅ สำคัญสำหรับการใช้งาน PrismaService
  controllers: [LogAuditController],
  providers: [LogAuditService],
  exports: [LogAuditService], 
})
export class LogAuditModule {}