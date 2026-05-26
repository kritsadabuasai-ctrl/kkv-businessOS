import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDelegationDto, UpdateDelegationDto } from './sec-user-delegation.dto';

@Injectable()
export class SecUserDelegationService {
  constructor(private prisma: PrismaService) {}

  async create(ownerId: number, companyId: number, dto: CreateDelegationDto) {
    // 🌟 เช็คว่าเป้าหมายปลายทางไม่ใช่คนเดียวกันกับเจ้าของงาน (Owner ขอมอบหมายให้ตัว Owner เองไม่ได้)
    if (ownerId === dto.delegateUserId) {
      throw new BadRequestException('ไม่สามารถมอบหมายงานให้ตัวเองได้');
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น');
    }

    // 🛡️ 1. ตรวจสอบว่าผู้รับมอบหมาย (Delegatee) มีตัวตนอยู่จริง
    const delegateUser = await this.prisma.secUser.findUnique({
      where: { id: dto.delegateUserId },
      include: { roles: true }
    });

    if (!delegateUser) {
      throw new NotFoundException('ไม่พบพนักงานที่ต้องการมอบหมายในระบบ');
    }

    // 🛡️ 2. ป้องกัน Cross-tenant: เช็คว่าผู้รับมอบหมายมีบทบาทในบริษัทเดียวกันหรือไม่
    const isInSameCompany = delegateUser.roles.some(role => role.companyId === companyId);
    if (!isInSameCompany) {
       throw new ForbiddenException('ไม่สามารถมอบหมายงานให้พนักงานของบริษัทอื่นได้');
    }

    return this.prisma.secUserDelegation.create({
      data: {
        ownerUserId: ownerId,
        delegateUserId: dto.delegateUserId,
        startDate: start,
        endDate: end,
        reason: dto.reason,
      },
      include: {
        delegate: { select: { id: true, username: true, fullName: true } }
      }
    });
  }

  async getMyGivenDelegations(userId: number) {
    return this.prisma.secUserDelegation.findMany({
      where: { ownerUserId: userId },
      include: {
        delegate: { select: { id: true, username: true, fullName: true } }
      },
      orderBy: { startDate: 'desc' }
    });
  }

  async getMyReceivedDelegations(userId: number) {
    const now = new Date();
    return this.prisma.secUserDelegation.findMany({
      where: { 
        delegateUserId: userId,
        endDate: { gte: now }
      },
      include: {
        owner: { select: { id: true, username: true, fullName: true, avatarUrl: true } }
      },
      orderBy: { startDate: 'asc' }
    });
  }

  // Helper สำหรับดึงข้อมูลรายตัว
  async findOne(id: number) {
    const delegation = await this.prisma.secUserDelegation.findUnique({ where: { id } });
    if (!delegation) throw new NotFoundException('ไม่พบข้อมูลการมอบหมายนี้');
    return delegation;
  }

  // 🌟 ปรับเพิ่มพารามิเตอร์ roleId ในฟังก์ชัน update
  async update(id: number, ownerId: number, roleId: number, dto: UpdateDelegationDto) {
    const delegation = await this.findOne(id);
    
    // 🛡️ ตรวจสอบสิทธิ์: ต้องเป็นเจ้าของรายการเดิม คัดค้านทุกคนยกเว้นผู้ใช้ที่มี Role ID เป็น 1 (Admin)
    if (delegation.ownerUserId !== ownerId && roleId !== 1) {
      throw new ForbiddenException('คุณสามารถแก้ไขได้เฉพาะการมอบหมายของคุณเท่านั้น');
    }

    return this.prisma.secUserDelegation.update({
      where: { id },
      data: {
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        reason: dto.reason,
      },
    });
  }

  // 🌟 ปรับเพิ่มพารามิเตอร์ roleId ในฟังก์ชัน remove
  async remove(id: number, ownerId: number, roleId: number) {
    const delegation = await this.findOne(id);
    
    // 🛡️ ตรวจสอบสิทธิ์: ต้องเป็นเจ้าของรายการเดิม คัดค้านทุกคนยกเว้นผู้ใช้ที่มี Role ID เป็น 1 (Admin)
    if (delegation.ownerUserId !== ownerId && roleId !== 1) {
      throw new ForbiddenException('คุณสามารถลบได้เฉพาะการมอบหมายของคุณเท่านั้น');
    }
    
    return this.prisma.secUserDelegation.delete({ where: { id } });
  }
}