import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMessageLogDto } from './dto/create-message-log.dto';

@Injectable()
export class MessageLogService {
  constructor(private prisma: PrismaService) {}

  private serializeLog(log: any) {
    return { 
      ...log, 
      id: log.id.toString() 
    };
  }

  // 1. บันทึก Log การสื่อสาร
  async log(dto: CreateMessageLogDto) {
    // 🛡️ FIX Error TS2322: 
    // แปลงค่า companyId ให้เป็น number แน่นอน (ถ้าไม่มีให้เป็น 0)
    // เพื่อให้ TypeScript เลิกบ่นว่า type เข้ากันไม่ได้
    const safeCompanyId = dto.companyId ?? 0;

    const newLog = await this.prisma.comMessageLog.create({
      data: {
        companyId: safeCompanyId, // ✅ ใช้ตัวแปร safeCompanyId แทน
        channel: dto.channel,
        recipient: dto.recipient,
        subject: dto.subject,
        content: dto.content,
        status: dto.status,
        errorMessage: dto.errorMessage,
        refType: dto.refType,
        refId: dto.refId,
      },
    });

    return this.serializeLog(newLog);
  }

  // 2. ดูประวัติทั้งหมด
  async findAll(companyId: number) {
    const logs = await this.prisma.comMessageLog.findMany({
      where: { companyId },
      take: 50,
      orderBy: { sentAt: 'desc' },
      include: {
        company: { select: { code: true, name: true } },
      },
    });

    return logs.map((log) => this.serializeLog(log));
  }

  // 3. ค้นหาตามผู้รับ
  async findByRecipient(companyId: number, recipient: string) {
    const logs = await this.prisma.comMessageLog.findMany({
      where: { 
        companyId, 
        recipient: { contains: recipient } 
      },
      orderBy: { sentAt: 'desc' },
    });

    return logs.map((log) => this.serializeLog(log));
  }
}