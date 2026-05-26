import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class BankAccountsService {
  constructor(private prisma: PrismaService) {}

  // 1. เพิ่มบัญชี
  // 1. เพิ่มบัญชี
  async create(dto: CreateBankAccountDto, companyId: number) {
    // Security: เช็คก่อนว่า Shop ID นี้ เป็นของ Company เราจริงไหม
    const shop = await this.prisma.comShopProfile.findFirst({
      where: { id: dto.shopId, companyId },
    });
    if (!shop) throw new ForbiddenException(`You do not own Shop ID ${dto.shopId}`);

    // Logic: ถ้าตั้งเป็น Default ให้เคลียร์ของเก่าในร้านนี้
    if (dto.isDefault) {
      await this.clearDefault(dto.shopId);
    }

    return this.prisma.comBankAccount.create({
      data: {
        ...dto,
        companyId: companyId, // 🌟 แนบ companyId เพิ่มเข้าไปที่นี่ครับ
      },
    });
  }

  // 2. ดูบัญชีในร้าน
  async findAllByShop(shopId: number, companyId: number) {
    // Security Check
    const shop = await this.prisma.comShopProfile.findFirst({
      where: { id: shopId, companyId },
    });
    if (!shop) throw new ForbiddenException(`You do not own Shop ID ${shopId}`);

    return this.prisma.comBankAccount.findMany({
      where: { shopId },
      orderBy: { isDefault: 'desc' }, // เอาตัวหลักขึ้นก่อน
    });
  }

  // 3. ดูทีละอัน
  async findOne(id: number, companyId: number) {
    const account = await this.prisma.comBankAccount.findUnique({
      where: { id },
      include: { shop: true }, // Join เพื่อเช็ค CompanyId
    });

    if (!account) throw new NotFoundException(`Bank Account ID ${id} not found`);
    
    // Security Check: บัญชีนี้ต้องอยู่ในร้านที่เป็นของบริษัทเรา
    if (account.shop.companyId !== companyId) {
      throw new ForbiddenException(`Access denied`);
    }

    return account;
  }

  // 4. แก้ไข
  async update(id: number, companyId: number, dto: UpdateBankAccountDto) {
    const existing = await this.findOne(id, companyId); // เช็คสิทธิ์ในตัว

    // ถ้าแก้เป็น Default ก็ต้องเคลียร์ของเก่าในร้านเดียวกัน
    if (dto.isDefault) {
      await this.clearDefault(existing.shopId);
    }

    return this.prisma.comBankAccount.update({
      where: { id },
      data: dto,
    });
  }

  // 5. ลบ
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId); // เช็คสิทธิ์ในตัว
    return this.prisma.comBankAccount.delete({ where: { id } });
  }

  // --- Helper: เคลียร์ค่า Default ในร้าน ---
  private async clearDefault(shopId: number) {
    await this.prisma.comBankAccount.updateMany({
      where: { shopId, isDefault: true },
      data: { isDefault: false },
    });
  }
}