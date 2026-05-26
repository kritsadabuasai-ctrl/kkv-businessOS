import { Module, Global } from '@nestjs/common';
import { MessageLogController } from './message-log.controller';
import { MessageLogService } from './message-log.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ นำเข้า PrismaModule

@Global()
@Module({
  imports: [PrismaModule], // ✅ สำคัญสำหรับการใช้ PrismaService 
  controllers: [MessageLogController],
  providers: [MessageLogService],
  exports: [MessageLogService],
})
export class MessageLogModule {}