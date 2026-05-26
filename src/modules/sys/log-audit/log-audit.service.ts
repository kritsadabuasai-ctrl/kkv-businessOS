import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLogAuditDto } from './dto/create-log-audit.dto';

@Injectable()
export class LogAuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper สำหรับจัดการข้อมูล BigInt
   * เนื่องจาก JSON.stringify ไม่รองรับ BigInt เราจึงต้องแปลง id เป็น String ก่อนส่งออกไป
   */
  private serializeLog(log: any) {
    if (!log) return null;
    return {
      ...log,
      id: log.id.toString(),
    };
  }

  // 1. บันทึก Audit Log
  async log(dto: CreateLogAuditDto) {
    // 🛡️ แก้ปัญหา Type Error 2322:
    // สาเหตุ: DTO ประกาศเป็น Optional (?) แต่ DB ต้องการ Int
    // วิธีแก้: ใช้ ?? 0 เพื่อกำหนดค่า Default กันตาย (TypeScript จะมองว่าเป็น number แน่นอน)
    const safeCompanyId = dto.companyId ?? 0;

    const newLog = await this.prisma.logAudit.create({
      data: {
        companyId: safeCompanyId, // ✅ ส่งค่าที่รับประกันว่าเป็น Int แน่นอน
        action: dto.action,
        tableName: dto.tableName,
        recordId: dto.recordId,
        userId: dto.userId,
        oldValues: dto.oldValues ?? undefined, // แปลง null เป็น undefined ให้ Prisma
        newValues: dto.newValues ?? undefined,
        ipAddress: dto.ipAddress || null, // 🌟 รองรับค่าว่าง
        userAgent: dto.userAgent || null, // 🌟 รองรับค่าว่าง
      },
    });

    return this.serializeLog(newLog);
  }

 // 2. ดูประวัติทั้งหมด (ต้องระบุ Company) พร้อม Pagination
  async findAll(companyId: number, page: number = 1, limit: number = 20) {
    // ค้นหาข้อมูลตามหน้า
    const skip = (page - 1) * limit;

    // รัน Query 2 ตัวพร้อมกัน (หาจำนวนทั้งหมด และหาข้อมูลในหน้านั้น)
    const [total, logs] = await Promise.all([
      this.prisma.logAudit.count({
        where: { companyId },
      }),
      this.prisma.logAudit.findMany({
        where: { companyId },
        skip: skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              fullName: true,
              username: true,
            },
          },
        },
      }),
    ]);

    // คำนวณจำนวนหน้าทั้งหมด
    const lastPage = Math.ceil(total / limit);

    return {
      data: logs.map((log) => this.serializeLog(log)),
      meta: {
        total,
        page,
        limit,
        lastPage,
      },
    };
  }

  // 3. ดูประวัติของ Record เจาะจง (เช่น ใครมาแก้ Order นี้บ้าง)
  async findByRecord(companyId: number, tableName: string, recordId: string) {
    const logs = await this.prisma.logAudit.findMany({
      where: {
        companyId, // ✅ กรอง
        tableName: tableName,
        recordId: recordId
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fullName: true,
          },
        },
      },
    });

    return logs.map((log) => this.serializeLog(log));
  }

  // 4. ดูประวัติการกระทำของ User คนหนึ่งๆ
  async findByUser(companyId: number, userId: number) {
    const logs = await this.prisma.logAudit.findMany({
      where: {
        companyId, // ✅ กรอง
        userId: userId
      },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map((log) => this.serializeLog(log));
  }
}