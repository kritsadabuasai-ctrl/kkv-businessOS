import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SendMessageDto } from './chat.dto';
import { LineService } from '../../int/line/line.service';
import { FacebookService } from '../../int/facebook/facebook.service'; // 🌟 นำเข้า Facebook
import { TiktokService } from '../../int/tiktok/tiktok.service'
import { InstagramService } from '../../int/instagram/instagram.service'
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => LineService)) 
    private lineService: LineService,
    // 🌟 เพิ่มบรรทัดนี้: เสียบ FacebookService เข้ามาแบบปลอดภัย
    @Inject(forwardRef(() => FacebookService)) 
    private facebookService: FacebookService ,
    @Inject(forwardRef(() => TiktokService)) 
    private tiktokService: TiktokService ,
    @Inject(forwardRef(() => InstagramService)) 
    private instagramService: InstagramService
  ) {}

  // ==========================================
  // 💬 1. ฟังก์ชันรับข้อความใหม่ (จาก Webhook หรือ แอดมินพิมพ์)
  // ==========================================
 async handleIncomingMessage(companyId: number, dto: SendMessageDto) {
    // 1. ค้นหาแฟ้ม (Session) ที่ยัง 'OPEN' อยู่ของลูกค้ารายนี้
    let session = await this.prisma.intChatSession.findFirst({
      where: {
        companyId: companyId,
        senderId: dto.senderId,
        channel: dto.channel,
        status: 'OPEN',
      },
    });

    // 2. ถ้าไม่มีแฟ้มที่ OPEN ให้สร้างใหม่
    if (!session) {
      session = await this.prisma.intChatSession.create({
        data: {
          companyId: companyId,
          senderId: dto.senderId,
          senderName: dto.senderName || 'Unknown User',
          channel: dto.channel,
          status: 'OPEN',
        },
      });
    }

    // 3. บันทึกข้อความย่อย (ใช้ Index [sessionId, createdAt] ช่วยให้เก็บได้เร็ว)
    const message = await this.prisma.intChatMessage.create({
      data: {
        companyId: companyId,
        sessionId: session.id,
        senderType: dto.senderType,
        messageType: dto.messageType,
        content: dto.content,
        metadata: dto.metadata || null,
        isRead: dto.senderType === 'AGENT' ? true : false,
      },
    });

    // --- 📢 ส่วนของการส่งข้อความตอบกลับ (AGENT Outbound) ---
    if (dto.senderType === 'AGENT') {
      // 🟢 LINE
      if (session.channel === 'LINE') {
        const lineConfig = await this.prisma.intLineConfig.findFirst({
          where: { companyId: companyId, channelToken: { not: '' } }
        });
        if (lineConfig) {
          await this.lineService.pushMessage(lineConfig.channelToken, session.senderId, [{ type: 'text', text: dto.content }], companyId);
        }
      }

      // 🔵 FACEBOOK (เติมส่วนที่ขาดไป)
      if (session.channel === 'FACEBOOK') {
        const fbPage = await this.prisma.intFacebookPage.findFirst({
          where: { companyId: companyId, accessToken: { not: '' } }
        });
        if (fbPage) {
          await this.facebookService.replyMessage(fbPage.accessToken, session.senderId, dto.content, companyId);
        }
      }

      // 🔴 TIKTOK
      if (session.channel === 'TIKTOK') {
        const ttConfig: any = await this.prisma['intTiktokConfig'].findFirst({
          where: { companyId: companyId, accessToken: { not: '' } }
        });
        if (ttConfig) {
          await this.tiktokService.replyMessage(ttConfig.appKey, ttConfig.accessToken, session.senderId, dto.content, ttConfig.shopId, companyId);
        }
      }

      // 🟣 INSTAGRAM
      if (session.channel === 'INSTAGRAM') {
        const igConfig: any = await this.prisma['intInstagramConfig'].findFirst({
          where: { companyId: companyId, accessToken: { not: '' } }
        });
        if (igConfig) {
          await this.instagramService.replyMessage(igConfig.accessToken, session.senderId, dto.content, companyId);
        }
      }
    }

    // 4. อัปเดต updatedAt (ใช้ Index updatedAt_Desc เพื่อความเร็วในการจัดลำดับ Inbox)
    await this.prisma.intChatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() }
    });

    return message;
  }

  // ==========================================
  // 📋 2. ดึงรายการ Inbox สำหรับแอดมิน (หน้าบ้าน)
  // ==========================================
  async getActiveSessions(companyId: number) {
    return this.prisma.intChatSession.findMany({
      where: { companyId: companyId, status: 'OPEN' },
      orderBy: { updatedAt: 'desc' }, 
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // 🌟 ดึงแค่พรีวิวข้อความเดียวพอ ลดภาระ Database
        },
        _count: {
          select: {
            messages: { where: { senderType: 'CUSTOMER', isRead: false } }
          }
        }
      }
    });
  }

  // ==========================================
  // 💬 2.5 ดึงประวัติข้อความในแชท (เมื่อคลิกที่รายชื่อ)
  // ==========================================
 async getSessionMessages(companyId: number, sessionId: number) {
    const session = await this.prisma.intChatSession.findFirst({
      where: { id: sessionId, companyId: companyId }
    });
    if (!session) throw new NotFoundException('ไม่พบแฟ้มสนทนานี้');

    // 🌟 ดึงแค่ 50 ข้อความล่าสุดเพื่อให้หน้าจอโหลดติดทันที
    const messages = await this.prisma.intChatMessage.findMany({
      where: { sessionId: sessionId, companyId: companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    return messages.reverse(); // กลับด้านให้เรียงจากเก่าไปใหม่ตาม UI
  }

  // ==========================================
  // 👤 2.6 ดึงข้อมูลสมาชิกลูกค้า (CRM) จาก Session
  // ==========================================
  async getSessionMember(companyId: number, sessionId: number) {
    const session = await this.prisma.intChatSession.findUnique({
      where: { id: sessionId, companyId: companyId }
    });
    if (!session || !session.senderId) return null;

    if (session.channel === 'LINE') {
      const member = await this.prisma.crmMember.findFirst({
        where: { companyId: companyId, lineUserId: session.senderId }
      });
      return member || null;
    }
    return null; 
  }

  // ==========================================
  // 🤖 3. ฟังก์ชัน AI สรุปแชท (Chat Summarizer)
  // ==========================================
 async summarizeSession(companyId: number, sessionId: number) {
    const session = await this.prisma.intChatSession.findUnique({
      where: { id: sessionId, companyId: companyId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    if (!session || session.messages.length === 0) throw new NotFoundException('ไม่พบประวัติ');

    // Logic สรุปแชท (จำลอง)
    const updatedSession = await this.prisma.intChatSession.update({
      where: { id: sessionId },
      data: {
        aiSummary: "ลูกค้าสอบถามเรื่องสินค้าและบริการ",
        sentiment: "POSITIVE",
        intent: "INQUIRY",
      }
    });
    return updatedSession;
  }

  // ==========================================
  // 🗑️ 4. ฟังก์ชันยกเลิกข้อความ (Unsend Message)
  // ==========================================
  async unsendMessage(companyId: number, messageId: number) {
    // 1. ค้นหาข้อความว่ามีอยู่จริงไหม และเป็นของบริษัทนี้ไหม
    const message = await this.prisma.intChatMessage.findFirst({
      where: { 
        id: messageId,
        companyId: companyId 
      }
    });

    if (!message) {
      throw new NotFoundException('ไม่พบข้อความที่ต้องการยกเลิก หรือข้อความถูกลบไปแล้ว');
    }

    // 2. 🛡️ เช็คความปลอดภัย: อนุญาตให้ยกเลิกได้เฉพาะข้อความที่ "แอดมิน (AGENT)" หรือ "บอท (AI)" เป็นคนพิมพ์เท่านั้น
    if (message.senderType === 'CUSTOMER') {
      throw new BadRequestException('ไม่สามารถยกเลิกข้อความของลูกค้าได้');
    }

    // 3. สั่งลบข้อความ (Hard Delete)
    await this.prisma.intChatMessage.delete({
      where: { id: messageId }
    });

    this.logger.log(`[Chat] Message #${messageId} unsent by Agent in Company #${companyId}`);

    return { 
      success: true,
      message: 'ยกเลิกข้อความสำเร็จ', 
      deletedMessageId: messageId 
    };
  }

  // ==========================================
  // 👀 5. ฟังก์ชันเปลี่ยนสถานะเป็น "อ่านแล้ว" (Mark as Read)
  // ==========================================
  async markSessionAsRead(companyId: number, sessionId: number) {
    // อัปเดตข้อความของลูกค้าทุกอันในแฟ้มนี้ ที่ยังไม่ได้อ่าน ให้กลายเป็นอ่านแล้ว
    const result = await this.prisma.intChatMessage.updateMany({
      where: {
        sessionId: sessionId,
        companyId: companyId,
        senderType: 'CUSTOMER', // เปลี่ยนเฉพาะข้อความของลูกค้า
        isRead: false,
      },
      data: {
        isRead: true,
      }
    });

    return { 
      success: true, 
      message: 'อัปเดตสถานะเป็นอ่านแล้ว',
      updatedCount: result.count // บอกหน้าบ้านด้วยว่าเคลียร์ไปกี่ข้อความ
    };
  }
}