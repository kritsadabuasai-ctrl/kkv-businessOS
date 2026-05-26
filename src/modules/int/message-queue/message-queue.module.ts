import { Module } from '@nestjs/common';
import { MessageQueueService } from './message-queue.service';
import { MessageQueueController } from './message-queue.controller';
import { MessageQueueWorker } from './message-queue.worker';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LineModule } from '../line/line.module'; // 👈 1. Import LineModule

@Module({
  imports: [PrismaModule, LineModule], // 👈 2. ใส่ LineModule ตรงนี้
  controllers: [MessageQueueController],
  providers: [MessageQueueService, MessageQueueWorker],
  exports: [MessageQueueService],
})
export class MessageQueueModule {}