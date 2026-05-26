import { IsArray, IsNumber, IsOptional, IsString, ValidateNested, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// 1. DTO สำหรับตำแหน่ง (Positions) ที่อยู่ในแผนก
export class PositionItemDto {
  @ApiProperty()
  @IsNumber()
  positionId!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxHeadcount?: number;
}

// 2. DTO สำหรับโครงสร้างแผนก (Department Node)
export class DepartmentNodeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  originalDeptId?: number;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  parentId?: string | number; // รองรับทั้ง String และ Number

  @ApiProperty()
  @IsDefined()
  refId!: string | number; // รองรับทั้ง String และ Number

  @ApiProperty({ type: [PositionItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionItemDto)
  positions?: PositionItemDto[];
}

// 3. DTO หลักที่รับ Request เข้ามา
export class SaveOrgTreeDto {
  @ApiProperty({ type: [DepartmentNodeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentNodeDto)
  departments!: DepartmentNodeDto[];
}