import { Controller, Post, Get, Put, Delete, Body, Param, ParseIntPipe, UseGuards, Req ,Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DocFolderService } from '../services/doc-folder.service';
import { CreateFolderDto } from '../dto/create-folder.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from  '../../sec/auth/subscription.guard'  
import { UpdateFolderDto } from '../dto/update-folder.dto';

@ApiTags('Document Folder')
@ApiBearerAuth() 
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) 
@Controller('doc-folder')
export class DocFolderController {
  constructor(private readonly folderService: DocFolderService) {}

  @ApiOperation({ summary: 'สร้างแฟ้มข้อมูลใหม่' })
  @RequirePermissions('document:create') 
  @Post()
  create(@Body() dto: CreateFolderDto, @Req() req: any) {
    // 🌟 ดึง userId จาก Token 
    const userId = req.user?.id || req.user?.userId;
    
    // 🌟 ส่ง userId เพิ่มเข้าไปใน Parameter ตัวที่ 2
    return this.folderService.createFolder(req.user.companyId, userId, dto);
  }

  @ApiOperation({ summary: 'ดึงโครงสร้างแฟ้มข้อมูลทั้งหมด (Tree)' })
  @RequirePermissions('document:view')
  @Get('tree')
  getTree(@Req() req: any) {
    const companyId = req.user.companyId;
    const roleId = req.user.roleId; 
    const isHQ = req.user.isHQ || false;
    const userId = req.user.id || req.user.userId; // 🌟 ดึง userId จาก Token
    
    // ส่งพารามิเตอร์ 4 ตัวตามลำดับ
    return this.folderService.getFolderTree(companyId, roleId, isHQ, userId);
  }

 @ApiOperation({ summary: 'แก้ไขข้อมูลแฟ้ม' })
  @RequirePermissions('document:update') // 🌟 1. เปลี่ยนจาก edit เป็น update ให้ตรงกับสิทธิ์มาตรฐาน
  @Patch(':id')
  updateFolder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFolderDto,
    @Req() req: any
  ) {
    const userId = req.user?.id || req.user?.userId;
    const roleId = Number(req.user?.roleId || 0); // 🌟 2. ดึง roleId ไปด้วยเพื่อเช็คสิทธิ์ผู้จัดการแฟ้ม
    
    // 🌟 3. เพิ่ม roleId เข้าไปใน Parameter ที่ส่งให้ Service
    return this.folderService.updateFolder(req.user?.companyId, id, userId, roleId, dto);
  }

  @ApiOperation({ summary: 'อัปเดตสิทธิ์การเข้าถึงแฟ้ม' })
  @RequirePermissions('document:update')
  @Put(':id/access')
  updateAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body('rules') rules: any[],
    @Req() req: any
  ) {
    // 🌟 ดึง userId, roleId ออกมาส่งให้ Service
    const userId = req.user?.id || req.user?.userId;
    const roleId = Number(req.user?.roleId || 0);

    return this.folderService.updateFolderAccess(req.user.companyId, id, userId, roleId, rules); 
  }

  // ==========================================
  // 🚚 [แก้ไขสำเร็จ] ปรับเพิ่ม Parameter ให้ครบตามสัญญาของ Service
  // ==========================================
  @ApiOperation({ summary: 'ย้ายโฟลเดอร์ไปยังตำแหน่งใหม่' })
  @RequirePermissions('document:update') // เช็กสิทธิ์ว่ามีสิทธิ์แก้ไขเอกสารหรือไม่
  @Put(':id/move')
  moveFolder(
    @Param('id', ParseIntPipe) id: number,
    @Body('newParentId') newParentId: number | null, // รับเป็น null ถ้าย้ายออกมาเป็นแฟ้มหลัก (Root)
    @Req() req: any
  ) {
    // 🌟 1. ดึง userId และ roleId จาก Token เหมือน Endpoint ตัวอื่น
    const userId = req.user?.id || req.user?.userId;
    const roleId = Number(req.user?.roleId || 0);

    // 🌟 2. ส่ง Arguments ไปประมวลผลให้ครบทั้ง 5 ตัว
    return this.folderService.moveFolder(req.user?.companyId, id, userId, roleId, newParentId);
  }

  @ApiOperation({ summary: 'ลบแฟ้มข้อมูล' })
  @RequirePermissions('document:delete')
  @Delete(':id')
  deleteFolder(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any
  ) {
    const userId = req.user?.id || req.user?.userId; 
    // 🌟 ดึง roleId จาก Token ตรงๆ
    const roleId = Number(req.user?.roleId || 0); 
    
    // ส่ง roleId เป็น Parameter ตัวที่ 4
    return this.folderService.deleteFolder(req.user?.companyId, id, userId, roleId);
  }
}