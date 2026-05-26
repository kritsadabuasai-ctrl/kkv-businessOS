// src/modules/rpt/dto/get-report.dto.ts
import { IsDateString, IsOptional, IsInt } from 'class-validator';

// Params สำหรับเรียกดูรายงาน (เช่น เลือกช่วงวันที่)
export class GetReportFilterDto {
  @IsOptional()
  @IsInt()
  shopId?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Response Structure (เพื่อให้ Loveable รู้ว่าข้อมูลหน้าตาแบบนี้)
export class DailySalesResponseDto {
  date!: string;
  totalSales!: number;
  totalOrders!: number;
}

export class ProductPerformanceResponseDto {
  productName!: string;
  totalSoldQty!: number;
  totalRevenue!: number;
}