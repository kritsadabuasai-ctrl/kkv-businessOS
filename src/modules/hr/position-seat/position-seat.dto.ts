import { IsString, IsInt, IsOptional, IsEnum } from 'class-validator';

// สมมติว่าสร้าง Enum มารองรับ Status
export enum SeatStatus {
  VACANT = 'VACANT',
  OCCUPIED = 'OCCUPIED',
  FROZEN = 'FROZEN',
}

export class CreatePositionSeatDto {
  @IsInt()
  @IsOptional()
  companyId?: number;

  @IsInt()
  positionVerId!: number; // ต้องผูกกับแผนก+ตำแหน่ง ในเวอร์ชันนั้นๆ

  @IsString()
  seatNumber!: string; // เช่น ว.1023
}

export class AssignSeatDto {
  @IsInt()
  employeeId!: number; // จับใครมานั่ง
}

export class UpdateSeatStatusDto {
  @IsEnum(SeatStatus)
  status!: SeatStatus; // เช่น สั่งแช่แข็งตำแหน่ง (FROZEN)
}