import { Injectable, NotFoundException, BadRequestException, ConflictException,InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RunningNumbersService } from '../../cfg/running-numbers/running-numbers.service';
import { 
  CreateEmployeeDto, 
  UpdateEmployeeDto, 
  ResignEmployeeDto, 
  RehireEmployeeDto, 
  CancelResignationDto 
} from './employee.dto';

@Injectable()
export class EmployeeService {
  constructor(
    private prisma: PrismaService,
    private runningService: RunningNumbersService,
  ) {}



private async validateDepartmentPosition(
    companyId: number, 
    departmentId?: number, 
    positionId?: number,
    status: string = 'EFFECTIVE', 
    orgVersionId?: number,
    employeeId?: number 
  ) {
    // 🌟 1. ปริ้นท์ค่าที่รับมาจาก Frontend
    console.log(`\n--- 🔍 DEBUG: เริ่มตรวจสอบตำแหน่ง ---`);
    console.log(`📥 Payload ที่รับมา -> departmentId: ${departmentId}, positionId: ${positionId}, employeeId: ${employeeId}`);

    if (!departmentId || !positionId) {
      console.log(`⚠️ ข้อมูลไม่ครบ (departmentId หรือ positionId หายไป) ระบบจะข้ามการตรวจสอบ`);
      return;
    }

    if (status === 'PENDING') {
      // ... ลอจิก Draft (ปล่อยไว้เหมือนเดิม) ...
    } else {
      const positionConfig = await this.prisma.hrDepartmentPosition.findFirst({
        where: { companyId, departmentId, positionId },
      });

      // 🌟 2. ปริ้นท์ผลลัพธ์ที่หาได้จาก Database
      console.log(`🗄️ ผลการค้นหาในตาราง ผังองค์กร:`, positionConfig ? '✅ เจอข้อมูล' : '❌ ไม่เจอข้อมูล (NULL)');

      if (!positionConfig) {
        // 🌟 3. จุดที่ทำให้เกิด Error
        console.log(`💥 พังตรงนี้! เพราะใน DB ไม่มีคู่ของ departmentId=${departmentId} และ positionId=${positionId}`);
        throw new BadRequestException('ตำแหน่งที่เลือกไม่ได้รับอนุญาตในผังองค์กรปัจจุบัน');
      }

      if (positionConfig.maxHeadcount !== null) {
        const currentActualCount = await this.prisma.hrEmployee.count({
          where: {
            companyId,
            hrDepartmentId: departmentId,
            positionId: positionId,
            isActive: true,
            status: { notIn: ['RESIGNED', 'TERMINATED'] },
            id: employeeId ? { not: employeeId } : undefined 
          }
        });

        console.log(`📊 เช็คโควต้า -> มีคนอยู่แล้ว: ${currentActualCount} / รับได้สูงสุด: ${positionConfig.maxHeadcount}`);

        if (currentActualCount >= positionConfig.maxHeadcount) {
           throw new BadRequestException(`อัตรากำลังสำหรับตำแหน่งนี้เต็มแล้ว (รับได้สูงสุด ${positionConfig.maxHeadcount} อัตรา)`);
        }
      }
    }
    console.log(`✅ ผ่านการตรวจสอบตำแหน่งฉลุย!`);
  }

 // =========================================================================
  // 🟢 1. สร้างพนักงานใหม่ (Create Employee) + ระบบ Running Number 2 ตาราง
  // =========================================================================
// =========================================================
  // 🌟 ฟังก์ชันสร้างพนักงานใหม่ (Full Version - แก้ไขเรื่องหัวหน้างาน)
  // =========================================================
  async create(companyId: number, createEmployeeDto: CreateEmployeeDto) {
    // 1. ตรวจสอบข้อมูลบริษัท
    const company = await this.prisma.orgCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('ไม่พบข้อมูลบริษัท');
    }

    // 2. ตรวจสอบอีเมลซ้ำในบริษัทเดียวกัน
    const existingEmployee = await this.prisma.hrEmployee.findFirst({
      where: {
        companyId,
        email: createEmployeeDto.email,
      },
    });

    if (existingEmployee) {
      throw new BadRequestException('อีเมลนี้ถูกใช้งานแล้วในบริษัทนี้');
    }

    // 🛡️ ตรวจสอบสิทธิ์ตำแหน่งและกรอบอัตรากำลัง
    await this.validateDepartmentPosition(
      companyId,
      createEmployeeDto.departmentId,
      createEmployeeDto.positionId,
      'EFFECTIVE'
    );

    return this.prisma.$transaction(async (tx) => {
      
      // 🌟 3. ลอจิกการจัดการรหัสพนักงาน (Running Number) - เหมือนเดิม
      let finalEmployeeCode = createEmployeeDto.employeeCode;
      if (!finalEmployeeCode) {
        const runningFormat = await tx.cfgRunningFormat.findFirst({
          where: { companyId, docCode: 'EMPLOYEE', isActive: true },
        });

        if (runningFormat) {
          const currentYearStr = new Date().getFullYear().toString();
          const periodKey = runningFormat.resetCriteria === 'YEARLY' ? currentYearStr : 'ALL';
          let counter = await tx.cfgRunningCounter.findFirst({
            where: { companyId, formatId: runningFormat.id, periodKey },
          });

          let nextNum = 1;
          if (counter) {
            nextNum = counter.currentValue + 1;
            await tx.cfgRunningCounter.update({ where: { id: counter.id }, data: { currentValue: nextNum } });
          } else {
            await tx.cfgRunningCounter.create({ data: { companyId, formatId: runningFormat.id, periodKey, currentValue: nextNum } });
          }

          let pattern = runningFormat.formatPattern || '';
          const yy = currentYearStr.slice(-2);
          pattern = pattern.replace(/{YY}/g, yy).replace(/\[YY\]/g, yy).replace(/{YYYY}/g, currentYearStr).replace(/\[YYYY\]/g, currentYearStr);
          finalEmployeeCode = `${pattern}${nextNum.toString().padStart(runningFormat.digitLength || 4, '0')}`;
        } else {
          // fallback
          const currentYear = new Date().getFullYear().toString().slice(-2);
          const lastEmployee = await tx.hrEmployee.findFirst({
            where: { companyId, employeeCode: { startsWith: `${company.code}${currentYear}` } },
            orderBy: { employeeCode: 'desc' },
          });
          const runningNumber = lastEmployee ? (parseInt(lastEmployee.employeeCode.slice(-4)) + 1 || 1) : 1;
          finalEmployeeCode = `${company.code}${currentYear}${runningNumber.toString().padStart(4, '0')}`;
        }
      }

      // 🌟 4. ตรวจสอบเงื่อนไข Future Hire (วันเริ่มงานในอนาคต)
      const joinDate = createEmployeeDto.joinDate ? new Date(createEmployeeDto.joinDate) : new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const joinCompare = new Date(joinDate);
      joinCompare.setHours(0, 0, 0, 0);

      const isFutureHire = joinCompare > today;

      // 🌟 5. บันทึกข้อมูลพนักงานหลัก
      const newEmployee = await tx.hrEmployee.create({
        data: {
          companyId,
          employeeCode: finalEmployeeCode,
          title: createEmployeeDto.title,
          firstName: createEmployeeDto.firstName,
          lastName: createEmployeeDto.lastName,
          nickName: createEmployeeDto.nickName,
          email: createEmployeeDto.email,
          phone: createEmployeeDto.phone,
          profileImageUrl: createEmployeeDto.profileImageUrl,
          managerId: createEmployeeDto.managerId, 
          hrDepartmentId: createEmployeeDto.departmentId,
          positionId: createEmployeeDto.positionId,
          joinDate: joinDate,
          
          // 🚩 ถ้าเป็น Future Hire ให้ตั้ง isActive เป็น false และคงสถานะ PROBATION ไว้ (หรือจะรอเปลี่ยนตอนเริ่มงานก็ได้)
          isActive: !isFutureHire, 
          status: (createEmployeeDto.status as any) || 'PROBATION',
          employmentType: (createEmployeeDto.employmentType as any) || undefined,

          employeeInfo: {
            create: {
              companyId, 
              idCardNumber: createEmployeeDto.idCardNumber,
              passportNo: createEmployeeDto.passportNo,
              gender: createEmployeeDto.gender,
              bloodGroup: createEmployeeDto.bloodGroup,
              birthDate: createEmployeeDto.birthDate ? new Date(createEmployeeDto.birthDate) : undefined,
              nationality: createEmployeeDto.nationality,
              religion: createEmployeeDto.religion,
              maritalStatus: createEmployeeDto.maritalStatus,
              militaryStatus: createEmployeeDto.militaryStatus,
              address: createEmployeeDto.address,
              personalEmail: createEmployeeDto.personalEmail,
              emergencyContactName: createEmployeeDto.emergencyContactName,
              emergencyContactPhone: createEmployeeDto.emergencyContactPhone,
              emergencyContactRelationship: createEmployeeDto.emergencyContactRelationship,
              bankName: createEmployeeDto.bankName,
              bankAccountNo: createEmployeeDto.bankAccountNo,
              bankAccountName: createEmployeeDto.bankAccountName,
            }
          }
        },
        include: {
          employeeInfo: true,
          manager: { select: { id: true, firstName: true, lastName: true, employeeCode: true } }
        }
      });

      // 🌟 6. บันทึกประวัติ Job History (HIRE)
      await tx.hrJobHistory.create({
        data: {
          companyId,
          employeeId: newEmployee.id,
          departmentId: createEmployeeDto.departmentId!,
          positionId: createEmployeeDto.positionId!,
          action: 'HIRE',
          startDate: joinDate,
          remarks: isFutureHire ? `รับพนักงานล่วงหน้า (เริ่มงานจริงวันที่ ${createEmployeeDto.joinDate})` : 'รับพนักงานใหม่เข้าทำงาน',
        },
      });

      // 🌟 7. บันทึกช่วงเวลาการจ้างงานรอบแรก
      await tx.hrEmploymentPeriod.create({
        data: {
          companyId,
          employeeId: newEmployee.id,
          startDate: joinDate,
          reason: 'เริ่มงานวันแรก',
          isDeductible: true,
        },
      });

      return {
        ...newEmployee,
        isFutureHire // ส่งกลับไปบอกหน้าบ้านด้วยว่าคนนี้ยังไม่เริ่มงานวันนี้
      };
    });
  }

 // =========================================================
  // 🔵 2. ดึงข้อมูลทั้งหมด (Find All) + Flatten Data
  // =========================================================
  async findAll(companyId: number, query: any) {
    const { search, departmentId, status } = query;
    
    const employees = await this.prisma.hrEmployee.findMany({
      where: {
        companyId, 
        ...(status ? { status } : {}),
        ...(departmentId ? { hrDepartmentId: Number(departmentId) } : {}), 
        ...(search ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { employeeCode: { contains: search, mode: 'insensitive' } },
            { nickName: { contains: search, mode: 'insensitive' } },
          ]
        } : {})
      },
      include: { 
        department: true, 
        position: true,
        // 🌟 เพิ่ม: ดึงข้อมูลหัวหน้างานมาด้วย
        manager: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          }
        },
        employeeInfo: true, 
      },
      orderBy: { employeeCode: 'asc' }
    });

    // 🌟 ขั้นตอนการ Flatten ข้อมูลพนักงานทุกคนใน Array
    return employees.map(emp => {
      const { employeeInfo, manager, ...mainData } = emp;
      
      return {
        ...mainData,
        // 📍 จัดรูปแบบข้อมูลหัวหน้าให้หน้าบ้านเอาไปแสดงผลชื่อง่ายๆ
        manager: manager ? {
          id: manager.id,
          employeeCode: manager.employeeCode,
          fullName: `${manager.firstName} ${manager.lastName}`
        } : null,
        
        ...(employeeInfo || {}) // แผ่ข้อมูลส่วนตัวและธนาคารออกมา
      };
    });
  }


// =========================================================
  // 🔵 3. ดึงข้อมูลรายคน + คำนวณอายุงานพร้อมระบุจุดอ้างอิง (Find One)
  // =========================================================
  async findOne(companyId: number, id: number) {
    const emp = await this.prisma.hrEmployee.findFirst({
      where: { id, companyId },
      include: { 
        department: true, 
        position: true, 
        // 🌟 ดึงข้อมูลหัวหน้างาน (รวมถึงข้อมูลพื้นฐานที่จำเป็น)
        manager: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            nickName: true,
          }
        },
        employeeInfo: true, 
        employmentPeriods: { orderBy: { startDate: 'desc' } },
        jobHistory: { orderBy: { startDate: 'desc' } }
      }
    });

    if (!emp) throw new NotFoundException(`ไม่พบพนักงาน (ID: ${id}) ในระบบ`);

    // -------------------------------------------------------
    // 🧠 Logic การวิเคราะห์อายุงาน (Tenure Basis)
    // -------------------------------------------------------
    let baseDate = emp.joinDate;
    let tenureBasisLabel = "วันเริ่มงาน";

    if (emp.serviceBaseDate) {
        baseDate = emp.serviceBaseDate;
        tenureBasisLabel = "วันที่ปรับปรุงอายุงาน";
    } 
    else if (emp.employmentPeriods && emp.employmentPeriods.length > 1) {
        const latestPeriod = emp.employmentPeriods[0];
        if (latestPeriod && latestPeriod.startDate) {
            baseDate = latestPeriod.startDate;
            tenureBasisLabel = "วันกลับเข้าทำงานใหม่ (Rehire)";
        }
    }

    // คำนวณอายุงานของบริษัท
    const companyTenure = baseDate ? this.calculateDuration(new Date(baseDate)) : { years: 0, months: 0, days: 0 };

    // คำนวณอายุงานเฉพาะในตำแหน่งปัจจุบัน
    let positionTenure = { years: 0, months: 0, days: 0 };
    if (emp.positionId && emp.jobHistory) {
        const samePosHistory = emp.jobHistory.filter(h => h.positionId === emp.positionId);
        if (samePosHistory.length > 0) {
           positionTenure = this.calculateCumulativeDuration(samePosHistory);
        }
    }

    // 🌟 ขั้นตอนสำคัญ: Flatten ข้อมูล และจัดการ Object หัวหน้างาน
    // ดึง employeeInfo และ manager ออกมาจาก emp
    const { employeeInfo, manager, ...mainData } = emp;

    return {
      ...mainData,
      // 📍 ส่ง Object หัวหน้างานกลับไป (ถ้ามี)
      manager: manager ? {
        id: manager.id,
        employeeCode: manager.employeeCode,
        fullName: `${manager.firstName} ${manager.lastName}`,
        firstName: manager.firstName,
        lastName: manager.lastName,
        nickName: manager.nickName
      } : null,
      
      ...(employeeInfo || {}), // แผ่ข้อมูลส่วนตัวออกมาไว้ระดับนอกสุด
      
      tenureStats: {
          companyTenure: {
              ...companyTenure,
              display: `${companyTenure.years} ปี ${companyTenure.months} เดือน ${companyTenure.days} วัน`,
              basisLabel: `(นับจาก${tenureBasisLabel})` 
          },
          positionTenure: {
              ...positionTenure,
              display: `${positionTenure.years} ปี ${positionTenure.months} เดือน ${positionTenure.days} วัน`
          },
          serviceBaseDate: baseDate
      }
    };
  }

// แทนที่ฟังก์ชัน update เดิมใน employee.service.ts
async update(companyId: number, id: number, dto: UpdateEmployeeDto) {
    const employee = await this.prisma.hrEmployee.findFirst({
      where: { id, companyId }
    });

    if (!employee) throw new NotFoundException(`ไม่พบพนักงานรหัสอ้างอิง ${id}`);

    if (dto.employeeCode && dto.employeeCode !== employee.employeeCode) {
      const existing = await this.prisma.hrEmployee.findFirst({
        where: { companyId, employeeCode: dto.employeeCode },
      });
      if (existing) throw new ConflictException(`รหัสพนักงาน ${dto.employeeCode} มีการใช้งานแล้ว`);
    }

    const newDeptId = dto.departmentId !== undefined ? dto.departmentId : employee.hrDepartmentId; 
    const newPosId = dto.positionId !== undefined ? dto.positionId : employee.positionId;
    
    const isJobChanged = (newDeptId && newDeptId !== employee.hrDepartmentId) || 
                         (newPosId && newPosId !== employee.positionId);
    
    const isManagerChanged = dto.managerId !== undefined && dto.managerId !== employee.managerId;

    if (isJobChanged) {
      await this.validateDepartmentPosition(
        companyId, newDeptId ?? undefined, newPosId ?? undefined, 
        dto.movementStatus || 'EFFECTIVE', dto.orgVersionId ?? undefined, id 
      );
    }

    // 🌟 ดึงข้อมูลที่จะอัปเดต
    const { 
      idCardNumber, passportNo, gender, bloodGroup, birthDate, address, 
      emergencyContactName, emergencyContactPhone, maritalStatus, militaryStatus, 
      emergencyContactRelationship, bankAccountName, bankName, bankAccountNo, 
      nationality, religion, personalEmail, profileImageUrl, effectiveDate, 
      departmentId, positionId, managerId, movementStatus, orgVersionId, ...employeeData 
    } = dto as any;

    const movementDate = effectiveDate ? new Date(effectiveDate) : new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const movementCompare = new Date(movementDate);
    movementCompare.setHours(0, 0, 0, 0);

    const isFuture = movementCompare > today;

    const dataToUpdate: any = { ...employeeData };

    // 🌟 ถ้ามีผลทันที (ไม่ใช่อนาคต) ให้อัปเดตข้อมูลงานด้วย
    if (!isFuture) {
      if (managerId !== undefined) {
        dataToUpdate.manager = managerId > 0 ? { connect: { id: managerId } } : { disconnect: true };
      }
      if (departmentId !== undefined) {
        dataToUpdate.department = { connect: { id: departmentId } };
      }
      if (positionId !== undefined) {
        dataToUpdate.position = { connect: { id: positionId } };
      }
    }

    // แปลงวันที่
    if (dataToUpdate.joinDate) dataToUpdate.joinDate = new Date(dataToUpdate.joinDate);
    if (dataToUpdate.resignDate) dataToUpdate.resignDate = new Date(dataToUpdate.resignDate);
    if (dataToUpdate.confirmDate) dataToUpdate.confirmDate = new Date(dataToUpdate.confirmDate);
    if (dataToUpdate.serviceBaseDate) dataToUpdate.serviceBaseDate = new Date(dataToUpdate.serviceBaseDate);

    if (dataToUpdate.employmentType === "" || dataToUpdate.employmentType === null) delete dataToUpdate.employmentType;
    if (dataToUpdate.status === "" || dataToUpdate.status === null) delete dataToUpdate.status;

    const infoDataToUpdate: any = {};
    if (idCardNumber !== undefined) infoDataToUpdate.idCardNumber = idCardNumber;
    if (passportNo !== undefined) infoDataToUpdate.passportNo = passportNo;
    if (gender !== undefined) infoDataToUpdate.gender = gender;
    if (bloodGroup !== undefined) infoDataToUpdate.bloodGroup = bloodGroup;
    if (birthDate !== undefined) infoDataToUpdate.birthDate = birthDate ? new Date(birthDate) : null;
    if (address !== undefined) infoDataToUpdate.address = address;
    if (emergencyContactName !== undefined) infoDataToUpdate.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone !== undefined) infoDataToUpdate.emergencyContactPhone = emergencyContactPhone;
    if (maritalStatus !== undefined) infoDataToUpdate.maritalStatus = maritalStatus;
    if (militaryStatus !== undefined) infoDataToUpdate.militaryStatus = militaryStatus;
    if (emergencyContactRelationship !== undefined) infoDataToUpdate.emergencyContactRelationship = emergencyContactRelationship;
    if (bankAccountName !== undefined) infoDataToUpdate.bankAccountName = bankAccountName;
    if (bankName !== undefined) infoDataToUpdate.bankName = bankName;
    if (bankAccountNo !== undefined) infoDataToUpdate.bankAccountNo = bankAccountNo;
    if (nationality !== undefined) infoDataToUpdate.nationality = nationality;
    if (religion !== undefined) infoDataToUpdate.religion = religion;
    if (personalEmail !== undefined) infoDataToUpdate.personalEmail = personalEmail;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.hrEmployee.update({
        where: { id },
        data: {
          ...dataToUpdate,
          ...(profileImageUrl !== undefined && { profileImageUrl }), 
          employeeInfo: {
            upsert: { create: { ...infoDataToUpdate, companyId }, update: infoDataToUpdate },
          }
        },
        include: { department: true, position: true, manager: true, employeeInfo: true }
      });

      // 🌟 บันทึก Job History พร้อม Manager Id และสถานะ
      if (isJobChanged || isManagerChanged) {
        await tx.hrJobHistory.create({
          data: {
            companyId,
            employeeId: id,
            departmentId: newDeptId ?? 0,
            positionId: newPosId ?? 0,
            managerId: managerId !== undefined ? managerId : employee.managerId, // 🌟 บันทึกหัวหน้าสายตรง
            startDate: movementDate,     
            action: 'MOVEMENT',           
            status: isFuture ? 'PENDING' : 'EFFECTIVE', // 🌟 ควบคุมสถานะให้ตรงกับวันที่
            remarks: isFuture 
              ? `จองการเปลี่ยนแปลงล่วงหน้า (มีผลวันที่ ${effectiveDate})` 
              : 'ปรับเปลี่ยนข้อมูลงาน/หัวหน้างาน',
          }
        });
      }

      const { employeeInfo, manager, ...mainData } = updated;
      return {
        ...mainData,
        manager: manager ? {
            id: manager.id, fullName: `${manager.firstName} ${manager.lastName}`, employeeCode: manager.employeeCode
        } : null,
        isFutureEffective: isFuture,
        ...(employeeInfo || {}) 
      };
    });
  }

 // แทนที่ฟังก์ชัน resign เดิมใน employee.service.ts
  async resign(companyId: number, id: number, dto: ResignEmployeeDto) {
    const employee = await this.findOne(companyId, id);

    return this.prisma.$transaction(async (tx) => {
        const resignationDate = new Date(dto.effectiveDate);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const resignCompare = new Date(resignationDate);
        resignCompare.setHours(0, 0, 0, 0);

        const isFuture = resignCompare > today;

        const updated = await tx.hrEmployee.update({
            where: { id },
            data: {
                // 🌟 ปรับลอจิกให้เป็น NOTICE_PERIOD ถ้ายื่นลาออกล่วงหน้า
                status: isFuture 
                  ? 'NOTICE_PERIOD' 
                  : (dto.type === 'RESIGNATION' ? 'RESIGNED' : 'TERMINATED'),
                
                isActive: isFuture ? true : false,
                resignDate: resignationDate, 
                managerId: isFuture ? employee.managerId : null 
            },
            include: { department: true, position: true, employeeInfo: true }
        });

        // เฉพาะกรณีมีผลทันที ให้ถอนออกจากหัวหน้าแผนกและปิด History
        if (!isFuture) {
            await tx.hrDepartment.updateMany({
                where: { companyId, OR: [{ managerId: id }, { deputyManagerId: id }] },
                data: { managerId: null, deputyManagerId: null }
            });

            const currentPeriod = await tx.hrEmploymentPeriod.findFirst({
                where: { employeeId: id, endDate: null }
            });
            if (currentPeriod) {
                await tx.hrEmploymentPeriod.update({
                    where: { id: currentPeriod.id },
                    data: { endDate: resignationDate, reason: dto.reason || 'แจ้งลาออก' }
                });
            }

            await tx.hrJobHistory.updateMany({
                where: { employeeId: id, endDate: null },
                data: { endDate: resignationDate, remarks: `พ้นสภาพพนักงาน (${dto.type})` }
            });
        }

        const { employeeInfo, ...mainData } = updated;
        return {
            message: isFuture 
                ? `บันทึกข้อมูลลาออกล่วงหน้าเรียบร้อยแล้ว (มีผลวันที่ ${dto.effectiveDate}) สถานะ: NOTICE_PERIOD`
                : 'บันทึกการพ้นสภาพพนักงานเรียบร้อยแล้ว',
            ...mainData,
            ...(employeeInfo || {})
        };
    });
  }

// =========================================================
  // 6. จ้างกลับ (Re-hire)
  // =========================================================
  async rehire(companyId: number, id: number, dto: RehireEmployeeDto) {
    // 1. ตรวจสอบข้อมูลพนักงานเดิม
    const employee = await this.findOne(companyId, id); 

    // 🛡️ ตรวจสอบสิทธิ์ตำแหน่งและกรอบอัตรากำลัง
    // (ส่งสถานะ EFFECTIVE ไปเพื่อเช็คโควต้าล่วงหน้าเลย ว่าตำแหน่งนี้ว่างให้จ้างกลับไหม)
    await this.validateDepartmentPosition(
      companyId, 
      dto.newDepartmentId, 
      dto.newPositionId, 
      'EFFECTIVE',
      undefined,
      id 
    );

    return this.prisma.$transaction(async (tx) => {
        const rehireDate = new Date(dto.rehireDate);
        
        // 🔍 ตรวจสอบว่าเป็นอนาคตหรือไม่
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rehireCompare = new Date(rehireDate);
        rehireCompare.setHours(0, 0, 0, 0);

        const isFuture = rehireCompare > today;
        let updatedEmp: any = employee;

        // 🌟 2. ถ้ามีผลทันที (ปัจจุบัน หรือ อดีต) ถึงจะอัปเดตตารางหลัก (Master Record)
        if (!isFuture) {
            updatedEmp = await tx.hrEmployee.update({
                where: { id },
                data: {
                    status: 'PROBATION', // หรือดึงค่าจาก DTO ถ้ามีให้เลือก
                    isActive: true,
                    resignDate: null, // เคลียร์วันที่ลาออกออกเพื่อให้รู้ว่ากลับมาแล้ว
                    joinDate: rehireDate, 
                    hrDepartmentId: dto.newDepartmentId,
                    positionId: dto.newPositionId,
                    managerId: (dto as any).newManagerId || (dto as any).managerId || null, 
                },
                include: {
                    department: true,
                    position: true,
                    manager: true,
                    employeeInfo: true
                }
            });
        }

        // 3. สร้างช่วงเวลาการจ้างงานรอบใหม่ (Employment Period บันทึกรอไว้ได้เลย)
        await tx.hrEmploymentPeriod.create({
            data: {
                companyId,
                employeeId: id,
                startDate: rehireDate,
                reason: `Rehired: ${dto.note || 'กลับเข้าทำงานใหม่'}`
            }
        });

        // 🌟 4. บันทึกประวัติการดำรงตำแหน่ง (Job History)
        await tx.hrJobHistory.create({
            data: {
                companyId,
                employeeId: id,
                departmentId: dto.newDepartmentId,
                positionId: dto.newPositionId,
                managerId: (dto as any).newManagerId || (dto as any).managerId || null, // 📍 เก็บหัวหน้างานลงประวัติด้วย
                startDate: rehireDate,
                action: 'REHIRE',
                status: isFuture ? 'PENDING' : 'EFFECTIVE', // 📍 คุมสถานะให้สอดคล้องกับวันที่
                remarks: isFuture 
                    ? `จองตัวกลับเข้าทำงานล่วงหน้า (มีผลวันที่ ${dto.rehireDate})` 
                    : `กลับเข้าทำงานใหม่ (Re-hired) ${dto.note ? '- ' + dto.note : ''}`
            }
        });

        // 🌟 5. Flatten ข้อมูลส่งกลับ
        // ถ้าเป็น Future เราจะส่ง employee เดิมกลับไป (เพราะสถานะเขายังเป็น RESIGNED)
        // ถ้าไม่ Future เราจะส่ง updatedEmp ที่แก้ข้อมูลแล้วกลับไป
        const finalData = isFuture ? employee : updatedEmp;
        const { employeeInfo, manager, ...mainData } = finalData;
        
        return {
          message: isFuture 
            ? `บันทึกการรับกลับเข้าทำงานล่วงหน้าสำเร็จ (เริ่มงาน ${dto.rehireDate}) สถานะ: PENDING` 
            : 'รับพนักงานกลับเข้าทำงานเรียบร้อยแล้ว',
          ...mainData,
          manager: manager ? {
            id: manager.id,
            employeeCode: manager.employeeCode,
            fullName: `${manager.firstName} ${manager.lastName}`
          } : null,
          ...(employeeInfo || {})
        };
    });
  }

 // =========================================================
  // 7. ยกเลิกการลาออก (Cancel Resignation)
  // =========================================================
  async cancelResignation(companyId: number, id: number, dto: CancelResignationDto) {
    const emp = await this.findOne(companyId, id); // 🛡️ ตรวจสอบสิทธิ์
    
    if (!['NOTICE_PERIOD', 'RESIGNED', 'TERMINATED'].includes(emp.status)) {
        throw new BadRequestException('สถานะพนักงานไม่ได้อยู่ในกระบวนการลาออก');
    }

    return this.prisma.$transaction(async (tx) => {
        // 🌟 1. กรณีที่ลาออกไปแล้ว (มีผลไปแล้ว) เราต้องไปเปิดประวัติล่าสุดให้กลับมา
        if (emp.status === 'RESIGNED' || emp.status === 'TERMINATED') {
            
            // 1.1 เปิดช่วงเวลาการจ้างงาน (Employment Period) "อันล่าสุด"
            const lastPeriod = await tx.hrEmploymentPeriod.findFirst({
                where: { employeeId: id },
                orderBy: { endDate: 'desc' } // เอาอันที่เพิ่งปิดล่าสุด
            });
            if (lastPeriod && lastPeriod.endDate) {
                await tx.hrEmploymentPeriod.update({
                    where: { id: lastPeriod.id }, 
                    data: { endDate: null }
                });
            }

            // 1.2 เปิดประวัติการทำงาน (Job History) "อันล่าสุด"
            const lastHistory = await tx.hrJobHistory.findFirst({
                where: { employeeId: id },
                orderBy: { endDate: 'desc' } // เอาอันที่เพิ่งปิดล่าสุด
            });
            if (lastHistory && lastHistory.endDate) {
                await tx.hrJobHistory.update({
                    where: { id: lastHistory.id },
                    data: { 
                        endDate: null,
                        // โน้ตทิ้งไว้ในประวัติหน่อยว่ามีการยกเลิกลาออก
                        remarks: lastHistory.remarks ? `${lastHistory.remarks} (ยกเลิกการลาออก)` : 'ยกเลิกการลาออก'
                    }
                });
            }
        }

        // 🌟 2. อัปเดตสถานะพนักงานในตารางหลักให้กลับมาเป็นปกติ
        const updated = await tx.hrEmployee.update({
            where: { id },
            data: {
                status: dto.restoreStatus || 'CONFIRMED',
                resignDate: null, // เคลียร์วันลาออกล่วงหน้าทิ้ง
                isActive: true
            },
            include: {
                department: true,
                position: true,
                employeeInfo: true
            }
        });

        // 🌟 3. คืนสิทธิ์การเข้าสู่ระบบให้พนักงาน
        if (emp.userId) {
            await tx.secUser.update({ 
                where: { id: emp.userId }, 
                data: { 
                    isActive: true,
                    isLocked: false, // เคลียร์เผื่อว่าเคยโดนระงับ
                    loginAttempts: 0
                } 
            });
        }

        // 🌟 4. Flatten ข้อมูลเพื่อส่งกลับให้หน้าบ้านแสดงผล
        const { employeeInfo, ...mainData } = updated;
        return {
            message: 'ยกเลิกการลาออก และฟื้นฟูสถานะพนักงานเรียบร้อยแล้ว',
            ...mainData,
            ...(employeeInfo || {})
        };
    });
  }

  // =========================================================
  // 8. ลบพนักงาน (Hard Delete) - ลบถาวร (อุดช่องโหว่แล้ว)
  // =========================================================
  async remove(companyId: number, id: number) {
    // 1. ตรวจสอบก่อนว่าพนักงานมีอยู่จริงและเป็นของบริษัทเรา
    const employee = await this.prisma.hrEmployee.findFirst({
      where: { id, companyId },
      include: { user: true } // 🌟 ดึงข้อมูลบัญชีล็อกอินมาด้วย
    });

    if (!employee) {
      throw new NotFoundException(`ไม่พบพนักงานรหัสอ้างอิง ${id} ในระบบของคุณ`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        
        // 🌟 2. เคลียร์ชื่อออกจากตารางแผนก (ป้องกันผังองค์กรบั๊ก)
        await tx.hrDepartment.updateMany({
          where: { companyId, OR: [{ managerId: id }, { deputyManagerId: id }] },
          data: { managerId: null, deputyManagerId: null }
        });

        // 🌟 3. เคลียร์ชื่อออกจากเก้าอี้ตำแหน่ง (HrPositionSeat) ถ้ามีการครองตำแหน่งอยู่
        await tx.hrPositionSeat.updateMany({
          where: { companyId, currentEmployeeId: id },
          data: { currentEmployeeId: null, status: 'VACANT' }
        });

        // 4. สั่งลบทิ้งถาวร (ตารางลูกๆ เช่น Info, JobHistory จะถูกลบตามไปด้วยจาก OnDelete: Cascade ใน Schema)
        await tx.hrEmployee.delete({
          where: { id }
        });

        // 🌟 5. ปิดการใช้งานบัญชีล็อกอิน (SecUser) และริบสิทธิ์ (Role) ของบริษัทนี้คืน
        if (employee.userId) {
          // ถอด Role ออกจากบริษัทนี้
          await tx.secUserRole.deleteMany({
            where: { userId: employee.userId, companyId: companyId }
          });
          
          // ปิดบัญชีไม่ให้ล็อกอินได้อีก (เราใช้วิธี Update isActive เป็น false แทนการ Delete 
          // เพื่อไม่ให้กระทบกับตาราง LogAudit ที่อาจจะเคยบันทึก IP ของคนๆ นี้ไปแล้ว)
          await tx.secUser.update({
            where: { id: employee.userId },
            data: { isActive: false }
          });
        }

        return { message: 'ลบข้อมูลพนักงานสำเร็จ' };
      });
      
    } catch (error: any) {
      // 🌟 6. ดักจับ Error Code P2003 (Foreign Key Constraint Failed)
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'ไม่อนุญาตให้ลบพนักงานท่านนี้! เนื่องจากพนักงานได้ทำรายการในระบบไปแล้ว (เช่น มีประวัติการอนุมัติเอกสาร) ' +
          'หากต้องการนำพนักงานออกจากระบบ กรุณาใช้วิธี "แจ้งพ้นสภาพพนักงาน/แจ้งลาออก" แทนครับ'
        );
      }
      // ถ้าเป็น Error อื่นๆ ให้โยนกลับไปปกติ
      throw new InternalServerErrorException(`เกิดข้อผิดพลาดในการลบข้อมูล: ${error.message}`);
    }
  }

// =========================================================
  // 🌟 ฟังก์ชันใหม่: แต่งตั้งผู้ดูแลแผนก (รองรับ Drag & Drop & Effective Date)
  // =========================================================
  async assignDepartmentManager(companyId: number, dto: any) {
    const { 
      employeeId, 
      targetDepartmentId, 
      actionType, 
      effectiveDate, 
      remarks, 
      roleType,
      managerId 
    } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1. ตรวจสอบข้อมูลพนักงานและแผนก
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

      // 🌟 2. 🔍 ตรวจสอบ Effective Date (วันที่มีผล)
      const movementDate = new Date(effectiveDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const movementCompare = new Date(movementDate);
      movementCompare.setHours(0, 0, 0, 0);

      // ถ้ายิ่งวันกว่าวันนี้ (เป็นอนาคต)
      const isFuture = movementCompare > today;

      // 🌟 3. ถ้า "มีผลทันที" หรือเป็น "ย้อนหลัง" (ไม่ใช่อนาคต) ถึงจะอัปเดตตารางหลัก
      if (!isFuture) {
        if (actionType === 'TRANSFER_AND_MANAGE') {
          // 🛡️ ตรวจสอบโควต้าและตำแหน่ง (ส่ง employeeId ไปเพื่อไม่ให้นับตัวเองซ้ำ)
          await this.validateDepartmentPosition(
            companyId, 
            targetDepartmentId, 
            employee.positionId || undefined,
            'EFFECTIVE',
            undefined,
            employeeId
          );

          // อัปเดตข้อมูลพนักงาน (ย้ายแผนก และ/หรือ เปลี่ยนหัวหน้าสายรายงาน)
          await tx.hrEmployee.update({
            where: { id: employeeId },
            data: { 
              hrDepartmentId: targetDepartmentId,
              ...(managerId !== undefined && { managerId: managerId })
            }
          });
        } else {
          // กรณีแค่แต่งตั้งรักษาการ (ASSIGN_MANAGER) แต่ยังอยู่แผนกเดิม 
          if (managerId !== undefined) {
            await tx.hrEmployee.update({
              where: { id: employeeId },
              data: { managerId: managerId }
            });
          }
        }

        // อัปเดตตารางแผนก (Master) เพื่อระบุตัวผู้ดูแล
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

      // 🌟 4. บันทึกประวัติลง Job History (ทำเสมอไม่ว่าอดีตหรืออนาคต)
      // เปลี่ยน status ให้สอดคล้องกับวันที่
      await tx.hrJobHistory.create({
        data: {
          companyId,
          employeeId,
          departmentId: targetDepartmentId,
          positionId: employee.positionId || 0,
          managerId: managerId !== undefined ? managerId : employee.managerId, // 📍 เก็บสายรายงานล่าสุดลงประวัติ
          action: actionType, 
          startDate: movementDate,
          remarks: remarks || `แต่งตั้งเป็น${roleType === 'DEPUTY' ? 'รองหัวหน้า' : 'หัวหน้า'}แผนก`,
          status: isFuture ? 'PENDING' : 'EFFECTIVE' // 📍 ควบคุมสถานะให้ตรงกับเวลา
        }
      });

      // 🌟 5. ดึงข้อมูลพนักงานตัวล่าสุดกลับมาส่งหน้าบ้าน
      const updatedEmp = await tx.hrEmployee.findUnique({
        where: { id: employeeId },
        include: {
          department: true,
          position: true,
          manager: true, 
          employeeInfo: true
        }
      });

      if (!updatedEmp) throw new InternalServerErrorException('เกิดข้อผิดพลาดในการดึงข้อมูลหลังการอัปเดต');

      const { employeeInfo, manager, ...mainData } = updatedEmp;

      return {
        message: isFuture 
            ? `จองการแต่งตั้งล่วงหน้าเรียบร้อยแล้ว (มีผลวันที่ ${effectiveDate}) สถานะ: PENDING`
            : 'ดำเนินการแต่งตั้งและบันทึกประวัติเรียบร้อยแล้ว',
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

  // =========================================================
  // 🔍 ค้นหาพนักงานแบบรวดเร็ว (รองรับ Dropdown & Popup Advanced Search)
  // =========================================================
  async searchActiveEmployeesForDropdown(
    companyId: number, 
    keyword?: string, 
    departmentId?: number, 
    positionId?: number,
    excludeNoticePeriod: boolean = false // 🌟 ออปชันเสริมเผื่อหน้าบ้านไม่อยากได้คนที่กำลังจะลาออก
  ) {
    // กำหนดสถานะที่จะถูกตัดออก
    const excludedStatuses = ['RESIGNED', 'TERMINATED'];
    if (excludeNoticePeriod) {
      excludedStatuses.push('NOTICE_PERIOD'); // ตัดคนที่นับถอยหลังลาออกทิ้งด้วยถ้าต้องการ
    }

    const employees = await this.prisma.hrEmployee.findMany({
      where: {
        companyId: companyId,
        isActive: true, 
        status: { notIn: excludedStatuses as any },
        ...(departmentId ? { hrDepartmentId: departmentId } : {}),
        ...(positionId ? { positionId: positionId } : {}),
        ...(keyword ? {
          OR: [
            { firstName: { contains: keyword, mode: 'insensitive' } },
            { lastName: { contains: keyword, mode: 'insensitive' } },
            { employeeCode: { contains: keyword, mode: 'insensitive' } },
            { nickName: { contains: keyword, mode: 'insensitive' } },
          ]
        } : {})
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        nickName: true,
        department: { select: { name: true } }, 
        position: { select: { name: true } }
      },
      take: 50, 
      orderBy: { firstName: 'asc' }
    });

    // 🌟 จัดรูปแบบข้อมูลให้หน้าบ้านเอาไปแปะในตัวเลือก <select> ได้ง่ายๆ
    return employees.map(emp => ({
      id: emp.id,
      employeeCode: emp.employeeCode,
      fullName: `${emp.firstName} ${emp.lastName}`, // ประกอบร่างชื่อให้เลย
      nickName: emp.nickName,
      departmentName: emp.department?.name || '-',
      positionName: emp.position?.name || '-',
      // 🌟 ส่ง label สำเร็จรูปไปให้เลย (เช่น "EMP001 - สมชาย ใจดี (ฝ่าย IT)")
      dropdownLabel: `${emp.employeeCode} - ${emp.firstName} ${emp.lastName} ${emp.department ? `(${emp.department.name})` : ''}`
    }));
  }

  // =========================================================
  // 🛠 Helper Functions (Private)
  // =========================================================

private calculateDuration(startDate: Date, endDate: Date = new Date()) {
    // 🌟 1. ดักกรณี Future Date: ถ้าวันเริ่มงานอยู่ในอนาคต (มากกว่า endDate) ให้ถือว่าอายุงานยังไม่เริ่ม (0)
    if (startDate.getTime() > endDate.getTime()) {
      return { years: 0, months: 0, days: 0 };
    }

    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();
    let days = endDate.getDate() - startDate.getDate();

    if (days < 0) {
      months--;
      const prevMonthDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
      days += prevMonthDate.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    return { years, months, days };
  }

  private calculateCumulativeDuration(histories: any[]) {
    let totalMilliseconds = 0;
    const now = new Date().getTime();

    histories.forEach(h => {
        const start = new Date(h.startDate).getTime();
        
        // 🌟 2. ดักกรณี Future Date ในประวัติการทำงาน
        // ถ้าประวัตินั้นเป็นของอนาคต (เช่น วางแผนย้ายแผนกเดือนหน้า) จะยังไม่เอามานับรวมอายุงานในตำแหน่งนี้
        if (start > now) return; 

        const end = h.endDate ? new Date(h.endDate).getTime() : now; 
        
        // 🌟 3. เผื่อกรณี end ดันน้อยกว่า start จากการคีย์ข้อมูลผิด จะได้ไม่ทำให้ยอดรวมติดลบ
        if (end > start) {
          totalMilliseconds += (end - start);
        }
    });

    const totalDays = Math.floor(totalMilliseconds / (1000 * 60 * 60 * 24));
    const years = Math.floor(totalDays / 365);
    const remainingDaysAfterYear = totalDays % 365;
    const months = Math.floor(remainingDaysAfterYear / 30);
    const days = remainingDaysAfterYear % 30;

    return { years, months, days };
  }

  


  

}