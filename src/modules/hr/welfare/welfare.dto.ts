import { IsString, IsOptional, IsInt, IsEnum, IsArray, IsDateString, IsDecimal, IsBoolean } from 'class-validator';
import { WelfareCategory, WelfareRequestStatus } from '@prisma/client';

// --- Master: ประเภทสวัสดิการ ---
export class CreateWelfareTypeDto {
  @IsString() code!: string; // [cite: 663]
  @IsString() name!: string; 
  @IsEnum(WelfareCategory) category!: WelfareCategory; // [cite: 662]
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isFamilyEligible?: boolean; // สิทธิ์เบิกให้ครอบครัว [cite: 664]
}

// --- Config: นโยบายวงเงินสวัสดิการประจำปี ---
export class CreateWelfarePolicyDto {
  @IsInt() welfareTypeId!: number; // [cite: 665]
  @IsInt() calendarYear!: number; // ปีที่บังคับใช้ [cite: 665]
  @IsOptional() @IsDecimal() maxAmountPerYear?: number; // [cite: 666]
  @IsOptional() @IsDecimal() maxAmountPerTime?: number;
  @IsOptional() @IsInt() maxTimesPerYear?: number; // [cite: 667]
  @IsOptional() @IsArray() @IsInt({ each: true }) eligibleLevels?: number[]; // ระดับพนักงานที่ได้สิทธิ์ [cite: 667]
}

// --- Transaction: การแจ้งเบิกสวัสดิการ ---
export class CreateWelfareRequestDto {
  @IsInt() policyId!: number; // [cite: 668]
  @IsInt() employeeId!: number; // [cite: 668]
  @IsOptional() @IsString() dependentName?: string; // [cite: 669]
  @IsOptional() @IsString() dependentRel?: string; // [cite: 670]
  @IsOptional() @IsString() receiptNo?: string; // [cite: 671]
  @IsOptional() @IsDateString() receiptDate?: string; 
  @IsDecimal() amountRequested!: number; // ยอดที่ขอเบิก [cite: 672]
  @IsOptional() @IsString() remark?: string;
  @IsArray() @IsString({ each: true }) documentUrls!: string[]; // ไฟล์แนบใบเสร็จ [cite: 673]
}

export class UpdateWelfareStatusDto {
  @IsEnum(WelfareRequestStatus) status!: WelfareRequestStatus; // [cite: 662]
}