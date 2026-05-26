import { IsString, IsInt, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class GenerateRosterDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @IsNotEmpty()
  patternId!: number;

  @IsInt()
  @IsOptional()
  holidayGroupId?: number;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsInt()
  @IsNotEmpty()
  startDayIndex!: number; // 🚩 ตัวกำหนดจุดสตาร์ท (Offset)
}