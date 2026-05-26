import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehouseService {
  constructor(private prisma: PrismaService) {}

 // ==========================================
  // 🏭 1. สร้างคลังสินค้าใหม่ (Create) + 🛡️ Defensive Code
  // ==========================================
  async create(companyId: number, dto: CreateWarehouseDto) {
    // ตรวจสอบรหัสคลังสินค้าซ้ำภายในบริษัทเดียวกัน
    const existingWH = await this.prisma.comWarehouse.findFirst({
      where: { companyId, code: dto.code },
    });
    if (existingWH) {
      throw new BadRequestException('รหัสคลังสินค้านี้มีอยู่แล้วในระบบ');
    }

    return this.prisma.$transaction(async (tx) => {
      // ถ้ามีการตั้งคลังนี้เป็นคลังเริ่มต้น (isDefault) ต้องไปปลดคลังอื่นๆ ก่อน
      if (dto.isDefault) {
        await tx.comWarehouse.updateMany({
          where: { companyId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // 1.1 บันทึกข้อมูลคลังสินค้าลงตาราง (ท่าจับวางทีละฟิลด์ ปลอดภัย 100%)
      const newWarehouse = await tx.comWarehouse.create({
        data: {
          companyId,
          name: dto.name,
          code: dto.code,
          address: dto.address,
          shopId: dto.shopId ? Number(dto.shopId) : null,
          isDefault: dto.isDefault ?? false,
          isActive: dto.isActive ?? true,
          ...(dto.type && dto.type !== '' && { type: dto.type as any }),
        },
      });

      // 🌟 1.2 [Defensive Code] กรองเอกสารที่มีอยู่จริงใน SysMedia ก่อน
      if (dto.documents && dto.documents.length > 0) {
        const mediaIds = dto.documents.map(d => d.mediaId);
        const existingMedias = await tx.sysMedia.findMany({
          where: { id: { in: mediaIds } },
          select: { id: true }
        });
        
        const validMediaIds = new Set(existingMedias.map(m => m.id));

        for (const doc of dto.documents) {
          if (validMediaIds.has(doc.mediaId)) {
            await tx.comWarehouseDocument.create({
              data: {
                companyId,
                warehouseId: newWarehouse.id,
                mediaId: doc.mediaId,
                docType: doc.docType,
              },
            });
          } else {
             console.warn(`⚠️ [Create Warehouse] Media ID: ${doc.mediaId} หาไม่เจอ ข้ามการผูกเอกสารนี้`);
          }
        }
      }

      return tx.comWarehouse.findUnique({
        where: { id: newWarehouse.id },
        include: {
          documents: { include: { media: true } },
        },
      });
    });
  }

  // ==========================================
  // 🏭 2. ดึงรายการคลังสินค้าทั้งหมดของบริษัท (Find All)
  // ==========================================
  async findAll(companyId: number) {
    return this.prisma.comWarehouse.findMany({
      where: { companyId },
      include: {
        documents: { include: { media: true } }, // ✅ กวาดข้อมูลเอกสารแนบไปด้วย
      },
      orderBy: [
        { isDefault: 'desc' }, // เอาคลังหลักขึ้นก่อน
        { createdAt: 'desc' },
      ],
    });
  }

  // ==========================================
  // 🏭 3. ดึงข้อมูลคลังสินค้าเดี่ยว (Find One)
  // ==========================================
  async findOne(companyId: number, id: number) {
    const warehouse = await this.prisma.comWarehouse.findFirst({
      where: { id, companyId },
      include: {
        documents: { include: { media: true } }, // ✅ กวาดข้อมูลเอกสารแนบไปด้วย
      },
    });
    if (!warehouse) throw new NotFoundException(`ไม่พบข้อมูลคลังสินค้า ID ${id}`);
    return warehouse;
  }

 // ==========================================
  // 🏭 4. อัปเดตข้อมูลคลังสินค้า (Update) + 🛡️ Defensive Code
  // ==========================================
  async update(companyId: number, id: number, dto: UpdateWarehouseDto) {
    const existingWH = await this.findOne(companyId, id);

    if (dto.code && dto.code !== existingWH.code) {
      const duplicateCode = await this.prisma.comWarehouse.findFirst({
        where: { companyId, code: dto.code },
      });
      if (duplicateCode) {
        throw new BadRequestException('รหัสคลังสินค้านี้มีอยู่แล้วในระบบ');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault && !existingWH.isDefault) {
        await tx.comWarehouse.updateMany({
          where: { companyId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // 4.1 อัปเดตข้อมูลตารางหลัก 
      await tx.comWarehouse.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.shopId !== undefined && { shopId: dto.shopId ? Number(dto.shopId) : null }),
          ...(dto.type && dto.type !== '' && { type: dto.type as any }),
        },
      });

      // 🌟 4.2 [Defensive Code] จัดการข้อมูลเอกสารคลังสินค้า
      if (dto.documents !== undefined) {
        await tx.comWarehouseDocument.deleteMany({
          where: { warehouseId: id },
        });

        if (dto.documents.length > 0) {
          const mediaIds = dto.documents.map(d => d.mediaId);
          const existingMedias = await tx.sysMedia.findMany({
            where: { id: { in: mediaIds } },
            select: { id: true }
          });
          const validMediaIds = new Set(existingMedias.map(m => m.id));

          for (const doc of dto.documents) {
            if (validMediaIds.has(doc.mediaId)) {
              await tx.comWarehouseDocument.create({
                data: {
                  companyId,
                  warehouseId: id,
                  mediaId: doc.mediaId,
                  docType: doc.docType,
                },
              });
            } else {
               console.warn(`⚠️ [Update Warehouse] Media ID: ${doc.mediaId} หาไม่เจอ ข้ามการผูกเอกสารนี้`);
            }
          }
        }
      }

      return tx.comWarehouse.findUnique({
        where: { id },
        include: {
          documents: { include: { media: true } },
        },
      });
    });
  }

  // ==========================================
  // 🏭 5. ลบคลังสินค้า (Delete)
  // ==========================================
  async remove(companyId: number, id: number) {
    const warehouse = await this.findOne(companyId, id);

    if (warehouse.isDefault) {
      throw new BadRequestException('ไม่สามารถลบคลังสินค้าเริ่มต้น (Default Warehouse) ได้ กรุณาตั้งคลังอื่นเป็นคลังเริ่มต้นก่อน');
    }

    // เนื่องจากความสัมพันธ์ ComWarehouseDocument ตั้งไว้เป็น onDelete: Cascade ในระดับฐานข้อมูล
    // พอลบคลังหลัก ข้อมูลเอกสารเชื่อมโยงในระบบจะเคลียร์ตัวเองให้โดยอัตโนมัติครับ
    await this.prisma.comWarehouse.delete({
      where: { id },
    });

    return { message: 'ลบข้อมูลคลังสินค้าและเอกสารอ้างอิงทั้งหมดเสร็จสิ้น' };
  }
}