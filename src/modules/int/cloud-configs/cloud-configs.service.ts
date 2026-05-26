import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCloudConfigDto, UpdateCloudConfigDto } from './cloud-configs.dto';

@Injectable()
export class CloudConfigsService {
  constructor(private prisma: PrismaService) {}

  private async deactivateOthers(companyId: number, provider: string) {
    await this.prisma.intCloudConfig.updateMany({
      where: { companyId, provider, isActive: true },
      data: { isActive: false },
    });
  }

  async create(companyId: number, dto: CreateCloudConfigDto) {
    if (dto.isActive) {
      await this.deactivateOthers(companyId, dto.provider);
    }

    return this.prisma.intCloudConfig.create({
      data: {
        ...dto,
        companyId,
      },
    });
  }

  async findAll(companyId: number) {
    return this.prisma.intCloudConfig.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, companyId: number) {
    const config = await this.prisma.intCloudConfig.findFirst({
      where: { id, companyId },
    });
    if (!config) throw new NotFoundException('Cloud config not found');
    return config;
  }

  async update(id: number, companyId: number, dto: UpdateCloudConfigDto) {
    const currentConfig = await this.findOne(id, companyId);

    if (dto.isActive === true) {
      await this.deactivateOthers(companyId, currentConfig.provider);
    }

    return this.prisma.intCloudConfig.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return this.prisma.intCloudConfig.delete({ where: { id } });
  }
}