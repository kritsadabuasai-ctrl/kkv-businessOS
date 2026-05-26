import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; 

@Injectable()
export class BankService {
  constructor(private prisma: PrismaService) {}

  // ดึงรายชื่อธนาคารทั้งหมดที่เปิดใช้งาน เรียงตามลำดับความสำคัญ (sortOrder)
  async getActiveBanks() {
    return this.prisma.cfgBank.findMany({
      where: { 
        isActive: true // เอาเฉพาะธนาคารที่ตั้งค่าว่าเปิดใช้งาน
      },
      orderBy: { 
        sortOrder: 'asc' // เรียงจากน้อยไปมาก (Big 4 ขึ้นก่อน ตามที่เราทำ Seed ไว้)
      },
      select: {
        id: true,
        code: true,
        officialCode: true,
        nameTh: true,
        nameEn: true,
        color: true,    // ส่ง Code สีไปให้หน้าบ้านทำ UI
        logoUrl: true,  // ส่ง URL รูปภาพไปให้
      },
    });
  }

  // เผื่ออนาคต: ดึงข้อมูลธนาคารเดียวด้วยรหัส (เช่น KBANK)
  async getBankByCode(code: string) {
    return this.prisma.cfgBank.findUnique({
      where: { code: code.toUpperCase() }
    });
  }
}