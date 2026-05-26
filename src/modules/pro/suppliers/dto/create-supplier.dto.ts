import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsEmail } from 'class-validator';

export class CreateSupplierDto {
  @IsInt()
  @IsOptional()
  companyId?: number; // Controller จะเป็นคนใส่ให้

  @IsString()
  @IsNotEmpty()
  code!: string; // รหัสคู่ค้า เช่น "SUP-001"

  @IsString()
  @IsNotEmpty()
  name!: string; // ชื่อบริษัท/ร้านค้า

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  contactName?: string; // ชื่อผู้ติดต่อ

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsInt()
  @IsOptional()
  creditTerm?: number; // เครดิต (วัน) Default = 0 (เงินสด)

  @IsString()
  @IsOptional()
  currency?: string; // สกุลเงินที่ซื้อขายกันประจำ (Default 'THB')

  @IsString()
  @IsOptional()
  type?: string; // ประเภท เช่น 'LOCAL', 'IMPORT'

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}