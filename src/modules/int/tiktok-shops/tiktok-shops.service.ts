import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTiktokShopDto, UpdateTiktokShopDto } from './tiktok-shops.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TiktokShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService // 🟢 Inject HttpService
  ) {}

  // ✅ Helper: ตรวจสอบความเป็นเจ้าของ AI Bot
  private async validateBotOwnership(companyId: number, aiBotId?: number) {
    if (!aiBotId) return;
    const bot = await this.prisma.intAiBot.findFirst({
      where: { id: aiBotId, companyId },
    });
    if (!bot) throw new BadRequestException('AI Bot ที่เลือกไม่ถูกต้อง หรือไม่ใช่ของบริษัทนี้');
  }

  // ==========================================
  // 🟢 NEW: ระบบแลก Token ของ TikTok
  // ==========================================
  async exchangeTokenAndFetchShops(companyId: number, authCode: string) {
    const appKey = process.env.TIKTOK_APP_KEY;
    const appSecret = process.env.TIKTOK_APP_SECRET;

    if (!appKey || !appSecret) {
      throw new InternalServerErrorException('ระบบหลังบ้านยังไม่ได้ตั้งค่า TIKTOK_APP_KEY หรือ TIKTOK_APP_SECRET ในไฟล์ .env');
    }

    try {
      // Step 1: นำ auth_code จากหน้าบ้านไปแลกเป็น Access Token กับ TikTok API
      const tokenUrl = `https://auth.tiktok-shops.com/api/v2/token/get?app_key=${appKey}&app_secret=${appSecret}&auth_code=${authCode}&grant_type=authorized_code`;
      
      const tokenResponse = await firstValueFrom(this.httpService.get(tokenUrl));
      const authData = tokenResponse.data.data;

      if (!authData || !authData.access_token) {
         throw new BadRequestException('รหัส Authorization Code ไม่ถูกต้องหรือหมดอายุ');
      }

      // คำนวณวันหมดอายุ
      const accessExpiresAt = new Date();
      accessExpiresAt.setSeconds(accessExpiresAt.getSeconds() + authData.access_token_expire_in);
      
      const refreshExpiresAt = new Date();
      refreshExpiresAt.setSeconds(refreshExpiresAt.getSeconds() + authData.refresh_token_expire_in);

      // Step 2: บันทึกการเชื่อมต่อลง IntExternalConnection
      const externalConnection = await this.prisma.intExternalConnection.upsert({
        where: {
          companyId_provider_externalUserId: {
            companyId: companyId,
            provider: 'TIKTOK',
            externalUserId: authData.open_id || 'unknown_user',
          }
        },
        update: {
          accessToken: authData.access_token,
          refreshToken: authData.refresh_token,
          expiresAt: accessExpiresAt,
          isActive: true,
        },
        create: {
          companyId,
          provider: 'TIKTOK',
          externalUserId: authData.open_id || 'unknown_user',
          accessToken: authData.access_token,
          refreshToken: authData.refresh_token,
          expiresAt: accessExpiresAt,
        }
      });

      // Step 3: ดึงข้อมูลร้านค้า (สำหรับ TikTok มักจะส่งข้อมูล Seller มาพร้อมกับ Token เลยในบางเงื่อนไข หรือใช้ API get_authorized_shop)
      // *หมายเหตุ: ตรงนี้จำลอง Response ที่จะส่งให้หน้าบ้าน คุณสามารถนำข้อมูล authData มาจัดรูปได้เลย
      return {
        externalConnectionId: externalConnection.id,
        accessToken: authData.access_token,
        refreshToken: authData.refresh_token,
        accessTokenExpiresAt: accessExpiresAt.toISOString(),
        refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
        sellerId: authData.seller_id || authData.open_id,
        sellerName: authData.seller_name || 'TikTok Seller',
        // หน้าบ้านจะนำข้อมูลนี้ไปสร้าง Payload กลับมาบันทึกอีกที
      };

    } catch (error) {
      console.error('TikTok Exchange Token Error:', error?.response?.data || error.message);
      throw new BadRequestException('ไม่สามารถเชื่อมต่อ TikTok Shop ได้ โปรดลองใหม่อีกครั้ง');
    }
  }

  // ==========================================
  // ➕ 1. เพิ่มร้านค้า (Upsert)
  // ==========================================
  async create(companyId: number, dto: CreateTiktokShopDto) {
    await this.validateBotOwnership(companyId, dto.aiBotId);

    const accessExpiresAtDate = dto.accessTokenExpiresAt ? new Date(dto.accessTokenExpiresAt) : null;
    const refreshExpiresAtDate = dto.refreshTokenExpiresAt ? new Date(dto.refreshTokenExpiresAt) : null;

    return await this.prisma.intTiktokShop.upsert({
      where: { 
        shopId: dto.shopId 
      },
      update: {
        sellerId: dto.sellerId,
        sellerName: dto.sellerName,
        shopName: dto.shopName,
        shopCipher: dto.shopCipher,
        region: dto.region,
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
        accessTokenExpiresAt: accessExpiresAtDate,
        refreshTokenExpiresAt: refreshExpiresAtDate,
        externalConnectionId: dto.externalConnectionId,
        aiBotId: dto.aiBotId || null,
        isAiEnabled: dto.isAiEnabled,
      },
      create: {
        companyId,
        shopId: dto.shopId,
        sellerId: dto.sellerId,
        sellerName: dto.sellerName,
        shopName: dto.shopName,
        shopCipher: dto.shopCipher,
        region: dto.region || 'TH',
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
        accessTokenExpiresAt: accessExpiresAtDate,
        refreshTokenExpiresAt: refreshExpiresAtDate,
        externalConnectionId: dto.externalConnectionId,
        aiBotId: dto.aiBotId || null,
        isAiEnabled: dto.isAiEnabled ?? false,
      },
    });
  }

  // ==========================================
  // 🔍 2. ดึงข้อมูลทั้งหมด
  // ==========================================
  async findAll(companyId: number) {
    return await this.prisma.intTiktokShop.findMany({
      where: { companyId },
      include: { 
        aiBot: true,
        externalConnection: true 
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // ==========================================
  // 🔍 3. ดึงข้อมูล 1 ร้านค้า
  // ==========================================
  async findOne(id: number, companyId: number) {
    const shop = await this.prisma.intTiktokShop.findFirst({
      where: { id, companyId },
      include: { 
        aiBot: true,
        externalConnection: true 
      }
    });
    if (!shop) throw new NotFoundException('ไม่พบข้อมูลการตั้งค่า TikTok Shop');
    return shop;
  }

  // ==========================================
  // 📝 4. แก้ไขการตั้งค่า
  // ==========================================
  async update(id: number, companyId: number, dto: UpdateTiktokShopDto) {
    await this.findOne(id, companyId);
    await this.validateBotOwnership(companyId, dto.aiBotId);

    const accessExpiresAtDate = dto.accessTokenExpiresAt ? new Date(dto.accessTokenExpiresAt) : undefined;
    const refreshExpiresAtDate = dto.refreshTokenExpiresAt ? new Date(dto.refreshTokenExpiresAt) : undefined;

    return await this.prisma.intTiktokShop.update({
      where: { id },
      data: {
        sellerId: dto.sellerId,
        sellerName: dto.sellerName,
        shopName: dto.shopName,
        shopCipher: dto.shopCipher,
        region: dto.region,
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
        accessTokenExpiresAt: accessExpiresAtDate,
        refreshTokenExpiresAt: refreshExpiresAtDate,
        externalConnectionId: dto.externalConnectionId,
        aiBotId: dto.aiBotId || null,
        isAiEnabled: dto.isAiEnabled,
      },
    });
  }

  // ==========================================
  // ❌ 5. ลบร้านค้า
  // ==========================================
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return await this.prisma.intTiktokShop.delete({ 
      where: { id } 
    });
  }

  

  async refreshTiktokToken(shopId: string) {
  const shop = await this.prisma.intTiktokShop.findUnique({ where: { shopId } });
  if (!shop || !shop.refreshToken) return;

  const appKey = process.env.TIKTOK_APP_KEY;
  const appSecret = process.env.TIKTOK_APP_SECRET;

  // ยิง API ไปที่ TikTok เพื่อขอ Token ชุดใหม่
  const refreshUrl = `https://auth.tiktok-shops.com/api/v2/token/refresh?app_key=${appKey}&app_secret=${appSecret}&refresh_token=${shop.refreshToken}&grant_type=refresh_token`;
  
  const response = await firstValueFrom(this.httpService.get(refreshUrl));
  const newData = response.data.data;

  // อัปเดต Token ชุดใหม่และวันหมดอายุลง Database
  return await this.prisma.intTiktokShop.update({
    where: { shopId },
    data: {
      accessToken: newData.access_token,
      refreshToken: newData.refresh_token,
      accessTokenExpiresAt: new Date(Date.now() + newData.access_token_expire_in * 1000),
      refreshTokenExpiresAt: new Date(Date.now() + newData.refresh_token_expire_in * 1000),
    },
  });
}
}