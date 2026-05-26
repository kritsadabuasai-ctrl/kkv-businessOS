import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { GeographyService } from './geography.service';

@Controller('api/geography') // กำหนด Path หลัก
export class GeographyController {
  constructor(private readonly geographyService: GeographyService) {}

  // 📍 Endpoint 1: ดึงรายชื่อจังหวัดทั้งหมด
  // GET: /api/geography/provinces
  @Get('provinces')
  async getProvinces() {
    return this.geographyService.getProvinces();
  }

  // 📍 Endpoint 2: ดึงรายชื่ออำเภอ/ตำบล ตาม ID ที่ส่งมา
  // GET: /api/geography/:parentId/children
  @Get(':parentId/children')
  async getChildren(@Param('parentId', ParseIntPipe) parentId: number) {
    return this.geographyService.getChildrenByParentId(parentId);
  }
}