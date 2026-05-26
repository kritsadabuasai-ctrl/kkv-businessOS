import { Controller, Get, Post,Delete,Patch , Param, Body, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './chat.dto';

// 🛡️ Import 3 ทหารเสือสำหรับจัดการสิทธิ์
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('int/chat')
@UseGuards(JwtAuthGuard, PermissionsGuard ,SubscriptionGuard) // 🛡️ ทหารเสือคนที่ 1 & 2: บังคับล็อกอิน + เปิดโหมดตรวจสิทธิ์ทั้ง Controller
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ==========================================
  // 📥 1. ดึงรายการแชท (Inbox) ที่เปิดอยู่ทั้งหมด
  // ==========================================
  @Get('sessions')
  @RequirePermissions('chat:view') // 🛡️ ทหารเสือคนที่ 3: ต้องมีสิทธิ์ "ดูแชท" เท่านั้น
  async getSessions(@Req() req: any) {
    const companyId = req.user.companyId;
    return this.chatService.getActiveSessions(companyId);
  }

  // ==========================================
  // 📥 1.5 ดึงประวัติข้อความของแชทที่เลือก
  // ==========================================
  @Get('sessions/:id/messages')
  @RequirePermissions('chat:view') 
  async getSessionMessages(
    @Req() req: any, 
    @Param('id', ParseIntPipe) sessionId: number
  ) {
    const companyId = req.user.companyId;
    return this.chatService.getSessionMessages(companyId, sessionId);
  }

  // ==========================================
  // 👤 1.6 ดึงข้อมูลสมาชิก (CRM) ของแชทที่เลือก
  // ==========================================
  @Get('sessions/:id/member')
  @RequirePermissions('chat:view')
  async getSessionMember(
    @Req() req: any,
    @Param('id', ParseIntPipe) sessionId: number
  ) {
    const companyId = req.user.companyId;
    return this.chatService.getSessionMember(companyId, sessionId);
  }

  // ==========================================
  // 💬 2. แอดมินพิมพ์ตอบลูกค้า (ส่งข้อความ)
  // ==========================================
  @Post('messages')
  @RequirePermissions('chat:create') // 🛡️ ทหารเสือคนที่ 3: ต้องมีสิทธิ์ "ตอบแชท" เท่านั้น
  async sendMessage(@Req() req: any, @Body() dto: SendMessageDto) {
    const companyId = req.user.companyId;
    return this.chatService.handleIncomingMessage(companyId, dto);
  }

  // ==========================================
  // 🤖 3. กดปุ่มให้ AI สรุปแฟ้มแชทนี้
  // ==========================================
  @Post('sessions/:id/summarize')
  @RequirePermissions('chat:view') // 🛡️ ทหารเสือคนที่ 3: ต้องมีสิทธิ์ "สรุปแชทด้วย AI" (ป้องกันคนกดเล่นเปลืองโควตา)
  async summarizeChat(
    @Req() req: any, 
    @Param('id', ParseIntPipe) sessionId: number
  ) {
    const companyId = req.user.companyId;
    return this.chatService.summarizeSession(companyId, sessionId);
  }

  // ==========================================
  // 🗑️ 4. แอดมินกดยกเลิกข้อความ (Unsend)
  // ==========================================
  @Delete('messages/:id')
  @RequirePermissions('chat:delete') // 🛡️ สิทธิ์ในการลบข้อความ
  async unsendMessage(
    @Req() req: any, 
    @Param('id', ParseIntPipe) messageId: number
  ) {
    const companyId = req.user.companyId;
    return this.chatService.unsendMessage(companyId, messageId);
  }

  // ==========================================
  // 👀 5. แอดมินกดเปิดแชทอ่าน (Mark as Read)
  // ==========================================
  @Patch('sessions/:id/read')
  @RequirePermissions('chat:view') // 🛡️ แค่มีสิทธิ์ดูก็สามารถกดให้มันกลายเป็นอ่านแล้วได้
  async markAsRead(
    @Req() req: any, 
    @Param('id', ParseIntPipe) sessionId: number
  ) {
    const companyId = req.user.companyId;
    return this.chatService.markSessionAsRead(companyId, sessionId);
  }
}