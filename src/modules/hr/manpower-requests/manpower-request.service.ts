import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateManpowerRequestDto } from './dto/create-manpower-request.dto';
import { UpdateManpowerRequestDto } from './dto/update-manpower-request.dto';
import { WfRequestService } from '../../workflow/requests/wf-request.service';

@Injectable()
export class ManpowerRequestService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WfRequestService))
    private wfRequestService: WfRequestService,
  ) {}

  async create(companyId: number, dto: CreateManpowerRequestDto) {
    return this.prisma.hrManpowerRequest.create({
      data: {
        companyId,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        requestedCount: dto.requestedCount,
        reason: dto.reason,
      },
    });
  }

  async findAll(companyId: number) {
    return this.prisma.hrManpowerRequest.findMany({
      where: { companyId },
      include: { wfRequest: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(companyId: number, id: number) {
    const request = await this.prisma.hrManpowerRequest.findFirst({
      where: { id, companyId },
      include: { wfRequest: true }
    });
    if (!request) throw new NotFoundException('ไม่พบใบขออัตรากำลัง');
    return request;
  }

  async update(companyId: number, id: number, dto: UpdateManpowerRequestDto) {
    const request = await this.findOne(companyId, id);
    if (request.wfRequestId) throw new BadRequestException('ห้ามแก้เอกสารที่ส่งอนุมัติแล้ว');
    return this.prisma.hrManpowerRequest.update({
      where: { id },
      data: dto,
    });
  }

  async remove(companyId: number, id: number) {
    const request = await this.findOne(companyId, id);
    if (request.wfRequestId) throw new BadRequestException('ห้ามลบเอกสารที่ส่งอนุมัติแล้ว');
    return this.prisma.hrManpowerRequest.delete({ where: { id } });
  }

  // 🌟 [แก้ไข] รับ userId เพิ่มเข้ามา และสร้าง WfRequest ให้ถูกตาม Schema
  async submitToWorkflow(companyId: number, id: number, userId: number) {
    const request = await this.findOne(companyId, id);
    if (request.wfRequestId) throw new BadRequestException('ส่งไปแล้ว');

    // 1. ตรวจสอบก่อนว่าบริษัทนี้มีการตั้งค่า Workflow สำหรับ "การขอคน" หรือยัง
    // (ดึงจากตาราง WfModuleMapping ตามมาตรฐานระบบ KKV)
    const mapping = await this.prisma.wfModuleMapping.findFirst({
      where: { companyId, moduleCode: 'HR_MANPOWER' }
    });

    if (!mapping) {
      throw new BadRequestException('บริษัทของท่านยังไม่ได้ตั้งค่าสายอนุมัติ (Workflow) สำหรับการขออัตรากำลัง กรุณาให้ Admin ตั้งค่าในเมนู Workflow ก่อนครับ');
    }

    // 2. สร้างใบคำร้อง WfRequest (ใส่ข้อมูลครบตามที่ Schema บังคับ)
    const wfRequest = await this.prisma.wfRequest.create({
      data: {
        companyId,
        workflowId: mapping.workflowId,
        businessId: id.toString(),
        businessType: 'HR_MANPOWER',
        topic: `ขอเพิ่มอัตรากำลัง ${request.requestedCount} อัตรา`, // เปลี่ยนจาก title เป็น topic
        requesterId: userId,
        status: 'PENDING',
      }
    });

    // 3. ผูกรหัส Workflow กลับมาที่ใบขอคน
    return this.prisma.hrManpowerRequest.update({
      where: { id },
      data: { wfRequestId: wfRequest.id }
    });
  }

  async approveAndGenerateSeats(companyId: number, requestId: number) {
    const request = await this.findOne(companyId, requestId);

    const activeVersion = await this.prisma.hrOrgStructureVersion.findFirst({
      where: { companyId, status: 'PUBLISHED' },
      include: { 
        departments: { 
          where: { originalDeptId: request.departmentId },
          include: { positions: { where: { positionId: request.positionId } } }
        }
      }
    });

    const positionVerId = activeVersion?.departments[0]?.positions[0]?.id;

    if (!positionVerId) {
      throw new BadRequestException('ไม่พบตำแหน่งนี้ในผังองค์กรที่ประกาศใช้ปัจจุบัน ไม่สามารถสร้างเก้าอี้ได้');
    }

    const seats = Array.from({ length: request.requestedCount }).map(() => ({
      companyId,
      departmentId: request.departmentId,
      positionId: request.positionId,
      positionVerId: positionVerId,
      status: 'VACANT',
      seatNumber: `AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    }));

    return this.prisma.hrPositionSeat.createMany({ data: seats });
  }
}