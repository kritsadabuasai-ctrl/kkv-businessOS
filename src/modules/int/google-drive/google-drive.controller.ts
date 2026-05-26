import { 
  Controller, 
  Get, 
  Param, 
  Res, 
  UseGuards, 
  Request, 
  Query, 
  BadRequestException, 
  NotFoundException 
} from '@nestjs/common';
import type { Response } from 'express'; 
import { GoogleDriveService } from './google-drive.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard'; 
import { PermissionsGuard } from '../../sec/auth/permissions.guard'; // 🌟 1. นำเข้า PermissionsGuard
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { Public } from '../../sec/auth/public.decorator';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard) // 🔒 2. เพิ่ม PermissionsGuard เพื่อให้ยามตรวจสิทธิ์ทำงาน
@Controller('int/google-drive') // ✅ Route ถูกต้อง ไม่มี api/ ซ้อน
export class GoogleDriveController {
  constructor(private readonly service: GoogleDriveService) {}

  /**
   * 1. ดึงรายชื่อ Folder ย่อย (Step 1: เลือกหมวดหมู่)
   * 🎫 ต้องมีสิทธิ์: int:drive:view
   */
  @Get('folders/:folderId')
  @RequirePermissions('int:drive:view') // 👈 ตอนนี้ยามจะอ่านป้ายนี้แล้วครับ
  async listFolders(@Param('folderId') folderId: string, @Request() req) {
    return this.service.listSubfolders(req.user.companyId, folderId);
  }

  /**
   * 2. ดึงรูป/วิดีโอทั้งหมดใน Folder นั้นแบบเจาะลึก (Step 2: Recursive)
   * 🎫 ต้องมีสิทธิ์: int:drive:view
   */
  @Get('media/:folderId')
  @RequirePermissions('int:drive:view') // 👈 ปลอดภัย 100%
  async listMedia(@Param('folderId') folderId: string, @Request() req) {
    return this.service.listMediaInFolderRecursive(req.user.companyId, folderId);
  }

  /**
   * 3. Proxy Endpoint สำหรับแสดงรูป/วิดีโอ (ใช้กับ <img src="..." />)
   * 🔓 เปิด Public เพราะ Browser เรียกรูปโดยตรงจะไม่มี Header Token
   * (แต่มีความปลอดภัยระดับนึง เพราะต้องรู้ companyId ที่ถูกต้องถึงจะดูได้)
   */
  @Public() // ✅ 3. ป้าย VIP อนุญาตให้ดึงรูปไปโชว์หน้าเว็บได้โดยไม่ต้องมี Token
  @Get('proxy/:fileId')
  async proxyFile(
    @Param('fileId') fileId: string,
    @Query('cid') cid: string, 
    @Res() res: Response
  ) {
    const companyId = cid ? parseInt(cid) : 0;
    
    if (!companyId) {
       res.status(400).send('Company ID required');
       return;
    }

    try {
      // เรียก Service แบบ Stream เพื่อประหยัด RAM Server
      const stream = await this.service.getFileStream(companyId, fileId);
      stream.pipe(res);
    } catch (error) {
      res.status(404).send('Media not found or Access Denied');
    }
  }
}