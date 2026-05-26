import { Injectable, NotFoundException } from '@nestjs/common';
// 1. ดึง Type มาจาก Library โดยตรง (ถูกแล้ว)
import { ComTag } from '@prisma/client'; 

// 2. ✅ ดึง Service ตัวกลางมาใช้ (แก้ไขตรงนี้)
import { PrismaService } from '../../../prisma/prisma.service'; 

import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  // 3. ✅ Inject PrismaService แทน PrismaClient
  constructor(private prisma: PrismaService) {} 

  // 1. สร้าง Tag
 // =========================================================
  // 1. สร้าง Tag
  // =========================================================
  async create(companyId: number, dto: CreateTagDto) {
    const existing = await this.prisma.comTag.findUnique({
      where: { 
        // 🌟 เช็คชื่อซ้ำเฉพาะในบริษัทตัวเอง
        companyId_name: {
          companyId: companyId,
          name: dto.name
        }
      },
    });
    
    if (existing) {
      return existing;
    }

    return this.prisma.comTag.create({
      data: { 
        companyId: companyId, // 🏢 บันทึกว่าเป็นของบริษัทไหน
        name: dto.name 
      },
    });
  }

 findAll(companyId: number, search?: string) {
    return this.prisma.comTag.findMany({
      where: {
        companyId: companyId, // 🏢 ล็อกให้เห็นเฉพาะของบริษัทตัวเอง
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {})
      },
      orderBy: { name: 'asc' },
      take: 50,
    });
  }

  async findOne(companyId: number, id: number) {
    // 🌟 เปลี่ยนจาก findUnique เป็น findFirst เพื่อให้เช็ค companyId ได้
    const tag = await this.prisma.comTag.findFirst({
      where: { id: id, companyId: companyId },
      include: {
        _count: { select: { images: true } }
      }
    });
    
    if (!tag) throw new NotFoundException(`ไม่พบข้อมูล Tag หรือคุณไม่มีสิทธิ์เข้าถึง`);
    return tag;
  }

  // ✅ ฟังก์ชันสำหรับ AI
 async findOrCreateTags(companyId: number, tagNames: string[]) {
    if (!tagNames || tagNames.length === 0) return [];

    const uniqueNames = [...new Set(tagNames.map(n => n.trim()).filter(n => n))];
    const results: ComTag[] = []; 

    for (const name of uniqueNames) {
      // ค้นหาแบบระบุบริษัท (companyId_name)
      let tag = await this.prisma.comTag.findUnique({
        where: { 
          companyId_name: { companyId, name } 
        }
      });

      if (!tag) {
        // สร้างใหม่โดยระบุบริษัท
        tag = await this.prisma.comTag.create({
          data: { companyId, name }
        });
      }
      results.push(tag);
    }
    return results;
  }

 async update(companyId: number, id: number, dto: UpdateTagDto) {
    const existing = await this.findOne(companyId, id); // เช็คสิทธิ์ก่อน

    return this.prisma.comTag.update({
      where: { id: existing.id },
      data: { name: dto.name }
    });
  }

  async remove(companyId: number, id: number) {
    const existing = await this.findOne(companyId, id); // เช็คสิทธิ์ก่อน

    return this.prisma.comTag.delete({
      where: { id: existing.id }
    });
  }
}