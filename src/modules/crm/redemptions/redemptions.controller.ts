import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { RedemptionsService } from './redemptions.service';
import { CreateRedemptionDto } from './dto/create-redemption.dto'; 
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@Controller('crm/redemptions')
@UseGuards(JwtAuthGuard, PermissionsGuard, SubscriptionGuard) // 🛡️ บังคับล็อกอินและตรวจเช็คสิทธิ์ Multi-tenancy
export class RedemptionsController {
  constructor(private readonly redemptionsService: RedemptionsService) {}

  // =======================================================
  // 🛍️ API สำหรับลูกค้า / แอดมินสาขา (สร้างใบแลกของรางวัล)
  // =======================================================
  @Post()
  @RequirePermissions('redemption:update') // สิทธิ์ในการแก้ไขแต้ม/สต็อกสินค้า
  create(@Request() req, @Body() createRedemptionDto: CreateRedemptionDto) {
    // 🛡️ ล็อกรหัสบริษัทจาก Token ของผู้ใช้ ป้องกันการยิง API แอบอ้างข้ามบริษัท
    createRedemptionDto.companyId = req.user.companyId;

    // 🚩 [FIXED] แกะรหัสพนักงาน/ผู้ใช้งานจาก Token ส่งต่อไปให้ Service เพื่อบันทึกเป็นผู้สร้างคำร้องใน Workflow
    const userId = req.user.userId || req.user.id; 
    
    return this.redemptionsService.create(createRedemptionDto, userId);
  }

  // =======================================================
  // 🔍 API ดึงข้อมูลและประวัติการแลกของรางวัล
  // =======================================================
  
  // ค้นหาประวัติการแลกทั้งหมดภายใต้บริษัท (กรองตามสาขาได้)
  @Get()
  @RequirePermissions('redemption:view') 
  findAll(
    @Request() req, 
    @Query('shopId') shopId?: string
  ) {
    // ดึงข้อมูลบริษัทจาก Token ปลอดภัยที่สุด
    return this.redemptionsService.findAll(req.user.companyId, shopId ? parseInt(shopId, 10) : undefined);
  }

  // เรียกดูรายละเอียดใบแลกรางวัลรายการเดี่ยว (รวมรายละเอียดความคืบหน้าโอนด์ Workflow)
  @Get(':id')
  @RequirePermissions('redemption:view') 
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.redemptionsService.findOne(id);
  }

  // แอดมินอัปเดตสถานะตรง (กรณีออฟไลน์หรือหน้าเคาน์เตอร์แจกของเอง)
  @Patch(':id/status')
  @RequirePermissions('redemption:update') 
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string
  ) {
    return this.redemptionsService.updateStatus(id, status);
  }

  // ยกเลิกประวัติ/ลบรายการแลกของรางวัล
  @Delete(':id')
  @RequirePermissions('redemption:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.redemptionsService.remove(id);
  }
}