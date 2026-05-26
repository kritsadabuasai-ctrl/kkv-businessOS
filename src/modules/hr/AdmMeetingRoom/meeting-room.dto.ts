import { IsString, IsOptional, IsInt, IsEnum, IsArray, IsDateString, IsBoolean, IsDecimal, IsEmail } from 'class-validator';
import { BookingStatus } from '@prisma/client';

// --- Master: ข้อมูลห้องประชุม ---
export class CreateRoomDto {
  @IsString() name!: string; // ชื่อห้องประชุม [cite: 652]
  @IsOptional() @IsString() location?: string; // ชั้น/ตึก [cite: 652]
  @IsInt() capacity!: number; // จำนวนที่นั่ง [cite: 652]
  @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[]; // รูปภาพห้อง 
  @IsOptional() @IsDecimal() basePrice?: number; // ราคาเช่า (ถ้ามี) 
  @IsOptional() @IsArray() @IsString({ each: true }) amenities?: string[]; // อุปกรณ์ 
  @IsOptional() @IsString() colorCode?: string; // สีใน Calendar [cite: 654]
}

// --- Transaction: การจองห้อง ---
export class CreateBookingDto {
  @IsInt() roomId!: number;
  @IsInt() requesterId!: number; // ผู้จอง [cite: 655]
  @IsString() subject!: string; // หัวข้อการประชุม [cite: 656]
  @IsOptional() @IsString() description?: string;
  @IsDateString() startDateTime!: string; // [cite: 656]
  @IsDateString() endDateTime!: string;
  @IsInt() participantCount!: number; // [cite: 657]
  @IsOptional() @IsBoolean() isExternalGuest?: boolean; // มีคนนอกไหม [cite: 657]
  @IsOptional() @IsString() cateringDetails?: string; // อาหารว่าง [cite: 657]
  
  @IsOptional() @IsArray()
  attendees?: {
    employeeId?: number; // คนในระบบ [cite: 660]
    externalName?: string; // คนนอก [cite: 661]
    externalEmail?: string;
  }[];
}

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus) status!: BookingStatus; // [cite: 651]
}