import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAiModelConfigDto, UpdateAiModelConfigDto } from './ai-model-config.dto';

@Injectable()
export class AiModelConfigService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: number, activeOnly: boolean, isSuperAdmin: boolean, isHQ: boolean) {
    // 🛡️ บล็อก Agent ไม่ให้เข้าถึงข้อมูล
    if (!isHQ) {
        throw new ForbiddenException('เมนูนี้อนุญาตให้เข้าถึงได้เฉพาะสำนักงานใหญ่ (HQ) เท่านั้น');
    }

    const whereClause: any = {};
    if (!isSuperAdmin) {
      whereClause.OR = [{ companyId: companyId }, { companyId: null }];
    }

    if (activeOnly) {
      whereClause.isActive = true;
    }

    return this.prisma.sysAiModelConfig.findMany({
      where: whereClause,
      include: { company: { select: { name: true } } },
      orderBy: [{ provider: 'asc' }, { modelCode: 'asc' }],
    });
  }

  async findEffectiveConfig(targetCompanyId: number, modelCode: string) {
    const customConfig = await this.prisma.sysAiModelConfig.findUnique({
      where: { companyId_modelCode: { companyId: targetCompanyId, modelCode: modelCode } }
    });

    if (customConfig && customConfig.isActive) return customConfig;

    const globalConfig = await this.prisma.sysAiModelConfig.findFirst({
      where: { companyId: null, modelCode: modelCode, isActive: true }
    });

    if (!globalConfig) throw new NotFoundException(`ไม่พบการตั้งค่า AI Model: ${modelCode}`);
    return globalConfig;
  }

  async create(dto: CreateAiModelConfigDto, currentCompanyId: number, isSuperAdmin: boolean, isHQ: boolean) {
    if (!isHQ) throw new ForbiddenException('เฉพาะสำนักงานใหญ่เท่านั้นที่จัดการได้');
    
    let targetCompanyId = dto.companyId ?? null;
    if (!isSuperAdmin) targetCompanyId = currentCompanyId;

    const existing = await this.prisma.sysAiModelConfig.findFirst({
      where: { companyId: targetCompanyId, modelCode: dto.modelCode }
    });
    if (existing) throw new ConflictException('มีการตั้งค่านี้อยู่แล้ว');

    return this.prisma.sysAiModelConfig.create({ data: { ...dto, companyId: targetCompanyId } });
  }

  async update(id: number, dto: UpdateAiModelConfigDto, currentCompanyId: number, isSuperAdmin: boolean, isHQ: boolean) {
    if (!isHQ) throw new ForbiddenException('เฉพาะสำนักงานใหญ่เท่านั้นที่จัดการได้');
    
    const config = await this.prisma.sysAiModelConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('ไม่พบข้อมูล');

    if (!isSuperAdmin && config.companyId !== currentCompanyId) {
        throw new ForbiddenException('ไม่มีสิทธิ์แก้ไขของบริษัทอื่น');
    }

    const updateData = { ...dto };
    if (!isSuperAdmin) delete updateData.companyId;

    return this.prisma.sysAiModelConfig.update({ where: { id }, data: updateData });
  }

  async remove(id: number, currentCompanyId: number, isSuperAdmin: boolean, isHQ: boolean) {
    if (!isHQ) throw new ForbiddenException('เฉพาะสำนักงานใหญ่เท่านั้นที่จัดการได้');
    
    const config = await this.prisma.sysAiModelConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('ไม่พบข้อมูล');

    if (!isSuperAdmin && config.companyId !== currentCompanyId) {
        throw new ForbiddenException('ไม่มีสิทธิ์ลบของบริษัทอื่น');
    }

    return this.prisma.sysAiModelConfig.delete({ where: { id } });
  }
}