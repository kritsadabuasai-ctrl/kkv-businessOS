import { Controller, Post, Body, UseGuards, Request, Param, Patch ,Delete ,Get,Put, Query, BadRequestException } from '@nestjs/common';
import { OrgStructureVersionService } from './org-structure-version.service';
import { CreateOrgVersionDto } from './dto/create-org-version.dto';
import { SaveOrgTreeDto } from './dto/save-org-tree.dto';
import { JwtAuthGuard } from '../../sec/auth/jwt-auth.guard';
import { RequirePermissions } from '../../sec/auth/permissions.decorator';
import { SubscriptionGuard } from '../../sec/auth/subscription.guard';

@UseGuards(JwtAuthGuard, SubscriptionGuard) // 🛡️ ทหารเสือคนที่ 1 (Login) & คนที่ 2 (Module Active)
@Controller('hr/org-structure-versions')
export class OrgStructureVersionController {
  constructor(private readonly orgVersionService: OrgStructureVersionService) {}

  @Post()
  @RequirePermissions('org_structure:create') // 🛡️ ทหารเสือคนที่ 3 (Permission)
  create(@Request() req, @Body() createDto: CreateOrgVersionDto) {
    // 🛡️ ทหารเสือคนที่ 4 (Company Data Isolation) ผ่าน req.user.companyId
    return this.orgVersionService.createDraftVersion(req.user.companyId, createDto);
  }

  // 🌟 ดึงรายการ Version สำหรับ Dropdown
  // GET /api/hr/org-structure-versions?calendarId=5
  @Get()
  @RequirePermissions('org_structure:view')
  findAll(@Request() req, @Query('calendarId') calendarId: string) {
    if (!calendarId) {
      throw new BadRequestException('กรุณาระบุ calendarId');
    }
    return this.orgVersionService.findAllVersions(req.user.companyId, +calendarId);
  }

  @Post(':id/copy')
  @RequirePermissions('org_structure:create')
  copyStructure(
    @Request() req, 
    @Param('id') sourceId: string, 
    @Body() body: { calendarId: number, name: string }
  ) {
    return this.orgVersionService.copyStructureToNewVersion(
      req.user.companyId, 
      +sourceId, 
      body.calendarId,
      body.name
    );
  }

  // ในไฟล์ที่เกี่ยวข้องกับ Controller

@Get('current-manpower-dashboard')
@RequirePermissions('org_structure:view')
async getCurrentManpowerDashboard(@Request() req) {
  const companyId = req.user.companyId;

  // 1. หาโครงสร้างที่ประกาศใช้ (Published) ล่าสุด ณ วันนี้
  const activeStructure = await this.orgVersionService.getActiveStructureByDate(companyId);
  
  if (!activeStructure || activeStructure.length === 0) {
    return []; 
  }

  // 2. ดึงสรุปข้อมูลตามเวอร์ชันที่พบ (ดึงจากชิ้นแรกเพราะทุกชิ้นในเวอร์ชันเดียวกันจะมี versionId เหมือนกัน)
  const versionId = (activeStructure[0] as any).versionId; 
  
  if (versionId) {
     return this.orgVersionService.getManpowerSummary(companyId, versionId);
  } else {
     // กรณีเป็นข้อมูล Master เปล่าๆ ที่ยังไม่มีการ Publish
     return activeStructure;
  }
}

  // 🌟 ดึงโครงสร้างแผนกและตำแหน่งที่ "ใช้งานจริง" ณ วันที่ระบุ (สำหรับหน้าฟอร์มต่างๆ)
  // รูปแบบการเรียก: GET /api/hr/org-structure-versions/active-structure?effectiveDate=2026-08-01
  @Get('active-structure')
  @RequirePermissions('org_structure:view') // เช็คสิทธิ์ตามความเหมาะสม (อาจใช้ 'employee:view' ก็ได้)
  getActiveStructure(@Request() req, @Query('effectiveDate') effectiveDate?: string) {
    return this.orgVersionService.getActiveStructureByDate(req.user.companyId, effectiveDate);
  }

  // ✅ เปลี่ยนจากประกาศใช้ทันที เป็นส่งคำร้องเข้า Workflow
  @Patch(':id/request-publish')
  @RequirePermissions('org_structure:update') 
  requestPublish(@Request() req, @Param('id') versionId: string) {
    // 🌟 ส่ง req.user.id ไปด้วยเพื่อให้ระบบ Workflow รู้ว่าใครเป็นคนกดตั้งเรื่องขออนุมัติ
    return this.orgVersionService.requestPublishWorkflow(
      req.user.companyId, 
      +versionId, 
      req.user.id
    );
  }

  // ✅ ฟังก์ชันที่เพิ่มใหม่: ลบโครงสร้างองค์กร (Draft)
  @Delete(':id')
  @RequirePermissions('org_structure:delete') // 👈 ทหารเสือตรวจสิทธิ์การลบ
  deleteDraft(@Request() req, @Param('id') versionId: string) {
    return this.orgVersionService.deleteDraftVersion(req.user.companyId, +versionId);
  }

  // 🌟 ดึงข้อมูลผัง Draft ไปแสดงบนจอ
  @Get(':id/tree')
  @RequirePermissions('org_structure:view')
  getTree(@Request() req, @Param('id') versionId: string) {
    return this.orgVersionService.getDraftTree(req.user.companyId, +versionId);
  }

  // 🌟 กด Save Draft เพื่อบันทึกต้นไม้
  @Put(':id/tree')
  @RequirePermissions('org_structure:update')
  saveTree(@Request() req, @Param('id') versionId: string, @Body() dto: SaveOrgTreeDto) {
    return this.orgVersionService.saveDraftTree(req.user.companyId, +versionId, dto);
  }

  @Get(':id/manpower-summary')
  @RequirePermissions('org_structure:view')
  getManpowerSummary(@Request() req, @Param('id') versionId: string) {
    return this.orgVersionService.getManpowerSummary(req.user.companyId, +versionId);
  }

  @Put(':versionId/departments/:deptId/positions')
  @RequirePermissions('org_structure:update')
  async updateDepartmentPositions(
    @Request() req,
    @Param('versionId') versionId: string,
    @Param('deptId') deptId: string,
    @Body() dto: { positions: { positionId: number, maxHeadcount?: number }[] }
  ) {
    return this.orgVersionService.updateDraftDepartmentPositions(
      req.user.companyId,
      +versionId,
      +deptId,
      dto.positions || []
    );
  }
}