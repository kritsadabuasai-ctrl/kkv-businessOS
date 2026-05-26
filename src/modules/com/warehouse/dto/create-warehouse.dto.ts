import { IsString, IsOptional, IsBoolean, IsNotEmpty, IsInt, IsArray, ValidateNested ,ValidateIf } from 'class-validator';
import { Type, Transform } from 'class-transformer'; // ✨ 1. Import Transform เพิ่มตรงนี้

// 📄 DTO ย่อยสำหรับโครงสร้างข้อมูลไฟล์เอกสารแต่ละใบของคลังสินค้า
export class WarehouseDocumentDto {
  @IsInt()
  mediaId!: number;

  @IsOptional()
  @IsString()
  docType?: string;
}

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุชื่อคลังสินค้า' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุรหัสคลังสินค้า' })
  code!: string;

  @IsOptional()
  // ✨ 1. ถ้าส่งค่าว่างมา หรือเป็น null ให้ข้ามการเช็ก @IsInt ไปเลย!
  @ValidateIf((object, value) => value !== '' && value !== null)
  @Transform(({ value }) => (value === '' || value === null ? null : Number(value)))
  @IsInt()
  shopId?: number;

  @IsOptional()
  // ✨ 2. ถ้าส่งค่าว่างมา ให้ข้ามการเช็ก Type ไปเลย
  @ValidateIf((object, value) => value !== '' && value !== null)
  @Transform(({ value }) => (value === '' || value === null ? null : value))
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WarehouseDocumentDto)
  documents?: WarehouseDocumentDto[];
}