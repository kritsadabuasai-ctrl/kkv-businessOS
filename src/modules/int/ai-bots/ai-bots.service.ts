import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAiBotDto, UpdateAiBotDto, UpdateQuotaDto } from './ai-bots.dto';

@Injectable()
export class AiBotsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 🛡️ Helper: แปลง BigInt เป็น String (แก้ Error JSON Serialize)
   */
  private serializeQuota(quota: any) {
    if (!quota) return null;
    return {
      ...quota,
      monthlyLimit: quota.monthlyLimit?.toString(),
      usedThisMonth: quota.usedThisMonth?.toString(),
      maxStorageBytes: quota.maxStorageBytes?.toString(),
      usedStorageBytes: quota.usedStorageBytes?.toString(),
      extraCredit: quota.extraCredit?.toString(),
    };
  }

  /**
   * 1. สร้าง AI Bot ใหม่
   */
  async create(companyId: number, dto: CreateAiBotDto) {
    // เช็ค Code ซ้ำ
    if (dto.code) {
      const existing = await this.prisma.intAiBot.findFirst({
        where: { companyId, code: dto.code }
      });
      if (existing) throw new BadRequestException('Bot Code already exists');
    }

    return this.prisma.intAiBot.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        provider: dto.provider || 'GEMINI', // Default
        modelName: dto.modelName || 'gemini-1.5-flash',
        temperature: dto.temperature || 0.7,
        systemPrompt: dto.systemPrompt || 'คุณคือผู้ช่วย AI',
        greetingMessage: dto.greetingMessage,
        canUseTools: dto.canUseTools || false,
        isActive: dto.isActive ?? true,
      }
    });
  }

/**
   * 2. ดึงรายชื่อ Bot ทั้งหมด พร้อมเช็คสถานะ HQ
   */
  async findAll(companyId: number, userId: number) {
    // 🌟 1. ให้ Service เช็คว่า User คนนี้เป็นแอดมิน HQ หรือไม่
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId },
      include: { company: true }
    });
    const isUserHQ = userRoles.some(ur => ur.company?.licenseHolderId === null);

    // 🌟 2. ดึง Bot ส่วนกลาง (companyId: null) และ Bot ของบริษัทตัวเองมาพร้อมกัน
    const bots = await this.prisma.intAiBot.findMany({
      where: {
        OR: [{ companyId: companyId }, { companyId: null }]
      },
      orderBy: [{ companyId: 'asc' }, { createdAt: 'desc' }]
    });

    // 🌟 3. ถ้ารหัสซ้ำกัน (Override) ให้ยึดของบริษัทตัวเอง (ทับของส่วนกลาง)
    const botMap = new Map();
    for (const bot of bots) {
      botMap.set(bot.code, bot); // ตัวที่มี companyId ไม่เป็น null จะเข้า Map ทีหลังและทับตัวเก่า
    }

    const finalBots = Array.from(botMap.values());

    // 🌟 4. ส่งข้อมูลกลับเป็น Object เพื่อให้หน้าบ้านรู้สิทธิ์การแก้ไข
    return {
      isUserHQ: isUserHQ,
      bots: finalBots
    };
  }

  /**
   * 3. ดึง Bot รายตัว
   */
 async findOne(id: number, companyId: number) {
    // ดึงได้ทั้งของตัวเอง และของส่วนกลาง
    const bot = await this.prisma.intAiBot.findFirst({
      where: { 
        id, 
        OR: [{ companyId: companyId }, { companyId: null }]
      }
    });
    if (!bot) throw new NotFoundException('AI Bot not found');
    return bot;
  }


  /**
   * 4. แก้ไข Bot
   */
async update(id: number, companyId: number, dto: UpdateAiBotDto, userId: number) {
    // 1. ให้ Service เช็คเองเลยว่า User คนนี้เป็นแอดมิน HQ หรือไม่
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId },
      include: { company: true }
    });
    const isUserHQ = userRoles.some(ur => ur.company?.licenseHolderId === null);

    // 2. หาข้อมูลบอทปัจจุบันที่ต้องการแก้
    const currentBot = await this.prisma.intAiBot.findUnique({
      where: { id, companyId }
    });
    
    if (!currentBot) throw new NotFoundException('ไม่พบข้อมูล AI Bot หรือไม่มีสิทธิ์แก้ไข');

    // 🌟 3. คัดกรองข้อมูลที่อนุญาตให้อัปเดต (Data Sanitization)
    let updateData: any = { ...dto }; // เริ่มต้นด้วยข้อมูลที่ส่งมาทั้งหมด

    if (!isUserHQ) {
      // 🛑 3.1 ป้องกันบริษัททั่วไป แอบส่งสถานะ isSystem มาเปลี่ยนของตัวเอง
      delete updateData.isSystem;

      // 🛑 3.2 ถ้าบอทตัวนี้เป็น System Bot (บอทส่วนกลาง) ให้จำกัดสิทธิ์ขั้นสุด
      if (currentBot.isSystem) {
        updateData = {}; // ล้างข้อมูลที่หน้าบ้านส่งมาทิ้งทั้งหมด!

        // ✅ อนุญาตให้หยิบมาเฉพาะข้อมูลที่เกี่ยวกับ "บุคลิกบอท" เท่านั้น (Whitelist)
        if (dto.systemPrompt !== undefined) updateData.systemPrompt = dto.systemPrompt;
        if (dto.greetingMessage !== undefined) updateData.greetingMessage = dto.greetingMessage;
        if (dto.temperature !== undefined) updateData.temperature = dto.temperature;

        // 🌟 ปลดล็อกให้เปลี่ยนค่าย AI และรุ่นโมเดลได้แล้วครับ!
        if (dto.provider !== undefined) updateData.provider = dto.provider;
        if (dto.modelName !== undefined) updateData.modelName = dto.modelName;
        
        // 🌟 ปลดล็อก 2 ฟิลด์ใหม่: อนุญาตให้เช็คสต็อก (canUseTools) และ เปิดใช้งานบอท (isActive)
        if (dto.canUseTools !== undefined) updateData.canUseTools = dto.canUseTools;
        if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
       
        // (Optional) ถ้าอนุญาตให้เปลี่ยนรุ่นโมเดล (Gemini) ได้ด้วย ก็ปลดคอมเมนต์บรรทัดล่างครับ
        // if (dto.modelName !== undefined) updateData.modelName = dto.modelName;

        // ถ้าหน้าบ้านพยายามแก้ชื่อ (Name) หรือ Code แต่ไม่ได้ส่งข้อมูลบุคลิกมาเลย
        if (Object.keys(updateData).length === 0) {
           throw new BadRequestException('ไม่อนุญาตให้แก้ไขข้อมูลทั่วไปของบอทระบบ (แก้ได้เฉพาะบุคลิกบอทเท่านั้น)');
        }
      }
    }

    // 4. ทำการอัปเดตข้อมูลลงฐานข้อมูล
    return this.prisma.intAiBot.update({
      where: { id },
      data: updateData
    });
  }

 /**
   * 5. ลบ Bot
   */
  async remove(id: number, companyId: number, userId: number) { // 🌟 รับ userId เพิ่มเข้ามา
    // 1. ค้นหาข้อมูลบอทตัวนี้
    const bot = await this.findOne(id, companyId);

    // 2. เช็คว่าคนที่กดลบ คือแอดมินบริษัทแม่ (HQ) หรือไม่
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId },
      include: { company: true }
    });
    const isUserHQ = userRoles.some(ur => ur.company?.licenseHolderId === null);

    // 🌟 3. ลอจิกป้องกันการลบ: ถ้าไม่ใช่ HQ (เป็นสาขา) และบอทนี้เป็นของระบบ (isSystem)
    if (!isUserHQ && bot.isSystem) {
      throw new BadRequestException('บริษัทสาขาไม่อนุญาตให้ลบบอทของระบบได้ (แนะนำให้ใช้วิธีปิดการใช้งานแทน)');
    }

    // 4. ถ้าเป็น HQ ลบได้ทุกอย่าง / หรือถ้าเป็นสาขา ลบได้เฉพาะบอทที่สร้างเอง (isSystem = false)
    return this.prisma.intAiBot.delete({ where: { id } });
  }

  /**
   * 6. ดึงข้อมูล Quota (สำหรับ Dashboard)
   */
  async getQuota(companyId: number) {
    let quota = await this.prisma.intAiQuota.findUnique({
      where: { companyId }
    });

    // ถ้ายังไม่มี ให้สร้าง Default ให้
    if (!quota) {
      quota = await this.prisma.intAiQuota.create({
        data: {
          companyId,
          monthlyLimit: BigInt(100000), // Default 100k Token
          maxStorageBytes: BigInt(524288000), // Default 500MB
        }
      });
    }

    return this.serializeQuota(quota);
  }

  /**
   * 7. อัปเดต Quota (Manual Adjustment)
   */
  async updateQuota(companyId: number, dto: UpdateQuotaDto) {
    const data: any = {};
    if (dto.monthlyLimit) data.monthlyLimit = BigInt(dto.monthlyLimit);
    if (dto.maxStorageBytes) data.maxStorageBytes = BigInt(dto.maxStorageBytes);
    if (dto.extraCredit) data.extraCredit = BigInt(dto.extraCredit);

    const quota = await this.prisma.intAiQuota.update({
      where: { companyId },
      data
    });

    return this.serializeQuota(quota);
  }

  /**
   * 8. ดึงรายชื่อโมเดล AI ทั้งหมดที่เปิดใช้งาน (สำหรับแสดงใน Dropdown)
   */
  async getAvailableModels() {
    return this.prisma.sysAiModelConfig.findMany({
      where: { 
        // 🌟 ดึงรุ่น AI ส่วนกลางที่เปิดให้ใช้งาน
        isActive: true,
        companyId: null
      },
      select: {
        provider: true,
        modelCode: true,
        modelName: true,
      },
      orderBy: [
        { provider: 'asc' },
        { modelCode: 'desc' }
      ]
    });
  }

  // =========================================================
  // 🔄 รีเซ็ตบุคลิกบอทกลับเป็นค่าเริ่มต้นจากส่วนกลาง (HQ)
  // =========================================================
  async resetToSystemDefault(botId: number, companyId: number) {
    // 1. หาบอทตัวปัจจุบันของลูกค้า
    const currentBot = await this.prisma.intAiBot.findUnique({
      where: { id: botId, companyId }
    });

    if (!currentBot || !currentBot.isSystem || !currentBot.code) {
      throw new BadRequestException('บอทตัวนี้ไม่ใช่บอทระบบ หรือไม่มีรหัสอ้างอิง ไม่สามารถคืนค่าได้');
    }

    // 2. ไปหา "ต้นฉบับ" จาก HQ (บริษัทที่ไม่มี licenseHolderId)
    const systemDefault = await this.prisma.intAiBot.findFirst({
      where: { 
        code: currentBot.code,
        company: { licenseHolderId: null }
      }
    });

    if (!systemDefault) {
      throw new NotFoundException('ไม่พบข้อมูลบอทต้นฉบับจากส่วนกลาง');
    }

    // 3. ก๊อปปี้เอาแค่ System Prompt, Greeting Message และ Temperature กลับมาทับ
    return this.prisma.intAiBot.update({
      where: { id: botId },
      data: {
        systemPrompt: systemDefault.systemPrompt,
        greetingMessage: systemDefault.greetingMessage,
        temperature: systemDefault.temperature,
        provider: systemDefault.provider,  
        modelName: systemDefault.modelName, 
        canUseTools: systemDefault.canUseTools
      }
    });
  }

}