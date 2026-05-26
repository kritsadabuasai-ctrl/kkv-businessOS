import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMessageQueueDto } from './message-queue.dto';

@Injectable()
export class MessageQueueService {
  constructor(private prisma: PrismaService) {}

  // 1. นำข้อความเข้าคิว (Enqueue)
  async enqueue(companyId: number, dto: CreateMessageQueueDto) {
    return this.prisma.intMessageQueue.create({
      data: {
        ...dto,
        companyId,
        scheduledTime: new Date(dto.scheduledTime),
        status: 'PENDING',
      },
    });
  }

  // 2. ดึงรายการคิวมาดู (สำหรับ Admin)
  async findAll(companyId: number) {
    return this.prisma.intMessageQueue.findMany({
      where: { companyId },
      orderBy: { scheduledTime: 'asc' },
    });
  }
}