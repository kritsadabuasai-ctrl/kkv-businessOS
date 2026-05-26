import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateBankAccountDto {
  @IsInt()
  @IsNotEmpty()
  shopId: number; // ผูกกับร้านไหน

  @IsString()
  @IsNotEmpty()
  bankCode: string; // รหัสธนาคาร เช่น KBANK, SCB, BBL

  @IsString()
  @IsNotEmpty()
  bankName: string; // ชื่อธนาคาร เช่น กสิกรไทย

  @IsString()
  @IsNotEmpty()
  accountNo: string; // เลขบัญชี

  @IsString()
  @IsNotEmpty()
  accountName: string; // ชื่อบัญชี

  @IsString()
  @IsOptional()
  branch?: string; // สาขา (ถ้ามี)

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean; // เป็นบัญชีหลักที่โชว์ลูกค้าหรือไม่

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}