import { 
  Controller, Post, Get, Put, Delete, Body, Param, 
  ParseIntPipe, Query, UseGuards, Req, BadRequestException  ,Request ,UseInterceptors, UploadedFile
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DocFileService } from '../services/doc-file.service';


import { FileInterceptor } from '@nestjs/platform-express';

// DTOs
import { UploadFileDto } from '../dto/upload-file.dto';
import { CreateFileVersionDto } from '../dto/create-file-version.dto';
import { UpdateFileMetadataDto } from '../dto/update-file-metadata.dto';
import { CreateShareLinkDto } from '../dto/create-share-link.dto';
import { UnlockFileDto } from '../dto/unlock-file.dto'; 
import { UpdateFileAccessDto } from '../dto/update-file-access.dto';
import { CreateSignatureRequestDto } from '../dto/signature-request.dto';
// 🌟 [NEW] Import DTO สำหรับขอสิทธิ์เข้าถึงข้อมูล
import { CreateAccessRequestDto, AccessTargetType } from '../dto/create-access-request.dto'; 

import { Public } from '../../sec/auth/public.decorator';
import { Res } from '@nestjs/common';
import type { Response } from 'express';

// Guards & Decorators
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@ApiTags('Document File')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
@Controller('doc-file')
export class DocFileController {
  constructor(private readonly docFileService: DocFileService) {}

  // ==========================================
  // 1. จัดการไฟล์พื้นฐาน
  // ==========================================

  @ApiOperation({ summary: 'บันทึกข้อมูลไฟล์ที่อัปโหลดลงระบบ (Version 1)' })
  @RequirePermissions('document:create')
  @Post()
  async createFileRecord(@Body() dto: UploadFileDto, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.docFileService.createFileRecord(req.user.companyId, userId, dto);
  }

  @ApiOperation({ summary: 'ดาวน์โหลดเอกสารต้นฉบับ (ไม่มีลายน้ำ - เฉพาะผู้ได้รับอนุมัติชั่วคราว/แอดมิน)' })
  @RequirePermissions('document:view') // 🌟 ดักด่านแรกเพื่อความปลอดภัยระดับ Controller
  @Get(':id/download-original')
  async downloadOriginal(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.docFileService.downloadOriginalFile(
      req.user.companyId,
      id,
      req.user.id,
      req.user.roleId
    );

    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.fileName)}"`,
    });

    return result.fileStream;
  }

  @ApiOperation({ summary: 'ดึงรายการไฟล์ในโฟลเดอร์' })
  @RequirePermissions('document:view')
  @Get('list')
  getFilesByFolder(@Req() req: any, @Query('folderId') folderId?: string) {
    const parsedFolderId = folderId ? parseInt(folderId, 10) : undefined;
    // 🌟 ดึงข้อมูล User ปัจจุบันเพื่อไปเช็กสิทธิ์หน้า Root
    const userId = req.user?.id || req.user?.userId;
    const roleId = Number(req.user?.roleId || 0);
    return this.docFileService.getFilesByFolder(req.user.companyId, parsedFolderId, userId, roleId);
  }

  @ApiOperation({ summary: 'ปลดล็อกไฟล์ที่ใส่รหัสผ่านไว้เพื่อรับ URL จริง' })
  @RequirePermissions('document:view')
  @Post(':id/unlock')
  async unlockFileInternal(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UnlockFileDto,
    @Req() req: any
  ) {
    return this.docFileService.unlockFileInternal(req.user.companyId, id, dto);
  }

  // =========================================================
  // 🤖 🌟 AI Auto-Routing Endpoint
  // =========================================================
  @ApiOperation({ summary: 'ให้ AI ช่วยวิเคราะห์และย้ายไฟล์' })
  @RequirePermissions('document:update')
  @Post(':id/ai-route')
  async aiAutoRoute(
    @Param('id', ParseIntPipe) id: number,
    @Body('hint') hint: string,
    @Req() req: any
  ) {
    return this.docFileService.aiAutoRoute(req.user.companyId, id, hint);
  }

 @ApiOperation({ summary: 'ดูรายละเอียดไฟล์เอกสาร (แบบฝังลายน้ำ)' })
  @Get(':id/view')
  async viewFile(
    @Param('id', ParseIntPipe) id: number, 
    @Req() req: any,
    @Res({ passthrough: true }) res: Response // 🌟 1. เพิ่ม @Res เพื่อใช้จัดการ Header
  ) {
    const result = await this.docFileService.viewFile(
      req.user.companyId, 
      id, 
      req.user.id, 
      req.user.roleId
    );

    // 🌟 2. ตั้งค่า Header ให้เบราว์เซอร์เปิดแสดงผลแบบ PDF Inline บนหน้าเว็บ
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(result.fileName)}"`,
    });

    // 🌟 3. ส่งเฉพาะตัวสตรีมไฟล์ออกไป (ไม่ส่งก้อน JSON)
    return result.fileStream;
  }

  @ApiOperation({ summary: 'ดาวน์โหลดไฟล์เอกสาร (แบบฝังลายน้ำ)' })
  @Get(':id/download')
  async downloadFile(
    @Param('id', ParseIntPipe) id: number, 
    @Req() req: any,
    @Res({ passthrough: true }) res: Response // 🌟 1. เพิ่ม @Res เช่นกัน
  ) {
    const result = await this.docFileService.downloadFile(
      req.user.companyId, 
      id, 
      req.user.id, 
      req.user.roleId
    );

    // 🌟 2. ตั้งค่า Header เป็น attachment เพื่อบังคับให้ดาวน์โหลดลงเครื่องทันที
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.fileName)}"`,
    });

    return result.fileStream;
  }

@ApiOperation({ summary: 'ลบไฟล์เอกสาร (ล็อกถ้าอยู่ระหว่างอนุมัติ หรือเตะเข้าสายอนุมัติทำลาย)' })
  @RequirePermissions('document:delete')
  @Delete(':id')
  async deleteFile(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId; 
    
    // 🌟 ดึง roleId จาก Token (req.user) ตรงๆ โดยไม่ Bypass
    // ถ้าไม่มีค่าส่งมา จะใช้ 0 เป็น Default ซึ่งระบบ Service จะปฏิเสธการลบทันที
    const roleId = Number(req.user?.roleId || 0);

    return this.docFileService.deleteFile(
      id, 
      req.user.companyId, 
      userId, 
      roleId
    );
  }


  // ==========================================
  // 🛡️ [NEW] Endpoint สำหรับตรวจสอบความแท้จริงของเอกสาร (Tamper-Proof)
  // ==========================================
  @ApiOperation({ summary: 'ตรวจสอบความถูกต้องของไฟล์ PDF ว่าถูกดัดแปลงหรือไม่ (Tamper-Proof Check)' })
  @Post('verify-authenticity')
  @UseInterceptors(FileInterceptor('file')) // รับข้อมูลแบบ multipart/form-data โดยใช้ key ชื่อ 'file'
  async verifyDocumentAuthenticity(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File
  ) {
    // 1. ตรวจสอบว่ามีการแนบไฟล์มาหรือไม่
    if (!file) {
      throw new BadRequestException('กรุณาอัปโหลดไฟล์ PDF ที่ต้องการตรวจสอบ');
    }

    // 2. ส่ง Buffer ของไฟล์ไปให้ Service คำนวณ Hash และตรวจสอบ
    return this.docFileService.verifyDocumentAuthenticity(
      req.user.companyId, 
      file.buffer
    );
  }

  // ==========================================
  // 2. ระบบ Versioning & Metadata
  // ==========================================

  @ApiOperation({ summary: 'อัปโหลดเวอร์ชันใหม่ของเอกสาร (ต้องไม่ติด PENDING Workflow)' })
  @RequirePermissions('document:update')
  @Post(':id/version')
  async uploadNewVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFileVersionDto,
    @Req() req: any
  ) {
    const userId = req.user?.id || req.user?.userId;
    const payload = {
      url: dto.url,
      fileSize: BigInt(dto.fileSize),
      changeLog: dto.changeLog
    };
    return this.docFileService.uploadNewVersion(req.user.companyId, id, userId, payload);
  }

  @Put(':id/reset-password')
  @RequirePermissions('document:update')
  async resetPassword(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body('newPassword') newPassword?: string,
  ) {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.docFileService.resetFilePassword(companyId, id, userId, {
      newPassword,
      ipAddress,
      userAgent
    });
  }

  @ApiOperation({ summary: 'ดึงประวัติเวอร์ชันทั้งหมดของเอกสาร' })
  @RequirePermissions('document:view')
  @Get(':id/versions')
  async getVersionHistory(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.docFileService.getVersionHistory(req.user.companyId, id);
  }

  @ApiOperation({ summary: 'อัปเดตข้อมูล Metadata (Advanced Search Tags)' })
  @RequirePermissions('document:update')
  @Post(':id/metadata')
  async updateMetadata(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFileMetadataDto,
    @Req() req: any
  ) {
    return this.docFileService.updateMetadata(req.user.companyId, id, dto.metadata);
  }

  @ApiOperation({ summary: 'ดูรายการลายเซ็นและคำขอทั้งหมดของเอกสารนี้' })
  @RequirePermissions('document:view') // 🌟 เติมบรรทัดนี้
  @Get(':id/signatures')
  async getSignatures(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.docFileService.getSignatureRequests(req.user.companyId, id);
  }

  @ApiOperation({ summary: 'ตรวจสอบความถูกต้องของลายเซ็นและไฟล์ (Integrity Check)' })
  @RequirePermissions('document:view') // 🌟 เติมบรรทัดนี้
  @Get(':id/verify-integrity')
  async verifyIntegrity(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.docFileService.verifyFileIntegrity(req.user.companyId, id);
  }
  
  @ApiOperation({ summary: 'ย้ายไฟล์ไปยังโฟลเดอร์อื่น' })
  @RequirePermissions('document:update')
  @Put(':id/move')
  async moveFile(
    @Param('id', ParseIntPipe) id: number,
    @Body('newFolderId') newFolderId: number | null, 
    @Req() req: any
  ) {
    const userId = req.user?.id || req.user?.userId;
    // 🌟 ส่งครบ 5 ตัว: (companyId, fileId, userId, roleId, newFolderId)
    return this.docFileService.moveFile(
      req.user.companyId, 
      id, 
      userId, 
      req.user.roleId, // <--- เพิ่มตัวนี้เข้าไปครับ
      newFolderId
    );
  }
  
  // ==========================================
  // 3. ระบบ Workflow
  // ==========================================

  @ApiOperation({ summary: 'ส่งเอกสารเข้ากระบวนการอนุมัติ (Workflow)' })
  @RequirePermissions('document:update')
  @Post(':id/send-workflow')
  async sendToWorkflow(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any
  ) {
    const userId = req.user?.id || req.user?.userId;
    return this.docFileService.sendToWorkflow(req.user.companyId, id, userId);
  }

  // ==========================================
  // 4. ระบบ AI Integration (Sync Knowledge)
  // ==========================================

  @ApiOperation({ summary: 'ส่งเอกสารเข้าคิวประมวลผล AI Knowledge Base' })
  @RequirePermissions('document:update')
  @Post(':id/sync-ai')
  async syncToAi(
    @Param('id', ParseIntPipe) id: number, 
    @Query('processInQueue') processInQueue: boolean,
    @Req() req: any
  ) {
    return this.docFileService.syncToKnowledgeBase(req.user.companyId, id, processInQueue);
  }

  @ApiOperation({ summary: 'ประเมินจำนวน Token ก่อนส่งเข้า AI' })
  @RequirePermissions('document:view')
  @Get(':id/estimate-ai')
  async estimateAi(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.docFileService.estimateAiSync(req.user.companyId, id);
  }

  // ==========================================
  // 5. ระบบ Sharing & Access
  // ==========================================

  @ApiOperation({ summary: 'สร้างลิงก์แชร์เอกสารภายนอก' })
  @RequirePermissions('document:update')
  @Post(':id/share')
  async createShareLink(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateShareLinkDto,
    @Req() req: any
  ) {
    const userId = req.user?.id || req.user?.userId;
    dto.fileId = id; 
    return this.docFileService.createShareLink(req.user.companyId, userId, dto);
  }

  @Public()
  @ApiOperation({ summary: 'เข้าถึงไฟล์ผ่านลิงก์แชร์ (สำหรับบุคคลภายนอก)' })
  @Post('share/:token')
  async getFileByShareToken(
    @Param('token') token: string,
    @Body('password') password?: string 
  ) {
    return this.docFileService.getFileByShareToken(token, password);
  }

  @ApiOperation({ summary: 'สร้างคำขอเซ็นชื่อในเอกสาร (Signature Request)' })
  @RequirePermissions('document:update')
  @Post(':id/signature-request')
  async requestSignature(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSignatureRequestDto,
    @Req() req: any
  ) {
    return this.docFileService.createSignatureRequest(req.user.companyId, id, dto);
  }

  @ApiOperation({ summary: 'อัปเดตสิทธิ์การเข้าถึงไฟล์' })
  @RequirePermissions('document:update')
  @Put(':id/access')
  async updateFileAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFileAccessDto,
    @Req() req: any
  ) {
    // 🌟 ดึง userId, roleId ออกมาส่งให้ Service
    const userId = req.user?.id || req.user?.userId;
    const roleId = Number(req.user?.roleId || 0);

    return this.docFileService.updateFileAccess(req.user.companyId, id, userId, roleId, dto);
  }

 @ApiOperation({ summary: 'ใช้ AI วิเคราะห์และย้ายเอกสารเข้าโฟลเดอร์ที่เหมาะสม' })
  @RequirePermissions('document:update')
  @Post(':id/ai-classify')
  async aiClassifyFile(
    @Param('id', ParseIntPipe) id: number,
    @Body('hint') hint: string, // 🌟 เพิ่มการรับค่า hint จากหน้าบ้าน
    @Req() req: any
  ) {
    return this.docFileService.aiClassifyFileToFolder(req.user.companyId, id, hint);
  }

  // 🌟 [NEW] Endpoint สำหรับระบบขอสิทธิ์เข้าถึง (Access Request Workflow)
  @ApiOperation({ summary: 'ส่งคำขอสิทธิ์เข้าถึงไฟล์ (Data Access Request)' })
  @Post(':id/request-access')
  async requestFileAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAccessRequestDto,
    @Req() req: any
  ) {
    const userId = req.user?.id || req.user?.userId;
    
    // บังคับค่าให้ตรงกับไฟล์ที่กำลังขอ (ป้องกันหน้าบ้านส่งผิด)
    dto.targetId = id;
    dto.targetType = AccessTargetType.FILE; 

    return this.docFileService.requestFileAccess(req.user.companyId, userId, dto);
  }
}