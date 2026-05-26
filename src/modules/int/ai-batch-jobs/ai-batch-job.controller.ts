import { Controller, Get, Post, Body, Param, ParseIntPipe, Request, UseGuards, Patch, Delete,Query } from '@nestjs/common';
import { AiBatchJobService } from './ai-batch-job.service';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { PermissionsGuard } from '../../sec/auth/permissions.guard';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';
import { CreateAiBatchJobDto } from './ai-batch-job.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard,SubscriptionGuard)
@Controller('int/ai-batch-jobs')
export class AiBatchJobController {
  constructor(private readonly service: AiBatchJobService) {}

  @Post()
  @RequirePermissions('int:ai-batch:create')
  create(@Request() req, @Body() dto: CreateAiBatchJobDto) {
    return this.service.createJob(req.user.companyId, dto);
  }

  @Get()
  @RequirePermissions('int:ai-batch:view')
  findAll(
    @Request() req,
    @Query('companyId') queryCompanyId?: string // 🌟 เปิดรับค่าจาก Dropdown
  ) {
    // 🌟 ดึงค่า Company ID จากที่หน้าบ้านส่งมา ถ้าไม่ส่งให้ใช้ของคนล็อกอิน
    const targetCompanyId = queryCompanyId ? parseInt(queryCompanyId) : req.user.companyId;
    return this.service.getCompanyJobs(targetCompanyId);
  }

  // ----------------------------------------------------
  // 🕹️ คอนโทรลควบคุมคิวงาน (Queue Management)
  // ----------------------------------------------------

  /**
   * 🛑 ยกเลิกคิวงาน
   */
  @Patch(':id/cancel')
  @RequirePermissions('int:ai-batch:delete')
  cancelJob(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.cancelJob(id, req.user.companyId);
  }

  /**
   * 🔄 สั่งประมวลผลใหม่ (กรณีเกิด Error)
   */
  @Patch(':id/retry')
  @RequirePermissions('int:ai-batch:create')
  retryJob(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.retryJob(id, req.user.companyId);
  }

  /**
   * ⏩ เลื่อนลำดับคิว
   * Body: { "position": "FRONT" | "BACK" }
   */
  @Patch(':id/reorder')
  @RequirePermissions('int:ai-batch:update')
  reorderJob(
    @Request() req, 
    @Param('id', ParseIntPipe) id: number,
    @Body('position') position: 'FRONT' | 'BACK'
  ) {
    return this.service.moveJobPriority(id, req.user.companyId, position);
  }

  /**
   * 🗑️ ลบประวัติการทำงานออกจากฐานข้อมูล
   */
  @Delete(':id')
  @RequirePermissions('int:ai-batch:delete')
  deleteJob(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteJob(id, req.user.companyId);
  }


  @Get('pre-calculate-tagging')
  async preCalculate(@Request() req, @Query('imageCount') imageCount: number) {
    const companyId = req.user.companyId;
    // เปลี่ยนจาก this.aiBatchJobService เป็น this.service ตาม constructor ของคุณ
    return await this.service.preCalculateImageTagging(companyId, Number(imageCount));
  }

}