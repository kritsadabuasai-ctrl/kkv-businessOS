import { 
  Injectable, 
  NotFoundException, 
  BadRequestException 
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateShopProfileDto } from './dto/create-shop-profile.dto';
import { UpdateShopProfileDto } from './dto/update-shop-profile.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ShopProfilesService {
  constructor(private readonly prisma: PrismaService) {}

 async create(companyId: number, dto: CreateShopProfileDto) {
    // ✨ [แกะตัวแปร] สกัด logoMediaId ออกมาตรวจเช็กด้วย
    const { bankAccounts, documents, taxRate, latitude, longitude, customDomain, logoMediaId, ...shopData } = dto;

    const existingShop = await this.prisma.comShopProfile.findFirst({
      where: { companyId, shopCode: dto.shopCode },
    });

    if (existingShop) {
      throw new BadRequestException('รหัสสาขานี้มีอยู่แล้วในระบบ');
    }

    // 🌐 ตรวจสอบโดเมนซ้ำในระดับร้านค้า/สาขา
    if (customDomain) {
      const existingDomain = await this.prisma.comShopProfile.findUnique({
        where: { customDomain },
      });
      if (existingDomain) {
        throw new BadRequestException('โดเมนนี้มีผู้ใช้งานอื่นในระบบแล้ว กรุณาใช้โดเมนอื่น');
      }
    }

    // 🛡️ [ระบบ Auto-Bind]: ตรวจสอบและค้นหา ID โลโก้แบบเดียวกับตอน Update
    let finalLogoMediaId = logoMediaId;

    if (finalLogoMediaId) {
      const mediaExists = await this.prisma.sysMedia.findUnique({
        where: { id: finalLogoMediaId },
        select: { id: true }
      });
      if (!mediaExists) {
        console.warn(`⚠️ [Create Shop] logoMediaId: ${finalLogoMediaId} หาไม่เจอในระบบ กำลังจะใช้ระบบค้นหาอัตโนมัติ`);
        finalLogoMediaId = undefined;
      }
    }

    // 🌟 [Auto-Bind] ถ้าไม่มี ID ส่งมา ให้ควานหารูปล่าสุดที่เพิ่งอัปโหลด
    if (!finalLogoMediaId) {
      const latestLogo = await this.prisma.sysMedia.findFirst({
        where: { 
          companyId: companyId, 
          module: 'SHOP_LOGO' 
        },
        orderBy: { createdAt: 'desc' }
      });
      if (latestLogo) {
        finalLogoMediaId = latestLogo.id;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // ถ้าตั้งเป็นสาขาหลัก (isMainShop = true) ให้ไปปลดสาขาอื่นเป็น false ก่อน
      if (dto.isMainShop) {
        await tx.comShopProfile.updateMany({
          where: { companyId, isMainShop: true },
          data: { isMainShop: false },
        });
      }

      // บันทึกข้อมูลลงตารางหลัก com_shop_profiles
      const newShop = await tx.comShopProfile.create({
        data: {
          ...shopData,
          companyId,
          customDomain,
          taxRate: taxRate !== undefined ? new Prisma.Decimal(taxRate) : undefined,
          latitude: latitude !== undefined ? new Prisma.Decimal(latitude) : undefined,
          longitude: longitude !== undefined ? new Prisma.Decimal(longitude) : undefined,
          // 🚩 ผูกโลโก้ที่ผ่านการกรองความถูกต้องแล้ว
          ...(finalLogoMediaId !== undefined && { logoMediaId: finalLogoMediaId })
        },
        include: {
          logoMedia: true,
        }
      });

      // 📌 จัดการบัญชีธนาคาร
      if (bankAccounts && bankAccounts.length > 0) {
        await tx.comBankAccount.createMany({
          data: bankAccounts.map(bank => ({
            ...bank,
            shopId: newShop.id,
            companyId: companyId
          }))
        });
      }

      // 📌 🛡️ จัดการเอกสารร้านค้า (เพิ่มการเช็กความปลอดภัยก่อนบันทึก)
      if (documents && documents.length > 0) {
        for (const doc of documents) {
          
          // เช็กก่อนว่าไฟล์เอกสารมีอยู่จริงไหม ป้องกัน Error P2025
          const docMediaExists = await tx.sysMedia.findUnique({
            where: { id: doc.mediaId },
            select: { id: true }
          });

          if (docMediaExists) {
            await tx.comShopDocument.create({
              data: {
                companyId,
                shopProfileId: newShop.id,
                mediaId: doc.mediaId,
                docType: doc.docType,
              }
            });
          } else {
             console.warn(`⚠️ [Create Shop] Document mediaId: ${doc.mediaId} หาไม่เจอ ข้ามการบันทึกเอกสารนี้`);
          }
        }
      }

      // คืนค่าข้อมูลร้านค้าที่สร้างเสร็จสมบูรณ์
      return tx.comShopProfile.findUnique({
        where: { id: newShop.id },
        include: {
          logoMedia: true,
          bankAccounts: true,
          documents: { include: { media: true } }
        }
      });
    });
  }

  // ==========================================
  // 🏪 2. ดึงข้อมูลสาขาทั้งหมดของบริษัท (Find All)
  // ==========================================
  async findAll(companyId: number) {
    return this.prisma.comShopProfile.findMany({
      where: { companyId },
      include: { 
        logoMedia: true, 
        bankAccounts: true,
        documents: { include: { media: true } }
      },
      orderBy: [
        { isMainShop: 'desc' }, 
        { createdAt: 'asc' }
      ],
    });
  }

  // ==========================================
  // 🏪 3. ดึงข้อมูลสาขารายตัว (Find One)
  // ==========================================
  async findOne(id: number, companyId: number) {
    const shop = await this.prisma.comShopProfile.findUnique({
      where: { id, companyId },
      include: { 
        logoMedia: true, 
        bankAccounts: true,
        documents: { include: { media: true } }
      },
    });

    if (!shop) {
      throw new NotFoundException('ไม่พบข้อมูลสาขา/ร้านค้านี้');
    }

    return shop;
  }

 // ==========================================
  // 🏪 4. อัปเดตข้อมูลสาขา (Update + ระบบ Auto-Bind)
  // ==========================================
  async update(id: number, companyId: number, dto: UpdateShopProfileDto) {
    // ตรวจสอบความปลอดภัยว่าร้านนี้มีอยู่จริงและผู้ใช้มีสิทธิ์เข้าถึงในบริษัทนี้ไหม
    const shop = await this.findOne(id, companyId);

    // ✨ [แกะตัวแปร] สกัด logoMediaId ออกมาแยกจัดการเพื่อป้องกันระบบล่ม
    const { bankAccounts, documents, taxRate, latitude, longitude, customDomain, logoMediaId, ...shopData } = dto;

    // 🌐 ตรวจสอบโดเมนซ้ำ
    if (customDomain) {
      const existingDomain = await this.prisma.comShopProfile.findUnique({
        where: { customDomain },
      });
      if (existingDomain && existingDomain.id !== id) {
        throw new BadRequestException('โดเมนนี้มีผู้ใช้งานอื่นในระบบแล้ว กรุณาใช้โดเมนอื่น');
      }
    }

    // 🛡️ [ระบบ Auto-Bind]: ค้นหา ID โลโก้ที่ถูกต้องที่สุด (แบบเดียวกับ Company)
    let finalLogoMediaId = logoMediaId;

    if (finalLogoMediaId) {
      const mediaExists = await this.prisma.sysMedia.findUnique({
        where: { id: finalLogoMediaId },
        select: { id: true }
      });
      if (!mediaExists) {
        console.warn(`⚠️ [Update Shop] logoMediaId: ${finalLogoMediaId} หาไม่เจอในระบบ (อาจเป็น ID เก่า) กำลังจะใช้ระบบค้นหาอัตโนมัติ`);
        finalLogoMediaId = undefined;
      }
    }

    // 🌟 [Auto-Bind] ถ้าไม่มี ID ส่งมา หรือส่งมาผิด ควานหารูปโลโก้ร้านล่าสุด
    if (!finalLogoMediaId) {
      const latestLogo = await this.prisma.sysMedia.findFirst({
        // 💡 หมายเหตุ: API อัปโหลดรูปร้านค้า หน้าบ้านควรส่ง module: 'SHOP_LOGO' มานะครับ (แก้ตามชื่อที่คุณตั้งไว้ได้เลย)
        where: { 
          companyId: companyId, 
          module: 'SHOP_LOGO' 
        },
        orderBy: { createdAt: 'desc' }
      });
      if (latestLogo) {
        finalLogoMediaId = latestLogo.id;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // ถ้าเปลี่ยนสาขานี้ให้เป็นสาขาหลัก ให้ไปปลดสาขาเดิมก่อน
      if (dto.isMainShop === true && !shop.isMainShop) {
        await tx.comShopProfile.updateMany({
          where: { companyId, isMainShop: true },
          data: { isMainShop: false },
        });
      }

      // อัปเดตข้อมูลตารางหลัก com_shop_profiles
      await tx.comShopProfile.update({
        where: { id },
        data: {
          ...shopData,
          customDomain: customDomain !== undefined ? customDomain : undefined,
          taxRate: taxRate !== undefined ? new Prisma.Decimal(taxRate) : undefined,
          latitude: latitude !== undefined ? new Prisma.Decimal(latitude) : undefined,
          longitude: longitude !== undefined ? new Prisma.Decimal(longitude) : undefined,
          
          // 🚩 ผูกโลโก้ร้านค้าอย่างปลอดภัย (ถ้าหาไม่เจอจริงๆ ถึงจะปล่อยผ่าน)
          ...(finalLogoMediaId !== undefined && { logoMediaId: finalLogoMediaId })
        }
      });

      // 📌 จัดการบัญชีธนาคาร (Replace All)
      if (bankAccounts !== undefined) {
        await tx.comBankAccount.deleteMany({ where: { shopId: id } });
        if (bankAccounts.length > 0) {
          await tx.comBankAccount.createMany({
            data: bankAccounts.map(bank => ({
              ...bank,
              shopId: id,
              companyId: companyId
            }))
          });
        }
      }

      // 📌 🛡️ จัดการเอกสารร้านค้า (เสริมระบบป้องกัน ID ผีสิง แบบเดียวกับ Company)
      if (documents !== undefined) {
        await tx.comShopDocument.deleteMany({ where: { shopProfileId: id } });
        if (documents.length > 0) {
          for (const doc of documents) {
            
            // เช็กก่อนว่าไฟล์มีอยู่จริงไหม
            const docMediaExists = await tx.sysMedia.findUnique({
              where: { id: doc.mediaId },
              select: { id: true }
            });

            if (docMediaExists) {
              await tx.comShopDocument.create({
                data: {
                  companyId,
                  shopProfileId: id,
                  mediaId: doc.mediaId,
                  docType: doc.docType,
                }
              });
            } else {
              console.warn(`⚠️ [Update Shop] Document mediaId: ${doc.mediaId} หาไม่เจอ ข้ามการบันทึกเอกสารนี้`);
            }
          }
        }
      }

      // ดึงข้อมูลใหม่ล่าสุดส่งกลับไป
      return tx.comShopProfile.findUnique({
        where: { id },
        include: {
          logoMedia: true,
          bankAccounts: true,
          documents: { include: { media: true } }
        }
      });
    });
  }

  // ==========================================
  // 🏪 5. ลบสาขา (Delete)
  // ==========================================
  async remove(id: number, companyId: number) {
    const shop = await this.findOne(id, companyId);

    if (shop.isMainShop) {
      throw new BadRequestException('ไม่สามารถลบสาขาหลัก (Main Shop) ได้ กรุณาตั้งสาขาอื่นเป็นสาขาหลักก่อน');
    }

    // ข้อมูลตารางลูกจะโดนลบอัตโนมัติจาก onDelete: Cascade ใน Schema
    await this.prisma.comShopProfile.delete({
      where: { id },
    });

    return { message: 'ลบข้อมูลสาขาและข้อมูลที่เชื่อมโยงสำเร็จ' };
  }
}