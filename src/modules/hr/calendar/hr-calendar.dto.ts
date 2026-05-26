import { IsString, IsNotEmpty, IsInt, IsEnum, IsDateString, IsBoolean, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { CalendarType, HolidayCategory } from '@prisma/client';

export class CreateHrCalendarDto {
  @IsString()
  @IsNotEmpty()
  name!: string; // 👈 เติม !

  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  year!: number; // 👈 เติม !

  @IsEnum(CalendarType)
  type!: CalendarType; // 👈 เติม !

  @IsDateString()
  @IsNotEmpty()
  startDate!: string; // 👈 เติม !

  @IsDateString()
  @IsNotEmpty()
  endDate!: string; // 👈 เติม !

  @IsString()
  @IsOptional()
  compensationRule?: string = 'NEXT_WORKING_DAY';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateHrCalendarDto extends CreateHrCalendarDto {}

export class CreateHrHolidayDto {
  @IsInt()
  @IsNotEmpty()
  calendarId!: number; // 👈 เติม !

  @IsDateString()
  @IsNotEmpty()
  date!: string; // 👈 เติม !

  @IsString()
  @IsNotEmpty()
  name!: string; // 👈 เติม !

  @IsEnum(HolidayCategory)
  @IsOptional()
  category?: HolidayCategory; // แบบ Optional (?) ไม่ต้องเติม ! ครับ

  @IsBoolean()
  @IsOptional()
  isCompensable?: boolean = true;

  @IsInt()
  @IsOptional()
  substitutionForId?: number;
}

export class UpdateHrHolidayDto {
  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(HolidayCategory)
  @IsOptional()
  category?: HolidayCategory;

  @IsBoolean()
  @IsOptional()
  isCompensable?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}