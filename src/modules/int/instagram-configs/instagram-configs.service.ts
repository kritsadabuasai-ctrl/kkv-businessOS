import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInstagramConfigDto, UpdateInstagramConfigDto } from './instagram-configs.dto';

@Injectable()
export class InstagramConfigsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Helper: ตรวจสอบว่าบอทที่เลือก เป็นของบริษัทเราจริงไหม
  private async validateBotOwnership(companyId: number, aiBotId?: number) {
    if (!aiBotId) return;

    const bot = await this.prisma.intAiBot.findFirst({
      where: { id: aiBotId, companyId },
    });

    if (!bot) {
      throw new BadRequestException('AI Bot ที่เลือกไม่ถูกต้อง หรือไม่ใช่ของบริษัทนี้');
    }
  }

  // ==========================================
  // ➕ 1. เพิ่มบัญชี IG (Upsert)
  // ==========================================
  async create(companyId: number, dto: CreateInstagramConfigDto) {
    try {
      const cleanDto: any = { ...dto };
      if (cleanDto.aiBotId && (Number(cleanDto.aiBotId) === 0 || cleanDto.aiBotId === '')) {
        delete cleanDto.aiBotId;
      }

      if (cleanDto.aiBotId) {
        await this.validateBotOwnership(companyId, Number(cleanDto.aiBotId));
      }

      // 🔍 เช็คว่า IG นี้ (igAccountId) เคยถูกเพิ่มในระบบของบริษัทนี้หรือยัง
      const existingConfig = await this.prisma.intInstagramConfig.findFirst({
        where: { companyId, igAccountId: cleanDto.igAccountId }
      });

      if (existingConfig) {
        // 🔄 มีแล้ว -> Update Token และการตั้งค่า
        return await this.prisma.intInstagramConfig.update({
          where: { id: existingConfig.id },
          data: { ...cleanDto, companyId },
        });
      } else {
        // 🆕 ยังไม่มี -> Create ใหม่
        return await this.prisma.intInstagramConfig.create({
          data: { ...cleanDto, companyId },
        });
      }
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException('ไม่พบ AI Bot ID ที่ระบุ กรุณาตรวจสอบว่า Bot ID ถูกต้อง');
      }
      throw error;
    }
  }

  // ==========================================
  // 📋 2. ดูบัญชี IG ทั้งหมดของบริษัท
  // ==========================================
  async findAll(companyId: number) {
    return this.prisma.intInstagramConfig.findMany({
      where: { companyId },
      include: {
        aiBot: { select: { name: true, modelName: true } } 
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // 🔍 3. ดูรายละเอียดรายบัญชี
  // ==========================================
  async findOne(id: number, companyId: number) {
    const config = await this.prisma.intInstagramConfig.findFirst({
      where: { id, companyId },
      include: { aiBot: true }
    });
    if (!config) throw new NotFoundException('ไม่พบข้อมูลการตั้งค่า Instagram');
    return config;
  }

  // ==========================================
  // 📝 4. แก้ไขการตั้งค่า
  // ==========================================
  async update(id: number, companyId: number, dto: UpdateInstagramConfigDto) {
    await this.findOne(id, companyId); // เช็คสิทธิ์ว่ามีบัญชีนี้จริงไหม

    const cleanDto: any = { ...dto };
    if (cleanDto.aiBotId !== undefined && (Number(cleanDto.aiBotId) === 0 || cleanDto.aiBotId === '')) {
       cleanDto.aiBotId = null; // ส่ง null เพื่อปลดบอทออก
    }

    if (cleanDto.aiBotId) {
      await this.validateBotOwnership(companyId, Number(cleanDto.aiBotId));
    }

    try {
      return await this.prisma.intInstagramConfig.update({
        where: { id },
        data: cleanDto,
      });
    } catch (error: any) {
       if (error.code === 'P2003') {
        throw new BadRequestException('AI Bot ID ไม่ถูกต้อง');
      }
      throw error;
    }
  }

  // ==========================================
  // 🗑️ 5. ลบการเชื่อมต่อ IG
  // ==========================================
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return this.prisma.intInstagramConfig.delete({ where: { id } });
  }
}