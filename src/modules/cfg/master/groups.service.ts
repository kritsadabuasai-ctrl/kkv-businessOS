import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMasterGroupDto, UpdateMasterGroupDto } from './master.dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.cfgMasterGroup.findMany({
      orderBy: { groupCode: 'asc' },
    });
  }

  async findOne(id: number, activeOnly?: string) {
    // 🌟 กำหนดเงื่อนไขของลูกๆ (MasterData)
    const itemsCondition = activeOnly === 'false' ? {} : { isActive: true };

    return this.prisma.cfgMasterGroup.findUnique({
      where: { id },
      include: { 
        items: {
          where: itemsCondition, // 👈 ใส่เงื่อนไขกรองลูกตรงนี้
          orderBy: { sortOrder: 'asc' }
        } 
      }, 
    });
  }

  async create(dto: CreateMasterGroupDto) {
    return this.prisma.cfgMasterGroup.create({
      data: dto,
    });
  }

  // 🌟 [เพิ่มใหม่] ฟังก์ชันสำหรับอัปเดตข้อมูลกลุ่ม
  async update(id: number, dto: UpdateMasterGroupDto) {
    return this.prisma.cfgMasterGroup.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    return this.prisma.cfgMasterGroup.delete({
      where: { id },
    });
  }
}