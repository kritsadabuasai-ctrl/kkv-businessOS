import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto } from './com-template.dto';

@Injectable()
export class ComTemplateService {
  constructor(private prisma: PrismaService) {}

  // 1. สร้าง Template ใหม่
  async create(companyId: number, dto: CreateTemplateDto) {
    // 🌟 เปลี่ยนมาใช้ findFirst เพื่อเช็คซ้ำเฉพาะในระดับบริษัทตัวเอง
    const exists = await this.prisma.comTemplate.findFirst({
      where: {
        companyId,
        code: dto.code,
        channel: dto.channel,
        locale: dto.locale || 'th',
      },
    });

    if (exists) throw new ConflictException(`Template ${dto.code} (${dto.channel}) already exists for your company`);

    return this.prisma.comTemplate.create({ 
      data: { 
        ...dto, 
        companyId 
      } 
    });
  }

  // 2. ดึง Template ทั้งหมด (รองรับ Master/Tenant Override)
  async findAll(companyId: number) {
    // 🌟 1. ดึงทั้งของส่วนกลาง (companyId: null) และของบริษัทตัวเองมาพร้อมกัน
    const templates = await this.prisma.comTemplate.findMany({
      where: { OR: [{ companyId: companyId }, { companyId: null }] },
      orderBy: [{ code: 'asc' }, { locale: 'asc' }],
    });

    const templateMap = new Map();
    
    // 🌟 2. เอาของส่วนกลางใส่ลงไปใน Map ก่อน
    for (const t of templates.filter(x => x.companyId === null)) {
      templateMap.set(`${t.code}_${t.channel}_${t.locale}`, t);
    }

    // 🌟 3. เอาของบริษัทตัวเองใส่ทับทีหลัง (ถ้ามีเทมเพลตซ้ำกัน มันจะเขียนทับของส่วนกลางอัตโนมัติ)
    for (const t of templates.filter(x => x.companyId !== null)) {
      templateMap.set(`${t.code}_${t.channel}_${t.locale}`, t);
    }

    return Array.from(templateMap.values());
  }

  // 2.1 ดึงตาม ID พร้อมเช็คบริษัท 
  async findOne(id: number, companyId: number) {
    const template = await this.prisma.comTemplate.findUnique({ 
      where: { id } 
    });
    
    // 🌟 ยอมให้ดึงข้อมูลได้ ถ้าเป็นของบริษัทตัวเอง หรือเป็นของส่วนกลาง (null)
    if (!template || (template.companyId !== null && template.companyId !== companyId)) {
      throw new NotFoundException('Template not found or access denied');
    }
    return template;
  }

  // 3. ฟังก์ชันสำหรับ System ดึงไปใช้งาน (ส่ง Email, LINE ฯลฯ)
  async getTemplate(companyId: number, code: string, channel: string, locale: string = 'th') {
    // 🌟 1. พยายามหาเทมเพลตที่บริษัทนี้สร้าง Override ไว้ก่อน
    let template = await this.prisma.comTemplate.findFirst({
      where: { companyId, code, channel, locale },
    });

    // 🌟 2. ถ้าไม่เคย Override ให้ดึงของส่วนกลาง (Master) ไปใช้
    if (!template) {
      template = await this.prisma.comTemplate.findFirst({
        where: { companyId: null, code, channel, locale },
      });
    }

    if (!template) throw new NotFoundException(`Template ${code} for ${channel} [${locale}] not found`);
    
    return template;
  }

  // 4. แก้ไข (Copy-on-Write Logic)
  // 4. แก้ไข (Copy-on-Write Logic & HQ Edit)
  async update(id: number, companyId: number, dto: UpdateTemplateDto, userId: number) {
    const template = await this.findOne(id, companyId); 

    // 🌟 เช็คว่าคนที่กำลังแก้ คือ แอดมินบริษัทแม่ (HQ) หรือไม่?
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId },
      include: { company: true }
    });
    const isUserHQ = userRoles.some(ur => ur.company?.licenseHolderId === null);

    // 🌟 ถ้านี่คือเทมเพลตส่วนกลาง (Master) 
    if (template.companyId === null) {
      if (isUserHQ) {
        // 👑 ถ้าเป็น HQ อนุญาตให้แก้ทับต้นฉบับได้เลย! (เพื่อให้มีผลกับทุกสาขาที่ไม่ได้ Override)
        return this.prisma.comTemplate.update({
          where: { id },
          data: dto,
        });
      } else {
        // 🏢 ถ้าเป็นสาขาทั่วไป ให้ปั๊มเป็นของบริษัทนี้แทน (Copy-on-Write)
        const { id: oldId, createdAt, updatedAt, companyId: oldCompanyId, ...templateData } = template as any;
        return this.prisma.comTemplate.create({
          data: {
            ...templateData,    
            ...dto,             
            companyId: companyId // ประทับตราเป็นของบริษัทตัวเอง
          }
        });
      }
    }

    // ถ้าเป็นของตัวเองอยู่แล้ว ก็ Update ทับไปเลย (บริษัทใครบริษัทมัน)
    if (template.companyId !== companyId) throw new BadRequestException('ไม่มีสิทธิ์แก้ไขเทมเพลตของบริษัทอื่น');

    return this.prisma.comTemplate.update({
      where: { id },
      data: dto,
    });
  }

  // 5. ลบ 
  async remove(id: number, companyId: number) {
    const template = await this.findOne(id, companyId); 
    
    // 🌟 ป้องกันไม่ให้แอดมินสาขา เผลอไปลบเทมเพลตของส่วนกลาง
    if (template.companyId === null) {
      throw new BadRequestException('ไม่สามารถลบเทมเพลตมาตรฐานของส่วนกลางได้');
    }

    return this.prisma.comTemplate.delete({ where: { id } });
  }
}