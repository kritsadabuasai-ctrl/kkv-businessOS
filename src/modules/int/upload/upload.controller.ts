import { Controller, Post, UseInterceptors, UploadedFile, Query, BadRequestException, UseGuards, Request ,Logger, Inject, forwardRef } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { UploadService } from './upload.service'; 
import { StorageService } from '../../sys/storage/storage.service'; // ✅ Import StorageService (ปรับ Path ให้ตรงกับโปรเจกต์จริง)

// 🌟 1. Import MasterDataService เข้ามาใช้งาน
import { MasterDataService } from '../../cfg/master/data.service';

@Controller('int/upload')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);
  
  constructor(
    private readonly uploadService: UploadService,
    // 🌟 2. ครอบ StorageService ด้วย @Inject(forwardRef()) ตรงนี้ครับ!
    @Inject(forwardRef(() => StorageService))
    private readonly storageService: StorageService , // ✅ Inject เข้ามาใช้งาน
    // 🌟 2. Inject MasterDataService เข้ามา (Controller ไม่เกิดงูกินหางแน่นอน)
    private readonly masterDataService: MasterDataService
  ) {} 

 @Post()
  @RequirePermissions('media:create')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: string
  ) {
    if (!file) throw new BadRequestException('File is required');

    // =========================================================
    // 🛡️ ด่านที่ 1: ดักเช็กนามสกุลไฟล์จาก Master Data (Database-Driven)
    // =========================================================
    // แยกนามสกุลไฟล์ออกมาและทำเป็นตัวพิมพ์ใหญ่ (เช่น pdf -> PDF)
    const extMatch = file.originalname.match(/\.([^\.]+)$/);
    const fileExt = extMatch ? extMatch[1].toUpperCase() : '';

    if (!fileExt) {
      throw new BadRequestException('ไฟล์ที่อัปโหลดไม่พบสกุลไฟล์ที่ถูกต้อง');
    }

    // 🌟 วิ่งไปถาม Database ว่าอนุญาตหรือไม่ (หาของบริษัทก่อน ถ้าไม่เจอหาของส่วนกลาง)
    const isAllowed = await this.masterDataService.checkActiveExtension(req.user.companyId, fileExt);

    if (!isAllowed) {
      throw new BadRequestException(`ระบบไม่อนุญาตให้อัปโหลดไฟล์สกุล .${fileExt.toLowerCase()} กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดสิทธิ์การใช้งาน`);
    }
    // =========================================================

    // ตรวจสอบว่าเป็นรูปภาพหรือไม่ (กรณี type เป็น cms-image)
    if (type === 'cms-image' && !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('สำหรับการจัดการหน้าเว็บ (CMS) กรุณาอัปโหลดเฉพาะไฟล์รูปภาพเท่านั้น');
    }

    // แปลงชื่อไฟล์ที่เพี้ยน (Latin-1) ให้กลับเป็นภาษาไทย (UTF-8)
    if (file.originalname) {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    }

    const moduleType = type || 'general';

    // 1. นำไฟล์ขึ้น Google Cloud (ได้ URL กลับมา)
    const fileUrl = await this.uploadService.saveToCloud(file, req.user.companyId, moduleType);

    try {
      // 2. โยนให้ StorageService ตรวจสอบโควตา ตัดยอด และบันทึกลงสมุด (SysMedia)
      await this.storageService.deductQuota(req.user.companyId, fileUrl, file.size, moduleType);

      // 3. ถ้าตัดโควตาผ่านฉลุย ตอบกลับหน้าบ้านตามปกติ
      return { 
        url: fileUrl,
        size: file.size,
        type: moduleType
      };

    } catch (error : any) {
      // 4. ROLLBACK: ถ้า Error (เช่น โควตาเต็ม)
      this.logger.warn(`โควตาเต็มหรือมีปัญหา ลบไฟล์ทิ้งจาก GCS: ${fileUrl}`);
      await this.uploadService.deleteFromCloud(fileUrl);
      
      throw error; 
    }
  }
}