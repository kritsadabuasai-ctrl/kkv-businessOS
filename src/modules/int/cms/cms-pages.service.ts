import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCmsPageDto, UpdateCmsPageDto } from './cms-pages.dto';

@Injectable()
export class CmsPagesService {
  constructor(private prisma: PrismaService) {}

  // ✅ สร้างหน้าใหม่
  async create(companyId: number, dto: CreateCmsPageDto) {
    try {
      return await this.prisma.cmsPage.create({
        data: { ...dto, companyId },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('URL Slug นี้ถูกใช้งานไปแล้วในบริษัทของคุณ');
      }
      throw error;
    }
  }

  // ✅ ดึงรายการหน้าทั้งหมดของบริษัท (หลังบ้าน)
  async findAll(companyId: number) {
    return this.prisma.cmsPage.findMany({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // 🌟 [NEW] ดึงข้อมูลหน้าเว็บแบบรายตัว (สำหรับหน้า Editor)
  async findOne(id: number, companyId: number) {
    const page = await this.prisma.cmsPage.findFirst({
      where: { id, companyId }
    });
    if (!page) throw new NotFoundException('ไม่พบข้อมูลหน้าเว็บที่ต้องการ');
    return page;
  }

  // ✅ ดึงหน้าเว็บแบบสาธารณะ (สำหรับหน้าบ้าน - เฉพาะหน้าที่ Publish แล้ว)
  async findPublishedPage(companyId: number, slug: string) {
    const page = await this.prisma.cmsPage.findFirst({
      where: { 
        companyId, 
        slug, 
        isPublished: true // 👈 ดึงเฉพาะหน้าที่กดเผยแพร่แล้วเท่านั้น
      },
    });
    
    if (!page) throw new NotFoundException('ไม่พบหน้าเว็บที่ระบุ หรือหน้านี้ยังไม่ถูกเผยแพร่');
    return page;
  }

  // ✅ แก้ไขข้อมูลหน้าเว็บ
  async update(id: number, companyId: number, dto: UpdateCmsPageDto) {
    const page = await this.prisma.cmsPage.findFirst({ where: { id, companyId } });
    if (!page) throw new NotFoundException('ไม่พบข้อมูลหน้าเว็บ');

    return this.prisma.cmsPage.update({
      where: { id },
      data: dto,
    });
  }

  // ✅ ลบหน้าเว็บ
  async remove(id: number, companyId: number) {
    const page = await this.prisma.cmsPage.findFirst({ where: { id, companyId } });
    if (!page) throw new NotFoundException('ไม่พบข้อมูลหน้าเว็บ');
    
    await this.prisma.cmsPage.delete({ where: { id } });
    return { success: true, message: 'ลบหน้าเว็บสำเร็จ' };
  }
}