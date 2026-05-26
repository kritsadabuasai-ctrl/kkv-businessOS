import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateAddressDto {
  @IsInt()
  @IsNotEmpty()
  memberId: number; // ✅ ต้องระบุเสมอว่าจะเพิ่มที่อยู่ให้สมาชิกคนไหน

  @IsString()
  @IsNotEmpty()
  type: string; // เช่น 'HOME', 'OFFICE'

  @IsString()
  @IsNotEmpty()
  address: string; // รายละเอียดที่อยู่ (Text Area)

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  zipcode?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean; // ตั้งเป็นที่อยู่หลักหรือไม่
}