import { Module } from '@nestjs/common';
import { JobHistoryController } from './job-history.controller';
import { JobHistoryService } from './job-history.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ Import ส่วนกลาง

@Module({
  imports: [PrismaModule], // ✅ ใส่ตรงนี้
  controllers: [JobHistoryController],
  providers: [JobHistoryService],
  exports: [JobHistoryService], 
})
export class JobHistoryModule {}