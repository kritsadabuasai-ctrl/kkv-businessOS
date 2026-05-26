import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCourseDto, CreateSessionDto, EnrollEmployeeDto, UpdateResultDto } from './training.dto';
import { WfRequestService } from '../../workflow/requests/wf-request.service';
import { TrainingSessionStatus, EnrollmentStatus, HrTrainingEnrollment } from '@prisma/client';

@Injectable()
export class TrainingService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WfRequestService))
    private wfRequestService: WfRequestService
  ) {}

  // --- Master: Course Management ---
  async createCourse(companyId: number, dto: CreateCourseDto) {
    return this.prisma.hrTrainingCourse.create({
      data: { ...dto, companyId } 
    });
  }

  async findAllCourses(companyId: number) {
    return this.prisma.hrTrainingCourse.findMany({
      where: { companyId, isActive: true } 
    });
  }

  // --- Transaction: Session Management (เปิดคลาสเรียน) ---
  async createSession(companyId: number, userId: number, dto: CreateSessionDto) {
    // 1. สร้าง Session เป็นสถานะ PLANNING รอไว้ก่อน
    const session = await this.prisma.hrTrainingSession.create({
      data: {
        ...dto,
        companyId, 
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: TrainingSessionStatus.PLANNING 
      }
    });

    // 2. ตรวจสอบว่ามีการผูก Workflow สำหรับการเปิดคลาสไว้หรือไม่
    const mapping = await this.prisma.wfModuleMapping.findFirst({
      where: { companyId, moduleCode: 'HR_TRAINING_SESSION', isActive: true }
    });

    if (mapping) {
      await this.wfRequestService.create(companyId, userId, {
        moduleCode: 'HR_TRAINING_SESSION',
        workflowId: mapping.workflowId,
        businessId: String(session.id),
        topic: `ขออนุมัติจัดอบรม/เปิดคลาส: ${dto.batchName}`,
      } as any);
      
      return { ...session, message: 'สร้างคลาสเรียนและส่งคำขออนุมัติเปิดคลาสเรียบร้อยแล้ว' };
    }

    // 🌟 [แก้ Error] ถ้าไม่มี Workflow ให้ใช้สถานะ PUBLISHED (ประกาศแล้ว) แทน OPEN
    await this.prisma.hrTrainingSession.update({
      where: { id: session.id },
      data: { status: TrainingSessionStatus.PUBLISHED }
    });

    return { ...session, status: TrainingSessionStatus.PUBLISHED, message: 'สร้างและเปิดคลาสเรียนเรียบร้อยแล้ว' };
  }

  async findSessions(companyId: number, year: number) {
    return this.prisma.hrTrainingSession.findMany({
      where: { companyId, calendarYear: year }, 
      include: { course: true, _count: { select: { enrollments: true } } }
    });
  }

  // --- Transaction: Enrollment Management (ลงทะเบียนเรียน) ---
  async enrollEmployees(companyId: number, userId: number, dto: EnrollEmployeeDto) {
    const mapping = await this.prisma.wfModuleMapping.findFirst({
      where: { companyId, moduleCode: 'HR_TRAINING_ENROLL', isActive: true }
    });

    const results: HrTrainingEnrollment[] = [];

    for (const empId of dto.employeeIds) {
      const existing = await this.prisma.hrTrainingEnrollment.findFirst({
        where: { companyId, sessionId: dto.sessionId, employeeId: empId }
      });

      if (existing) continue; 

      const enrollment = await this.prisma.hrTrainingEnrollment.create({
        data: {
          companyId, 
          sessionId: dto.sessionId, 
          employeeId: empId, 
          // 🌟 [แก้ Error] ตอนนี้มี EnrollmentStatus.PENDING ให้ใช้แล้วใน Prisma
          status: mapping ? EnrollmentStatus.PENDING : EnrollmentStatus.REGISTERED 
        }
      });

      if (mapping) {
        const emp = await this.prisma.hrEmployee.findUnique({ where: { id: empId } });
        const empName = emp ? `${emp.firstName} ${emp.lastName}` : `รหัส ${empId}`;

        await this.wfRequestService.create(companyId, userId, {
          moduleCode: 'HR_TRAINING_ENROLL',
          workflowId: mapping.workflowId,
          businessId: String(enrollment.id),
          topic: `ขออนุมัติพนักงานเข้ารับการอบรม: คุณ ${empName}`,
        } as any);
      }

      results.push(enrollment);
    }

    return { 
      message: mapping ? 'ส่งคำขออนุมัติเข้าอบรมเรียบร้อยแล้ว' : 'ลงทะเบียนสำเร็จ',
      enrolledCount: results.length 
    };
  }
}