import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody, ApiTags, ApiOperation } from '@nestjs/swagger'; // 🌟 1. นำเข้า Swagger
import { SlipVerificationsService } from './slip-verifications.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { VerifySlipDto } from './dto/verify-slip.dto'; // 🌟 2. นำเข้า DTO ของเรา

@ApiTags('Integration - Slip Verifications') // 🌟 จัดหมวดหมู่ใน API Docs
@Controller('int/slip-verifications')
export class SlipVerificationsController {
  constructor(private readonly service: SlipVerificationsService) {}

  @Post('verify')
  @UseGuards(JwtAuthGuard) 
  @UseInterceptors(FileInterceptor('file')) 
  
  // ==========================================
  // 🌟 3. ส่วนตกแต่ง API Docs ให้ลูกค้าอ่านง่ายๆ
  // ==========================================
  @ApiOperation({ summary: 'ตรวจสอบความถูกต้องของสลิปโอนเงิน (ป้องกันสลิปปลอม/สลิปซ้ำ)' })
  @ApiConsumes('multipart/form-data') // บอกว่ารับข้อมูลแบบฟอร์มที่มีไฟล์
  @ApiBody({ type: VerifySlipDto })   // ผูก DTO เพื่อให้มีช่องกดอัปโหลดไฟล์โผล่ในหน้า Swagger
  
  async verifySlip(
    @Request() req,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('กรุณาแนบไฟล์สลิป (file) มาด้วย');
    }

    return this.service.verifySlip(
      req.user.companyId, 
      file.buffer, 
      'INTERNAL_ORDER'
    );
  }
}