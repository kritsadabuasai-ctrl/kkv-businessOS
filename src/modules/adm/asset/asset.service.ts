import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAssetCategoryDto, CreateAssetDto, CreateAssetRequestDto } from './asset.dto';

@Injectable()
export class AssetService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // MASTER: Asset Categories
  // ==========================================
  async createCategory(companyId: number, dto: CreateAssetCategoryDto) {
    return this.prisma.admAssetCategory.create({
      data: { ...dto, companyId }
    });
  }

  async findAllCategories(companyId: number) {
    return this.prisma.admAssetCategory.findMany({
      where: { companyId, isActive: true },
    });
  }

  // ==========================================
  // CORE: Assets (ทะเบียนครุภัณฑ์)
  // ==========================================
  async createAsset(companyId: number, dto: CreateAssetDto) {
    return this.prisma.admAsset.create({
      data: {
        ...dto,
        companyId,
        acquisitionDate: new Date(dto.acquisitionDate),
      },
      include: { category: true, assignedTo: { select: { firstName: true, lastName: true } } }
    });
  }

  async findAllAssets(companyId: number, query: any) {
    return this.prisma.admAsset.findMany({
      where: { 
        companyId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.categoryId ? { categoryId: parseInt(query.categoryId) } : {})
      },
      include: { 
        category: true,
        assignedTo: { select: { firstName: true, lastName: true, employeeCode: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // ==========================================
  // TRANSACTION: Asset Requests (ใบคำร้อง)
  // ==========================================
  async createRequest(companyId: number, dto: CreateAssetRequestDto) {
    // 1. สร้างเลข DocNo อัตโนมัติ ตามประเภทคำร้อง (เช่น PR = ซื้อ, WR = เบิก/ซ่อม)
    const prefix = dto.requestType === 'PROCUREMENT' ? 'PR' : 'WR';
    const year = new Date().getFullYear() + 543;
    const count = await this.prisma.admAssetRequest.count({ where: { companyId, requestType: dto.requestType } });
    const docNo = `${prefix}-${year}-${(count + 1).toString().padStart(4, '0')}`;

    return this.prisma.admAssetRequest.create({
      data: {
        companyId,
        docNo,
        requestType: dto.requestType,
        fiscalYear: dto.fiscalYear,
        requesterId: dto.requesterId,
        subject: dto.subject,
        reason: dto.reason,
        status: 'PENDING_APPROVE',
        items: {
          create: dto.items.map(item => ({
            assetId: item.assetId,
            itemName: item.itemName,
            estimatedPrice: item.estimatedPrice,
            quantity: item.quantity ?? 1,
            remark: item.remark
          }))
        }
      },
      include: { items: true }
    });
  }

  async findAllRequests(companyId: number) {
    return this.prisma.admAssetRequest.findMany({
      where: { companyId },
      include: { 
        requester: { select: { firstName: true, lastName: true } },
        items: { include: { asset: { select: { assetNumber: true, name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}