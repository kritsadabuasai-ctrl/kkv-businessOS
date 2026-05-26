import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateFacebookPageDto, UpdateFacebookPageDto } from './facebook-pages.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class FacebookPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService // 🟢 Inject HttpService เข้ามาเพื่อใช้ยิง API ไปหา Facebook
  ) {}

  // ฟังก์ชันช่วยตรวจสอบว่า AI Bot ที่เลือก เป็นของบริษัทนี้จริงๆ หรือไม่
  private async validateBotOwnership(companyId: number, aiBotId?: number) {
    if (!aiBotId) return;
    const bot = await this.prisma.intAiBot.findFirst({
      where: { id: aiBotId, companyId },
    });
    if (!bot) throw new BadRequestException('AI Bot ที่เลือกไม่ถูกต้อง หรือไม่มีสิทธิ์เข้าถึง');
  }

  // ==========================================
  // 🟢 NEW: ระบบแลก Token และดึงรายชื่อเพจ
  // ==========================================
  async exchangeTokenAndFetchPages(companyId: number, shortLivedToken: string) {
    // ต้องตั้งค่า FACEBOOK_APP_ID และ FACEBOOK_APP_SECRET ไว้ในไฟล์ .env
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      throw new InternalServerErrorException('ระบบหลังบ้านยังไม่ได้ตั้งค่า Facebook App ID หรือ Secret ในไฟล์ .env');
    }

    try {
      // Step 1: นำ Short-lived token ไปแลกเป็น Long-lived token (อายุ 60 วัน)
      const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
      const tokenResponse = await firstValueFrom(this.httpService.get(tokenUrl));
      const longLivedToken = tokenResponse.data.access_token;
      const expiresIn = tokenResponse.data.expires_in; // จำนวนวินาที

      // คำนวณวันหมดอายุ
      const expiresAt = new Date();
      if (expiresIn) {
         expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
      } else {
         expiresAt.setDate(expiresAt.getDate() + 60); // Default 60 วัน
      }

      // Step 2: ดึงข้อมูล User (Admin) จาก Facebook
      const meUrl = `https://graph.facebook.com/v19.0/me?access_token=${longLivedToken}`;
      const meResponse = await firstValueFrom(this.httpService.get(meUrl));
      const fbUserId = meResponse.data.id;

      // Step 3: บันทึก/อัปเดตลงตาราง IntExternalConnection
      const externalConnection = await this.prisma.intExternalConnection.upsert({
        where: {
          companyId_provider_externalUserId: {
            companyId: companyId,
            provider: 'FACEBOOK',
            externalUserId: fbUserId,
          }
        },
        update: {
          accessToken: longLivedToken,
          expiresAt: expiresAt,
          isActive: true,
        },
        create: {
          companyId,
          provider: 'FACEBOOK',
          externalUserId: fbUserId,
          accessToken: longLivedToken,
          expiresAt: expiresAt,
        }
      });

      // Step 4: ดึงรายชื่อเพจทั้งหมดที่ User คนนี้เป็น Admin
      const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`;
      const pagesResponse = await firstValueFrom(this.httpService.get(pagesUrl));
      const pagesData = pagesResponse.data.data;

      // Step 5: ส่งข้อมูลกลับไปให้หน้าบ้านแสดงผล
      return {
        externalConnectionId: externalConnection.id,
        longLivedToken: longLivedToken,
        expiresAt: expiresAt.toISOString(),
        pages: pagesData.map(page => ({
          pageId: page.id,
          pageName: page.name,
          accessToken: page.access_token, // Token ของเพจนี้ (สำหรับใช้ตอบแชท)
          picture: `https://graph.facebook.com/${page.id}/picture?type=normal` // รูปร้านค้าเผื่อเอาไปโชว์
        }))
      };

    } catch (error) {
      console.error('Facebook Exchange Token Error:', error?.response?.data || error.message);
      throw new BadRequestException('ไม่สามารถเชื่อมต่อ Facebook ได้: Token อาจหมดอายุหรือไม่ถูกต้อง');
    }
  }

  // ==========================================
  // ฟังก์ชันเดิม (ปรับปรุงให้สมบูรณ์แล้ว)
  // ==========================================

  // สร้างหรืออัปเดตข้อมูลเพจ (Upsert)
  async create(companyId: number, dto: CreateFacebookPageDto) {
    await this.validateBotOwnership(companyId, dto.aiBotId);

    const expiresAtDate = dto.expiresAt ? new Date(dto.expiresAt) : null;

    return await this.prisma.intFacebookPage.upsert({
      where: { 
        pageId: dto.pageId 
      },
      update: {
        pageName: dto.pageName,
        accessToken: dto.accessToken,
        webhookUrl: dto.webhookUrl,
        externalConnectionId: dto.externalConnectionId,
        expiresAt: expiresAtDate,
        aiBotId: dto.aiBotId || null,
        isAiEnabled: dto.isAiEnabled,
      },
      create: {
        companyId,
        pageId: dto.pageId,
        pageName: dto.pageName,
        accessToken: dto.accessToken,
        webhookUrl: dto.webhookUrl,
        externalConnectionId: dto.externalConnectionId,
        expiresAt: expiresAtDate,
        aiBotId: dto.aiBotId || null,
        isAiEnabled: dto.isAiEnabled ?? false,
      },
    });
  }

  // ดึงรายการเพจทั้งหมดของบริษัท
  async findAll(companyId: number) {
    return await this.prisma.intFacebookPage.findMany({
      where: { companyId },
      include: { 
        aiBot: true,
        externalConnection: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // ดึงข้อมูลเพจเดียว
  async findOne(id: number, companyId: number) {
    const page = await this.prisma.intFacebookPage.findFirst({
      where: { id, companyId },
      include: { 
        aiBot: true, 
        externalConnection: true 
      },
    });
    
    if (!page) throw new NotFoundException('ไม่พบเพจที่ระบุ หรือคุณไม่มีสิทธิ์เข้าถึง');
    return page;
  }

 async refreshPageToken(pageId: string) {
  try {
    // 1. ดึงข้อมูลเพจจาก Database
    const page = await this.prisma.intFacebookPage.findUnique({
      where: { pageId },
    });

    // 🛡️ Guard Clause: ตรวจสอบว่ามีเพจในระบบจริงไหม
    if (!page) {
      throw new NotFoundException(`ไม่พบข้อมูลเพจ ID: ${pageId} ในระบบ KKV`);
    }

    // 2. ยิง API ไปหา Facebook เพื่อแลก Token ชุดใหม่ (Long-lived Token)
    // ใช้ Endpoint: /oauth/access_token
    const response = await firstValueFrom(
      this.httpService.get('https://graph.facebook.com/v19.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token', // สั่งให้ Facebook แลกเปลี่ยน Token
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          fb_exchange_token: page.accessToken, // Token ตัวเดิมที่ยังไม่หมดอายุ
        },
      }),
    );

    const { access_token, expires_in } = response.data;

    if (!access_token) {
      throw new InternalServerErrorException('Facebook ไม่ได้ส่ง Access Token ใหม่กลับมา');
    }

    // 3. คำนวณวันหมดอายุใหม่ (expires_in มักจะส่งมาเป็นวินาที ประมาณ 60 วัน)
    const expiresAt = expires_in 
      ? new Date(Date.now() + expires_in * 1000) 
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // Default 60 วันถ้าไม่มีส่งมา

    // 4. อัปเดตข้อมูลใหม่ลง Database
    const updatedPage = await this.prisma.intFacebookPage.update({
      where: { pageId },
      data: {
        accessToken: access_token,
        expiresAt: expiresAt,
        // คุณสามารถเก็บข้อมูลวันที่อัปเดตล่าสุดไว้ดูด้วยได้
        updatedAt: new Date(), 
      },
    });

    console.log(`✅ ต่ออายุ Token สำหรับเพจ ${page.pageName} สำเร็จ (หมดอายุ: ${expiresAt})`);
    
    return updatedPage;

  } catch (error) {
    console.error('❌ Error refreshing Facebook Page Token:', error.response?.data || error.message);
    throw new InternalServerErrorException(
      'ไม่สามารถต่ออายุ Token ได้ กรุณาตรวจสอบ Facebook App Credentials หรือสิทธิ์ของเพจ',
    );
  }
}

  // อัปเดตข้อมูลเพจ
  async update(id: number, companyId: number, dto: UpdateFacebookPageDto) {
    await this.findOne(id, companyId);
    await this.validateBotOwnership(companyId, dto.aiBotId);

    const expiresAtDate = dto.expiresAt ? new Date(dto.expiresAt) : undefined;

    return await this.prisma.intFacebookPage.update({
      where: { id },
      data: {
        pageName: dto.pageName,
        accessToken: dto.accessToken,
        webhookUrl: dto.webhookUrl,
        externalConnectionId: dto.externalConnectionId,
        expiresAt: expiresAtDate,
        aiBotId: dto.aiBotId || null,
        isAiEnabled: dto.isAiEnabled,
      },
    });
  }

  // ลบเพจ
  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return await this.prisma.intFacebookPage.delete({ 
      where: { id } 
    });
  }
}