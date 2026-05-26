import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['APPROVED', 'REJECTED']) // บังคับให้ส่งเฉพาะสองสถานะนี้เท่านั้น
  status!: string;

  @IsString()
  @IsOptional()
  rejectReason?: string; // หากสถานะเป็น REJECTED แอดมินต้องระบุเหตุผลตัวนี้
}