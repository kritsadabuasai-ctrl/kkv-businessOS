// src/modules/rpt/rpt.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../sec/auth/jwt-auth.guard'; // ปรับ Path ตามจริง
import { DailySalesResponseDto, GetReportFilterDto, ProductPerformanceResponseDto } from './dto/get-report.dto';

@Controller('rpt')
@UseGuards(JwtAuthGuard)
export class RptController {
  
  @Get('daily-sales')
  getDailySales(@Query() filter: GetReportFilterDto): DailySalesResponseDto[] {
    // 💡 RETURN MOCK DATA (ส่งข้อมูลหลอกไปก่อน)
    return [
      { date: '2024-02-01', totalSales: 15000, totalOrders: 12 },
      { date: '2024-02-02', totalSales: 23500, totalOrders: 18 },
      { date: '2024-02-03', totalSales: 18200, totalOrders: 15 },
      { date: '2024-02-04', totalSales: 29000, totalOrders: 25 },
      { date: '2024-02-05', totalSales: 32000, totalOrders: 30 },
    ];
  }

  @Get('product-performance')
  getProductPerformance(@Query() filter: GetReportFilterDto): ProductPerformanceResponseDto[] {
    // 💡 RETURN MOCK DATA
    return [
      { productName: 'เสื้อยืด Cotton (ดำ)', totalSoldQty: 120, totalRevenue: 24000 },
      { productName: 'กางเกงยีนส์ Slim Fit', totalSoldQty: 85, totalRevenue: 42500 },
      { productName: 'หมวกแก๊ป', totalSoldQty: 45, totalRevenue: 11250 },
      { productName: 'ถุงเท้าข้อสั้น', totalSoldQty: 200, totalRevenue: 10000 },
      { productName: 'แจ็คเก็ตยีนส์', totalSoldQty: 30, totalRevenue: 27000 },
    ];
  }
}