import { Controller, Post, Body, Req, UseGuards,Get } from '@nestjs/common';
import { RosterService } from './roster.service';
import { GenerateRosterDto } from './roster.dto';

// 🛡️ Import Guards & Decorators (ปรับ Path ให้ตรงกับโฟลเดอร์ของคุณกฤษฎานะครับ)
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { SubscriptionGuard } from '../../sec/auth/subscription.guard'; 
import { RequirePermissions } from '../../sec/auth/permissions.decorator'; 

@Controller('hr/rosters')
@UseGuards(JwtAuthGuard, SubscriptionGuard) // 🔒 ด่านที่ 1: ต้อง Log in เข้ามา และแพ็กเกจยังไม่หมดอายุ
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  @Post('generate')
  @RequirePermissions('hr:shift:create') // 🔒 ด่านที่ 2: ต้องมีสิทธิ์ในการสร้างตารางกะ
  async generateRoster(@Req() req, @Body() dto: GenerateRosterDto) {
    
    // 🎯 ตอนนี้ req.user จะเชื่อถือได้ 100% เพราะผ่าน JwtAuthGuard มาแล้ว
    // เราจึงดึง companyId จาก Token ได้เลย ไม่ต้องกลัวใครส่ง companyId ปลอมมา
    const companyId = req.user.companyId; 
    
    return await this.rosterService.generateRoster(companyId, dto);
  }
  
  // =========================================================
  // 🚩 2. เพิ่มส่วนนี้เข้าไป เพื่อเปิดรับการดึงข้อมูลไปแสดงที่ตาราง
  // =========================================================
  @Get()
  @RequirePermissions('hr:shift:view')  // เปิดไว้ถ้ามีสิทธิ์นี้ในระบบ หรือคอมเมนต์ไว้ก่อนก็ได้ครับ
  async findAll(@Req() req) {
    const companyId = req.user.companyId;
    return await this.rosterService.findAll(companyId);
  }
}