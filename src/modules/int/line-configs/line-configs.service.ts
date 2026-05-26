import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLineConfigDto, UpdateLineConfigDto } from './line-configs.dto';

@Injectable()
export class LineConfigsService {
  constructor(private prisma: PrismaService) {}

  // 🛠️ Helper: แปลง Code -> ID
  private async resolveBotId(companyId: number, botCode?: string): Promise<number | null> {
    if (!botCode || botCode === 'none' || botCode.trim() === '') return null;

    const bot = await this.prisma.intAiBot.findFirst({
      where: { code: botCode, companyId },
    });

    if (!bot) {
      throw new BadRequestException(`ไม่พบบอทที่มีรหัส Code: "${botCode}" ในระบบ`);
    }
    return bot.id;
  }

  // ✅ Create
  async create(companyId: number, dto: CreateLineConfigDto) {
    const aiBotId = await this.resolveBotId(companyId, dto.aiBotCode);

    // 🛠️ Map ข้อมูลให้ตรงกับ Database (Prisma) เป๊ะๆ
    const dataToSave = {
      channelName: dto.channelName,
      channelId: dto.channelId,
      channelSecret: dto.channelSecret,
      channelToken: dto.channelToken,
      
      // ✅ แก้ให้ตรงกับ Schema
      liffIdMain: dto.liffIdMain || undefined, 
      isAiEnabled: dto.isAiEnabled ?? dto.enableAiReply ?? false,
      
      aiBotId: aiBotId,
      companyId,
    };

    try {
      // 🌟 แก้ไข Upsert Logic: เช็คจาก companyId และ channelId คู่กัน
      const existing = await this.prisma.intLineConfig.findFirst({
        where: { 
          companyId: companyId,
          channelId: dto.channelId // 👈 ป้องกันการเขียนทับ LINE บัญชีอื่นของบริษัทเดียวกัน
        }
      });

      if (existing) {
        return await this.prisma.intLineConfig.update({
          where: { id: existing.id },
          data: dataToSave,
        });
      } else {
        return await this.prisma.intLineConfig.create({
          data: dataToSave,
        });
      }
    } catch (error: any) {
      // ดัก Error Duplicate
      if (error.code === 'P2002') {
         throw new BadRequestException('Channel ID หรือการตั้งค่านี้มีอยู่ในระบบแล้ว');
      }
      throw error;
    }
  }

  // ✅ Find All
  async findAll(companyId: number) {
    const configs = await this.prisma.intLineConfig.findMany({
      where: { companyId },
      include: {
        aiBot: { select: { id: true, code: true, name: true, modelName: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    // 💡 Map ข้อมูลเพื่อส่งกลับให้หน้าบ้าน (Lovable) พร้อมสร้าง Webhook URL อัตโนมัติ
    return configs.map(config => ({
      ...config,
      aiBotCode: config.aiBot?.code || null, 
      webhookUrl: `https://kkv-backend-470898127362.asia-southeast3.run.app/api/int/line/webhook/${config.id}`
    }));
  }

  // ✅ Update
  async update(id: number, companyId: number, dto: UpdateLineConfigDto) {
    await this.findOne(id, companyId);

    const updateData: any = {
      channelName: dto.channelName,
      channelId: dto.channelId,
      channelSecret: dto.channelSecret,
      channelToken: dto.channelToken,
      
      // ✅ แก้ให้ตรงกับ Schema
      liffIdMain: dto.liffIdMain,
      isAiEnabled: dto.isAiEnabled ?? dto.enableAiReply,
    };

    if (dto.aiBotCode !== undefined) {
       const aiBotId = await this.resolveBotId(companyId, dto.aiBotCode);
       updateData.aiBotId = aiBotId;
    }

    return this.prisma.intLineConfig.update({
      where: { id },
      data: updateData,
    });
  }
  
  // ✅ Find One
  async findOne(id: number, companyId: number) {
    const config = await this.prisma.intLineConfig.findFirst({
      where: { id, companyId },
      include: { aiBot: true }
    });
    if (!config) throw new NotFoundException('ไม่พบการตั้งค่า LINE');
    
    // 💡 Map ข้อมูลกรณีหน้าบ้านดึงข้อมูลแค่รายการเดียว (GET by ID)
    return {
      ...config,
      aiBotCode: config.aiBot?.code || null,
      webhookUrl: `https://kkv-backend-470898127362.asia-southeast3.run.app/api/int/line/webhook/${config.id}`
    };
  }

  // ✅ Remove
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return this.prisma.intLineConfig.delete({ where: { id } });
  }
}