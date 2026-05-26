import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateQuotaDto } from './dto/ai-quota.dto';

@Injectable()
export class AiQuotasService {
  private readonly logger = new Logger(AiQuotasService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * ✅ สร้างโควตาเริ่มต้นพร้อมพื้นที่จัดเก็บ (Lazy Initialization)
   */
  private async ensureQuotaExists(companyId: number) {
    const quota = await this.prisma.intAiQuota.findUnique({ where: { companyId } });
    if (quota) return quota;

    this.logger.log(`⚠️ Creating default quota for Company ${companyId}`);
    return this.prisma.intAiQuota.create({
      data: {
        companyId,
        tier: 'FREE',
        monthlyLimit: 100000,
        maxStorageBytes: 524288000, // 500MB
        maxSingleFileSize: 10485760, // 10MB
        usedThisMonth: 0,
        usedStorageBytes: 0,
        extraCredit: 0,
      }
    });
  }

  /**
   * ✅ หักโควตาและบันทึกประวัติการใช้ Token
   */
  async recordUsage(data: {
    companyId: number;
    aiBotId?: number;
    modelName: string;
    promptTokens: number;
    completionTokens: number;
    source: string;
  }) {
    await this.ensureQuotaExists(data.companyId);
    const total = BigInt(data.promptTokens + data.completionTokens);

    return await this.prisma.$transaction(async (tx) => {
      const quota = await tx.intAiQuota.findUnique({ where: { companyId: data.companyId } });
      if (!quota) throw new NotFoundException('ไม่พบข้อมูลโควตา');

      const totalAvailable = quota.monthlyLimit - quota.usedThisMonth + quota.extraCredit;
      if (totalAvailable < total) {
        throw new BadRequestException(`โควตา AI ไม่เพียงพอ (ขาด ${total - totalAvailable} tokens)`);
      }

      await tx.intAiUsageLog.create({
        data: {
          companyId: data.companyId,
          aiBotId: data.aiBotId,
          modelName: data.modelName,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: Number(total),
          source: data.source,
        },
      });

      return await tx.intAiQuota.update({
        where: { companyId: data.companyId },
        data: { usedThisMonth: { increment: total } },
      });
    });
  }

  /**
   * ✅ ดึงสถานะและแปลง BigInt เป็น Number/String เพื่อให้ JSON ไม่พัง
   */
  async getQuota(companyId: number) {
    const quota = await this.ensureQuotaExists(companyId);

    return {
      ...quota,
      monthlyLimit: Number(quota.monthlyLimit),
      usedThisMonth: Number(quota.usedThisMonth),
      maxStorageBytes: Number(quota.maxStorageBytes),
      usedStorageBytes: Number(quota.usedStorageBytes),
      extraCredit: Number(quota.extraCredit),
    };
  }

  /**
   * ✅ อัปเดตแพ็กเกจ/พื้นที่ โดย Admin
   */
  async updateQuota(companyId: number, dto: UpdateQuotaDto) {
    await this.ensureQuotaExists(companyId);
    
    const updated = await this.prisma.intAiQuota.update({
      where: { companyId },
      data: {
        ...(dto.tier && { tier: dto.tier }),
        ...(dto.monthlyLimit !== undefined && { monthlyLimit: BigInt(dto.monthlyLimit) }),
        ...(dto.extraCredit !== undefined && { extraCredit: BigInt(dto.extraCredit) }),
        ...(dto.maxStorageBytes !== undefined && { maxStorageBytes: BigInt(dto.maxStorageBytes) }),
        ...(dto.maxSingleFileSize !== undefined && { maxSingleFileSize: dto.maxSingleFileSize }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
      },
    });

    return this.getQuota(companyId); // ส่งค่าที่แปลง Number แล้วกลับไป
  }
}