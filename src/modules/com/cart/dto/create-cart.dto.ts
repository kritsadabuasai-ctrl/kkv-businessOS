import { IsNumber, Min, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCartDto {
  @ApiProperty({ description: 'รหัสบริษัทแม่' })
  @IsNumber()
  companyId!: number;

  // 🌟 เพิ่มฟิลด์นี้เพื่อให้ Service เรียกใช้งานได้ครับ
  @ApiProperty({ description: 'รหัสร้านค้า (Shop) ที่กำลังสั่งซื้อ' })
  @IsNumber()
  shopId!: number;

  @ApiProperty({ description: 'รหัสสินค้า' })
  @IsNumber()
  productId!: number;

  @ApiProperty({ description: 'จำนวนสินค้า', default: 1 })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class UpdateCartDto {
  @ApiProperty({ description: 'จำนวนสินค้าที่ต้องการอัปเดต' })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class MergeCartItemDto {
  @ApiProperty({ description: 'รหัสบริษัทแม่' })
  @IsNumber()
  companyId!: number;

  @ApiProperty({ description: 'รหัสร้านค้า' })
  @IsNumber()
  shopId!: number;

  @ApiProperty({ description: 'รหัสสินค้า' })
  @IsNumber()
  productId!: number;

  @ApiProperty({ description: 'จำนวนสินค้า' })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class MergeCartDto {
  @ApiProperty({ type: [MergeCartItemDto], description: 'รายการสินค้าในตะกร้าจาก LocalStorage' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MergeCartItemDto)
  items!: MergeCartItemDto[];
}