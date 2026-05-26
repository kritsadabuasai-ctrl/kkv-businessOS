import { 
  Controller, Get, Post, Put, Delete, Body, Param, 
  UseGuards, Request, BadRequestException, Query 
} from '@nestjs/common';
import { AiBotsService } from './ai-bots.service';
import { AiRuntimeService } from './ai-runtime.service';
import { CreateAiBotDto, UpdateAiBotDto, UpdateQuotaDto } from './ai-bots.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
@Controller('int/ai-bots')
export class AiBotsController {
  constructor(
    private readonly service: AiBotsService,
    private readonly aiRuntime: AiRuntimeService,
  ) {}

  private extractId(idParam: string): number {
    const cleanId = parseInt(idParam.toString().split(':')[0], 10);
    if (isNaN(cleanId)) throw new BadRequestException('รูปแบบ ID ไม่ถูกต้อง');
    return cleanId;
  }

  @Post()
  @RequirePermissions('int:ai:create')
  create(
    @Request() req, 
    @Body() dto: CreateAiBotDto,
    @Query('companyId') queryCompanyId?: string
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.create(targetCompanyId, dto);
  }

  @Get()
  @RequirePermissions('int:ai:view')
  findAll(
    @Request() req,
    @Query('companyId') queryCompanyId?: string
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    
    // 🌟 ดึง userId จาก Token
    const userId = Number(req.user.userId || req.user.sub);

    // 🌟 โยน userId ให้ Service ไปจัดการต่อ
    return this.service.findAll(targetCompanyId, userId);
  }

  @Get('my-quota')
  @RequirePermissions('int:ai:view')
  getQuota(
    @Request() req,
    @Query('companyId') queryCompanyId?: string
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.getQuota(targetCompanyId);
  }

  @Get('available-models')
  @RequirePermissions('int:ai:view')
  getAvailableModels() {
    return this.service.getAvailableModels();
  }

  @Post('chat')
  @RequirePermissions('int:ai:view')
  async chat(
    @Request() req,
    @Body() dto: { botId: number; message: string; imageBase64?: string },
    @Query('companyId') queryCompanyId?: string
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    
    // 🌟 ดึงข้อมูลจาก Token เพื่อใช้เช็คสิทธิ์ RAG
    const userId = Number(req.user.userId || req.user.sub || req.user.id);
    const roleId = Number(req.user.roleId || 0);

    return this.aiRuntime.chat(
      dto.botId, 
      dto.message, 
      targetCompanyId, 
      dto.imageBase64,
      userId, // 👈 โยนไปให้ Service
      roleId  // 👈 โยนไปให้ Service
    );
  }

  @Post('chat/:code')
  @RequirePermissions('int:ai:view')
  async chatByCode(
    @Request() req,
    @Body() dto: { botCode: string; message: string; imageBase64?: string },
    @Query('companyId') queryCompanyId?: string
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    
    // 🌟 ดึงข้อมูลจาก Token เพื่อใช้เช็คสิทธิ์ RAG
    const userId = Number(req.user.userId || req.user.sub || req.user.id);
    const roleId = Number(req.user.roleId || 0);

    return this.aiRuntime.chatByCode(
      dto.botCode, 
      dto.message, 
      targetCompanyId, 
      dto.imageBase64,
      userId, // 👈 โยนไปให้ Service
      roleId  // 👈 โยนไปให้ Service
    );
  }

  @Get(':id')
  @RequirePermissions('int:ai:view')
  findOne(
    @Param('id') idParam: string, 
    @Request() req,
    @Query('companyId') queryCompanyId?: string
  ) { 
    const id = this.extractId(idParam);
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.findOne(id, targetCompanyId);
  }

  @Put(':id')
  @RequirePermissions('int:ai:update')
  update(
    @Param('id') idParam: string, 
    @Request() req, 
    @Body() dto: UpdateAiBotDto,
    @Query('companyId') queryCompanyId?: string
  ) {
    const id = this.extractId(idParam);
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    
    // 🌟 1. ดึง userId จาก Token ของคนที่ Login อยู่
    const userId = Number(req.user.userId || req.user.sub);

    // 🌟 2. โยน userId ไปให้ Service ทำหน้าที่เช็คสิทธิ์ HQ
    return this.service.update(id, targetCompanyId, dto, userId);
  }

 @Delete(':id')
  @RequirePermissions('int:ai:delete')
  remove(
    @Param('id') idParam: string, 
    @Request() req,
    @Query('companyId') queryCompanyId?: string
  ) { 
    const id = this.extractId(idParam);
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    
    // 🌟 1. ดึง userId จาก Token ของคนที่ Login อยู่
    const userId = Number(req.user.userId || req.user.sub);

    // 🌟 2. โยน userId ไปให้ Service เช็คสิทธิ์ในการลบ
    return this.service.remove(id, targetCompanyId, userId);
  }

  @Put('my-quota/update')
  @RequirePermissions('int:ai:update') 
  updateQuota(
    @Request() req, 
    @Body() dto: UpdateQuotaDto,
    @Query('companyId') queryCompanyId?: string
  ) {
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.updateQuota(targetCompanyId, dto);
  }

  // =========================================================
  // 🔄 รีเซ็ตบุคลิกบอทกลับเป็นค่าเริ่มต้นจากส่วนกลาง (HQ)
  // =========================================================
  @Put(':id/reset-default')
  @RequirePermissions('int:ai:update')
  resetToSystemDefault(
    @Param('id') idParam: string, 
    @Request() req,
    @Query('companyId') queryCompanyId?: string
  ) {
    const id = this.extractId(idParam);
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    
    // เรียกใช้ Service สำหรับคืนค่าบอท
    return this.service.resetToSystemDefault(id, targetCompanyId);
  }
}