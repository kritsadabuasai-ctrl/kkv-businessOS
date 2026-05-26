import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class GeographyService {
  constructor(private prisma: PrismaService) {}

  // 1. ดึงรายชื่อจังหวัดทั้งหมด (เรียงตามตัวอักษร ก-ฮ)
  async getProvinces() {
    return this.prisma.cfgGeography.findMany({
      where: {
        type: 'PROVINCE',
      },
      orderBy: {
        nameTh: 'asc', // เรียงลำดับชื่อภาษาไทย
      },
      select: {
        id: true,
        code: true,
        nameTh: true,
        nameEn: true,
      },
    });
  }

  // 2. ดึงข้อมูลลูก (อำเภอ หรือ ตำบล) โดยส่ง ID ของพ่อมา
  // - ถ้าส่ง ID จังหวัดมา -> จะได้รายชื่ออำเภอ
  // - ถ้าส่ง ID อำเภอมา -> จะได้รายชื่อตำบล พร้อมรหัสไปรษณีย์
  async getChildrenByParentId(parentId: number) {
    return this.prisma.cfgGeography.findMany({
      where: {
        parentId: parentId,
      },
      orderBy: {
        nameTh: 'asc',
      },
      select: {
        id: true,
        type: true, // ส่ง type กลับไปด้วยเผื่อหน้าบ้านใช้เช็ค
        code: true, // ถ้าเป็นตำบล ค่านี้คือ 'รหัสไปรษณีย์'
        nameTh: true,
        nameEn: true,
        parentId: true,
      },
    });
  }
}