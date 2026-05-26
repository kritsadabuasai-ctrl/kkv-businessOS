import { IsString, IsInt, IsOptional, IsBoolean } from 'class-validator';

export class CreateRewardDto {
  @IsInt()
  companyId!: number;

  // 🌟 บันทึก shopId (ถ้าไม่ส่งมา แปลว่าเป็นของรางวัลส่วนกลาง แลกได้ทุกสาขา)
  @IsOptional()
  @IsInt()
  shopId?: number;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // 🚩 [แก้ไข] เปลี่ยนจาก imageUrl สตริงเดิม ไปรับ mediaId เป็นตัวเลขเพื่อเชื่อมต่อกับระบบ DMS ปลายทาง
  @IsOptional()
  @IsInt()
  mediaId?: number;

  @IsInt()
  pointCost!: number;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsInt()
  discountTemplateId?: number;

  @IsOptional()
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsInt()
  stockQty?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}