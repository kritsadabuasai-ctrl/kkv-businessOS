// backend/src/modules/int/slip-verifications/dto/verify-slip.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class VerifySlipDto {
  // 🌟 ใช้สำหรับสร้างคู่มือ API ให้ลูกค้า (Swagger) เพื่อให้รู้ว่าช่องนี้ต้องแนบไฟล์
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'ไฟล์รูปภาพสลิปโอนเงิน (รองรับ .jpg, .jpeg, .png ขนาดไม่เกิน 5MB)',
  })
  file: any; 

  // 💡 โบนัส: ถ้าในอนาคตคุณกฤษฎาอยากให้ลูกค้าส่งข้อมูลอื่นมาพร้อมรูปด้วย
  // ก็สามารถเติมฟิลด์ลงไปตรงนี้ได้เลย เช่น
  // @ApiProperty({ description: 'รหัสอ้างอิงของระบบลูกค้า', required: false })
  // @IsOptional()
  // @IsString()
  // externalReferenceId?: string;
}