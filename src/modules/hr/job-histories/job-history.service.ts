import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateJobHistoryDto, UpdateJobHistoryDto ,AssignManagerDto } from './job-history.dto';

@Injectable()
export class JobHistoryService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 1. สร้างประวัติการทำงานใหม่ (Promote / Transfer)
  // =========================================================
  async createJobHistory(companyId: number, dto: CreateJobHistoryDto, isMigration: boolean = false) {
    const employee = await this.prisma.hrEmployee.findFirst({
      where: { id: dto.employeeId, companyId }
    });
    
    if (!employee) {
      throw new NotFoundException(`ไม่พบข้อมูลพนักงาน ID: ${dto.employeeId} ในระบบ`);
    }

    // 1. ดักเช็คโครงสร้างแผนกและตำแหน่ง (ข้ามได้ถ้าเป็น isMigration = true)
    if (!isMigration) {
       await this.validateDepartmentPosition(
         companyId, 
         dto.departmentId, 
         dto.positionId,
         'EFFECTIVE', 
         undefined,
         dto.employeeId
       );
    }

    // 2. คำนวณสถานะจากวันที่ (Effective Date Logic)
    const startDate = new Date(dto.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startCompare = new Date(startDate);
    startCompare.setHours(0, 0, 0, 0);

    // ถ้าเริ่มงานในอนาคต ให้เป็น PENDING (รอ Cron Job มาจัดการ)
    const status = startCompare > today ? 'PENDING' : 'EFFECTIVE';
    const targetManagerId = dto.managerId !== undefined ? dto.managerId : employee.managerId;

    // 🌟 3. ใช้ Transaction เพื่อให้มั่นใจว่าข้อมูล History และ Master จะถูกอัปเดตไปพร้อมกัน
    return this.prisma.$transaction(async (tx) => {
      // 3.1 บันทึกข้อมูลลงตารางประวัติ (JobHistory)
      const history = await tx.hrJobHistory.create({
        data: {
          companyId,
          employeeId: dto.employeeId,
          departmentId: dto.departmentId as number, 
          positionId: dto.positionId as number,
          managerId: targetManagerId,
          action: dto.action,
          
          status: status as any, 
          startDate: startDate,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          remarks: dto.remarks || null,
        },
        include: {
          department: true,
          position: true,
          manager: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true }
          },
          employee: {
            select: { firstName: true, lastName: true, employeeCode: true }
          }
        }
      });

      // 🌟 3.2 ถ้ามีผลทันที (EFFECTIVE) ให้อัปเดตข้อมูลในตารางพนักงานหลักด้วย!
      if (status === 'EFFECTIVE') {
        await tx.hrEmployee.update({
          where: { id: dto.employeeId },
          data: {
            hrDepartmentId: dto.departmentId,
            positionId: dto.positionId,
            managerId: targetManagerId
          }
        });
      }

      return history;
    });
  }

  // =========================================================
  // 2. ดึงประวัติทั้งหมดของพนักงาน (By Employee)
  // =========================================================
  async getByEmployee(companyId: number, employeeId: number) {
    // 1. ตรวจสอบสิทธิ์ว่าพนักงานอยู่ในบริษัทนี้จริงหรือไม่
    const employee = await this.prisma.hrEmployee.findFirst({ 
      where: { id: employeeId, companyId } 
    });
    
    if (!employee) throw new NotFoundException(`Employee ID ${employeeId} not found`);

    // 2. ดึงรายการประวัติทั้งหมดพร้อมข้อมูลตำแหน่ง แผนก และ "หัวหน้าในขณะนั้น"
    return this.prisma.hrJobHistory.findMany({
      where: { employeeId },
      include: {
        department: { 
          select: { id: true, name: true, code: true } 
        },
        position: { 
          select: { id: true, name: true, code: true } 
        },
        // 🌟 เพิ่ม: ดึงข้อมูลหัวหน้างานในประวัติแต่ละช่วง
        manager: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            nickName: true
          }
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  // =========================================================
  // ✅ 3. (เพิ่มใหม่) ดึงประวัติการโยกย้ายทั้งหมดของบริษัท
  // =========================================================
  async getAllHistories(companyId: number) {
    return this.prisma.hrJobHistory.findMany({
      where: { 
        employee: { companyId } 
      },
      include: {
        employee: {
            select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                status: true
            }
        },
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
        // 🌟 เพิ่ม: ดึงข้อมูลหัวหน้างานในแต่ละช่วงประวัติออกมาด้วย
        manager: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            nickName: true
          }
        }
      },
      orderBy: { startDate: 'desc' },
    });
  }

  // =========================================================
  // 4. ดึงรายละเอียดราย ID
  // =========================================================
  async getById(companyId: number, id: number) {
    const history = await this.prisma.hrJobHistory.findUnique({
      where: { id , companyId },
      include: {
        department: true,
        position: true,
        // 🌟 เพิ่ม: ดึงข้อมูลหัวหน้างานในประวัติฉบับนี้ออกมาด้วย
        manager: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            nickName: true,
          }
        },
        employee: { 
          select: { 
            id: true, 
            companyId: true, 
            firstName: true, 
            lastName: true,
            employeeCode: true 
          } 
        },
      },
    });

    if (!history) throw new NotFoundException(`Job History ID ${id} not found`);

    // 🛡️ ตรวจสอบสิทธิ์ (Multi-tenancy)
    if (history.employee.companyId !== companyId) {
        throw new ForbiddenException('You do not have permission to access this resource');
    }

    // จัดรูปแบบข้อมูลก่อนส่งกลับ (Optional: เพิ่ม fullName ให้หน้าบ้านใช้ง่ายขึ้น)
    return {
      ...history,
      manager: history.manager ? {
        ...history.manager,
        fullName: `${history.manager.firstName} ${history.manager.lastName}`
      } : null
    };
  }

  // =========================================================
  // 5. แก้ไขข้อมูล (Update)
  // =========================================================
  async updateJobHistory(companyId: number, id: number, dto: UpdateJobHistoryDto) {
    const existingRecord = await this.prisma.hrJobHistory.findFirst({
      where: { 
        id, 
        employee: { companyId } 
      }
    });

    if (!existingRecord) {
      throw new NotFoundException(`ไม่พบประวัติการทำงานรหัส ${id}`);
    }

    // เตรียมตัวแปรสำหรับตรวจสอบว่าค่าสุดท้ายที่จะบันทึกคืออะไร (ถ้าส่งมาเอาค่าใหม่ ถ้าไม่ส่งเอาค่าเดิม)
    const targetDeptId = dto.departmentId ?? existingRecord.departmentId;
    const targetPosId = dto.positionId ?? existingRecord.positionId;
    const targetManagerId = dto.managerId !== undefined ? dto.managerId : existingRecord.managerId;
    const targetStartDate = dto.startDate ? new Date(dto.startDate) : existingRecord.startDate;

    if (dto.departmentId !== undefined || dto.positionId !== undefined) {
      await this.validateDepartmentPosition(
        companyId, 
        targetDeptId, 
        targetPosId
      );
    }

    // 🌟 คำนวณ Status ใหม่ เผื่อมีการเลื่อนวัน startDate เข้ามาเป็นปัจจุบัน
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startCompare = new Date(targetStartDate);
    startCompare.setHours(0, 0, 0, 0);
    const newStatus = startCompare > today ? 'PENDING' : 'EFFECTIVE';

    // 🌟 ใช้ Transaction เช่นเดียวกัน
    return this.prisma.$transaction(async (tx) => {
      // อัปเดตตารางประวัติ
      const history = await tx.hrJobHistory.update({
        where: { id },
        data: {
          departmentId: dto.departmentId,
          positionId: dto.positionId,
          managerId: dto.managerId,
          action: dto.action,
          status: newStatus as any, // อัปเดตสถานะใหม่ที่คำนวณได้
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : undefined,
          remarks: dto.remarks
        },
        include: {
          department: true,
          position: true,
          manager: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true }
          }
        }
      });

      // 🌟 ถ้าแก้ไขแล้วสถานะกลายเป็น EFFECTIVE ให้อัปเดตตารางหลักทับไปเลย
      if (newStatus === 'EFFECTIVE') {
        await tx.hrEmployee.update({
          where: { id: existingRecord.employeeId },
          data: {
            hrDepartmentId: targetDeptId,
            positionId: targetPosId,
            managerId: targetManagerId
          }
        });
      }

      return history;
    });
  }

  // =========================================================
  // 6. ลบข้อมูล (พร้อม Rollback ข้อมูล Master)
  // =========================================================
  async deleteJobHistory(companyId: number, id: number) {
    // 1. ดึงประวัติที่กำลังจะโดนลบออกมาดูก่อน
    const historyToDelete = await this.prisma.hrJobHistory.findUnique({
      where: { id , companyId },
      include: { employee: true }
    });

    if (!historyToDelete) {
      throw new NotFoundException(`ไม่พบประวัติการทำงานรหัส ${id}`);
    }

    // ป้องกันคนข้ามบริษัทมาลบ
    if (historyToDelete.employee.companyId !== companyId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ลบประวัตินี้');
    }

    // 2. ใช้ Transaction เพื่อลบและ Rollback ข้อมูล
    return this.prisma.$transaction(async (tx) => {
      // ลบประวัติเป้าหมายทิ้ง
      const deletedHistory = await tx.hrJobHistory.delete({
        where: { id },
      });

      // 3. เช็คว่าถ้าประวัติที่ถูกลบไปเป็นอันที่มีผลใช้งานอยู่ (EFFECTIVE)
      // เราต้องถอยข้อมูลตารางหลัก (HrEmployee) กลับไปหาประวัติก่อนหน้านี้
      if (historyToDelete.status === 'EFFECTIVE') {
        
        // ค้นหาประวัติ 'EFFECTIVE' อันล่าสุดที่ยังเหลืออยู่ของพนักงานคนนี้
        const latestRemainingHistory = await tx.hrJobHistory.findFirst({
          where: {
            employeeId: historyToDelete.employeeId,
            status: 'EFFECTIVE'
          },
          orderBy: { startDate: 'desc' } // เอาตัวล่าสุด
        });

        // อัปเดตตารางหลักให้กลับไปเป็นค่าของประวัติก่อนหน้า 
        // (แต่ถ้า latestRemainingHistory ไม่มีค่า แปลว่าถูกลบประวัติจนหมดเกลี้ยง ก็ให้เซ็ตเป็น null ไปเลย)
        await tx.hrEmployee.update({
          where: { id: historyToDelete.employeeId },
          data: {
            hrDepartmentId: latestRemainingHistory ? latestRemainingHistory.departmentId : null,
            positionId: latestRemainingHistory ? latestRemainingHistory.positionId : null,
            managerId: latestRemainingHistory ? latestRemainingHistory.managerId : null
          }
        });
      }

      return deletedHistory;
    });
  }

 // =========================================================
  // 🌟 ฟังก์ชันใหม่: แต่งตั้งผู้ดูแลแผนก (รองรับ Drag & Drop)
  // =========================================================
  async assignDepartmentManager(companyId: number, dto: any) {
    const { 
      employeeId, 
      targetDepartmentId, 
      actionType, 
      effectiveDate, 
      remarks, 
      roleType,
      // 🌟 เพิ่ม: รับ managerId เผื่อกรณีแต่งตั้งแล้วต้องเปลี่ยนสายรายงานตรงของเขาด้วย
      managerId 
    } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1. ตรวจสอบข้อมูลพื้นฐาน
      const employee = await tx.hrEmployee.findFirst({
        where: { id: employeeId, companyId },
        include: { employeeInfo: true }
      });
      const department = await tx.hrDepartment.findFirst({
        where: { id: targetDepartmentId, companyId }
      });

      if (!employee || !department) {
        throw new NotFoundException('ไม่พบข้อมูลพนักงานหรือแผนกที่ระบุ');
      }

      // 🔍 ตรวจสอบ Effective Date (วันที่มีผล)
      const movementDate = new Date(effectiveDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const movementCompare = new Date(movementDate);
      movementCompare.setHours(0, 0, 0, 0);

      const isFuture = movementCompare > today;

      // 2. ถ้ามีผลทันที (ไม่ใช่อนาคต) ให้จัดการอัปเดตตารางหลัก
      if (!isFuture) {
        // กรณี "ย้ายสังกัดจริง"
        if (actionType === 'TRANSFER_AND_MANAGE') {
          await tx.hrEmployee.update({
            where: { id: employeeId, companyId },
            data: { 
              hrDepartmentId: targetDepartmentId,
              // อัปเดตหัวหน้าสายตรง (ถ้าส่งมา)
              ...(managerId !== undefined && { managerId: managerId })
            }
          });
        } else if (managerId !== undefined) {
          // กรณีแค่แต่งตั้ง (ASSIGN_MANAGER) แต่มีการเปลี่ยนหัวหน้าสายตรงด้วย
          await tx.hrEmployee.update({
            where: { id: employeeId, companyId },
            data: { managerId: managerId }
          });
        }

        // อัปเดตข้อมูลผู้ดูแลในตารางแผนก (Master)
        const updateDeptData: any = {};
        if (roleType === 'DEPUTY') {
          updateDeptData.deputyManagerId = employeeId;
        } else {
          updateDeptData.managerId = employeeId;
        }

        await tx.hrDepartment.update({
          where: { id: targetDepartmentId },
          data: updateDeptData
        });
      }

      // 3. บันทึกประวัติลง Job History (เก็บข้อมูลไว้เสมอไม่ว่าเป็นอดีตหรืออนาคต)
      const history = await tx.hrJobHistory.create({
        data: {
          companyId,
          employeeId,
          departmentId: targetDepartmentId,
          positionId: employee.positionId || 0,
          // 📍 บันทึกหัวหน้าสายตรงลงในประวัติด้วย (ตาม Schema ใหม่ที่คุณแก้)
          managerId: managerId !== undefined ? managerId : employee.managerId,
          
          action: actionType, 
          startDate: movementDate,
          remarks: remarks || `แต่งตั้งเป็น${roleType === 'DEPUTY' ? 'รองหัวหน้า' : 'หัวหน้า'}แผนก`,
          status: isFuture ? 'PENDING' : 'EFFECTIVE'
        },
        include: {
          department: true,
          position: true,
          manager: true // Include เพื่อดูว่าใครเป็นหัวหน้าในประวัตินี้
        }
      });

      // 🌟 4. ดึงข้อมูลพนักงานล่าสุดกลับไปแสดงผล (Flatten)
      const updatedEmp = await tx.hrEmployee.findUnique({
        where: { id: employeeId },
        include: {
          department: true,
          position: true,
          manager: true,
          employeeInfo: true
        }
      });

      const { employeeInfo, manager, ...mainData } = updatedEmp!;

      return {
        message: isFuture 
          ? `จองการแต่งตั้งล่วงหน้าสำเร็จ (มีผลวันที่ ${effectiveDate})` 
          : 'แต่งตั้งหัวหน้าแผนกเรียบร้อยแล้ว',
        history,
        employee: {
          ...mainData,
          manager: manager ? {
            id: manager.id,
            fullName: `${manager.firstName} ${manager.lastName}`,
            employeeCode: manager.employeeCode
          } : null,
          ...(employeeInfo || {})
        }
      };
    });
  }

  // 🛠 Helper: ปลด Primary (รองรับ Transaction)
  private async clearPrimaryFlag(employeeId: number, tx: any = this.prisma) {
    await tx.hrJobHistory.updateMany({
      where: { 
        employeeId, 
        isPrimary: true 
      },
      data: { isPrimary: false },
    });
  }

 // อัปเดตฟังก์ชัน validateDepartmentPosition
private async validateDepartmentPosition(
  companyId: number, 
  departmentId?: number, 
  positionId?: number,
  status: string = 'EFFECTIVE', 
  orgVersionId?: number,
  employeeId?: number // 🌟 เพิ่ม: รับ ID พนักงานเข้ามาเพื่อไม่นับตัวเองซ้ำ
) {
  if (!departmentId || !positionId) return;

  if (status === 'PENDING') {
    // ... ลอจิก Draft (เช็คว่ามีในแผนร่างไหม ตามเดิม) ...
  } else {
    // 🌟 กรณี Master: ดึงข้อมูลโครงสร้างที่ Publish แล้วออกมาเช็ค
    const positionConfig = await this.prisma.hrDepartmentPosition.findFirst({
      where: { companyId, departmentId, positionId },
    });

    if (!positionConfig) {
      throw new BadRequestException('ตำแหน่งที่เลือกไม่ได้รับอนุญาตในผังองค์กรปัจจุบัน');
    }

    // 🌟 [NEW] ลอจิกตรวจสอบกรอบอัตรากำลัง (Manpower Limit)
    if (positionConfig.maxHeadcount !== null) {
      const currentActualCount = await this.prisma.hrEmployee.count({
        where: {
          companyId,
          hrDepartmentId: departmentId,
          positionId: positionId,
          isActive: true,
          status: { notIn: ['RESIGNED', 'TERMINATED'] },
          // ยกเว้นตัวเอง เพื่อให้เวลาแก้ไขข้อมูลส่วนตัวอื่นๆ ไม่โดนระบบเด้ง Error
          id: employeeId ? { not: employeeId } : undefined 
        }
      });

      if (currentActualCount >= positionConfig.maxHeadcount) {
        throw new BadRequestException(
          `อัตรากำลังเต็มแล้ว! ตำแหน่งนี้รับได้สูงสุด ${positionConfig.maxHeadcount} อัตรา (ปัจจุบันมี ${currentActualCount} อัตรา)`
        );
      }
    }
  }
}
}