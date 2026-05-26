import { Injectable, NotFoundException, BadRequestException ,ConflictException ,Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { MailService } from '../../int/mail/mail.service'; // 🌟 เพิ่มการ Import MailService
import * as bcrypt from 'bcrypt';


@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name); // 🌟 ประกาศตัวแปร logger

  constructor(
    private prisma: PrismaService,
    private mailService: MailService, // 🌟 ฉีด MailService เข้ามาใน Constructor
  ) {}

  // 🛡️ ฟังก์ชันตรวจสอบรหัสผ่าน
  private async validatePasswordPolicy(password: string) {
    const policy = await this.prisma.secPasswordPolicy.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (policy) {
      if (password.length < policy.minLength) {
        throw new BadRequestException(`รหัสผ่านต้องมีความยาวอย่างน้อย ${policy.minLength} ตัวอักษร`);
      }
      if (policy.requireUpper && !/[A-Z]/.test(password)) {
        throw new BadRequestException('รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว (A-Z)');
      }
      if (policy.requireLower && !/[a-z]/.test(password)) {
        throw new BadRequestException('รหัสผ่านต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว (a-z)');
      }
      if (policy.requireNumber && !/[0-9]/.test(password)) {
        throw new BadRequestException('รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว (0-9)');
      }
      if (policy.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        throw new BadRequestException('รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว');
      }
    }
  }

  // ตัวช่วยแยกชื่อ-นามสกุล
  private splitFullName(fullName?: string | null) {
    const nameParts = (fullName || '').trim().split(' ');
    const firstName = nameParts[0] || '-';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-';
    return { firstName, lastName };
  }

  async createWithRoles(dto: CreateUserDto) {
    const { userRoles, employee, ...userData } = dto;

    // 🛡️ 1. ดักจับ Username หรือ Email ซ้ำก่อนบันทึก ป้องกันการเกิด 500 Error (P2002)
    const existingUser = await this.prisma.secUser.findFirst({
      where: {
        OR: [
          { username: userData.username },
          // เช็ค Email เฉพาะตอนที่มีการส่งค่า Email มา
          ...(userData.email ? [{ email: userData.email }] : [])
        ]
      }
    });

    if (existingUser) {
      if (existingUser.username === userData.username) {
        throw new ConflictException('Username นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
      }
      if (existingUser.email === userData.email) {
        throw new ConflictException('Email นี้ถูกใช้งานไปแล้ว กรุณาใช้อีเมลอื่น');
      }
    }

    if (dto.password) {
      await this.validatePasswordPolicy(dto.password);
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const { firstName, lastName } = this.splitFullName(userData.fullName);
    const primaryCompanyId = userRoles && userRoles.length > 0 ? userRoles[0].companyId : 1;

    try {
      // 🛡️ 2. ใช้ Try-Catch ครอบการ Insert เพื่อดัก Error อื่นๆ จาก Prisma
      return await this.prisma.secUser.create({
        data: {
          username: userData.username,
          passwordHash: hashedPassword,
          fullName: userData.fullName,
          avatarUrl: userData.avatarUrl || null,
          email: userData.email,
          isActive: userData.isActive,
          roles: {
            create: userRoles?.map(role => ({
              companyId: role.companyId,
              roleId: role.roleId
            })) || []
          },
          employee: employee ? {
            create: {
              companyId: primaryCompanyId,
              firstName: firstName,
              lastName: lastName,
              employeeCode: employee.employeeCode,
              joinDate: new Date(employee.joinDate),
              hrDepartmentId: employee.departmentId,
              positionId: employee.positionId,
              status: employee.status as any || 'ACTIVE'
            }
          } : undefined
        },
        include: { roles: { include: { role: true, company: true } }, employee: true }
      });

    } catch (error: any) {
      this.logger.error('Error creating user:', error);
      
      // 🛡️ 3. ดักจับกรณีที่ระบุ roleId หรือ companyId ที่ไม่มีอยู่จริง (P2003 Foreign Key constraint failed)
      if (error.code === 'P2003') {
        throw new BadRequestException('ข้อมูลบริษัท (Company) หรือ บทบาท (Role) ที่ระบุไม่ถูกต้อง หรือไม่มีในระบบ');
      }
      
      throw new InternalServerErrorException('เกิดข้อผิดพลาดระบบขัดข้องในการสร้างผู้ใช้งาน');
    }
  }

  async findAll(queryCompanyId: number | undefined, currentUser: any) {
    const userId = Number(currentUser.userId || currentUser.sub);

    // 🌟 1. หาว่าคนคนนี้มีสิทธิ์อยู่ในบริษัทไหนบ้าง พร้อมดึงข้อมูลบริษัทมาเช็ค
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId: userId },
      include: { company: true, role: true }
    });

    const directCompanyIds = userRoles.map(ur => ur.companyId).filter(id => id !== null) as number[];

    // 🌟 2. แยกแยะสิทธิ์: เช็คว่าเป็น HQ ของแท้หรือไม่? (ต้องมีสังกัดที่ licenseHolderId เป็น null)
    const isHQ = userRoles.some(ur => ur.company?.licenseHolderId === null);
    const hasSuperAdminRole = userRoles.some(ur => ur.role?.name?.toUpperCase() === 'SUPER_ADMIN');
    
    // ถ้าเป็น HQ ตัวจริง ถึงจะให้สิทธิ์ระดับพระเจ้า (เห็นทั้งระบบ)
    const isGlobalAdmin = isHQ && hasSuperAdminRole;

    // 🌟 3. หาขอบเขตบริษัทที่อนุญาตให้ดูได้ (Licensed Group)
    let allowedCompanyIds: number[] = [];

    if (!isGlobalAdmin) {
      // 🔹 ถ้าไม่ใช่ Global Admin ให้เริ่มจากบริษัทที่ตัวเองมีสิทธิ์โดยตรง
      allowedCompanyIds = [...directCompanyIds];

      // 🔹 ค้นหาเฉพาะ "บริษัทลูก/สาขา" (ดาวน์ไลน์) ที่อยู่ภายใต้บริษัทที่เราสังกัด
      // ป้องกันการมองทะลุสิทธิ์ขึ้นไปหาบริษัทแม่ (HQ) หรือสาขาอื่น
      const childCompanies = await this.prisma.orgCompany.findMany({
         where: {
           parentId: { in: directCompanyIds }
         },
         select: { id: true }
      });

      // รวม ID บริษัทตัวเอง กับ บริษัทลูกเข้าด้วยกัน
      const childIds = childCompanies.map(c => c.id);
      allowedCompanyIds = Array.from(new Set([...allowedCompanyIds, ...childIds]));
    }

    // 🌟 4. สร้างเงื่อนไขการดึงข้อมูล User (Where)
    const whereCondition: any = {};
    
    if (queryCompanyId) {
      if (!isGlobalAdmin && !allowedCompanyIds.includes(queryCompanyId)) {
         // แอบดูของคนอื่น -> บังคับดูได้แค่ในเครือข่ายตัวเอง
         whereCondition.roles = { some: { companyId: { in: allowedCompanyIds } } }; 
      } else {
         whereCondition.roles = { some: { companyId: queryCompanyId } };
      }
    } else {
      // 🔹 เลือก "All Companies"
      if (!isGlobalAdmin) {
         // ดูได้ทุก User "ที่อยู่ในเครือข่ายบริษัทที่เราสังกัด" เท่านั้น
         whereCondition.roles = { some: { companyId: { in: allowedCompanyIds } } };
      }
      // (ถ้าเป็น Global Admin จะไม่ใส่เงื่อนไขนี้ เลยดึงมาได้ทั้งหมด)
    }

    // 🌟 5. ตัวกรองการแสดงผล Tag "บทบาท & บริษัท" (ไม่ให้เห็น Role ที่อยู่นอกเครือ)
    let roleFilter: any = undefined;
    if (queryCompanyId) {
      roleFilter = { companyId: queryCompanyId };
    } else if (!isGlobalAdmin) {
      roleFilter = { companyId: { in: allowedCompanyIds } };
    }

    // 🌟 6. ค้นหาและส่งข้อมูลกลับ
    return this.prisma.secUser.findMany({
      where: whereCondition,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        isActive: true,
        roles: {
          where: roleFilter,
          include: {
            company: { select: { name: true } },
            role: { select: { name: true, displayName: true } }
          }
        },
        employee: true
      }
    });
  }

  async findById(id: number) {
    const user = await this.prisma.secUser.findUnique({
      where: { id },
      include: { 
        roles: { include: { role: true, company: true } },
        employee: true 
      }
    });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');
    return user;
  }

 async update(id: number, dto: UpdateUserDto) {
  // 1. แยกข้อมูลพิเศษออกจากก้อนข้อมูลปกติ
  // 💡 ดึง avatarUrl ออกมาเพื่อเตรียมใส่ใน updateData
  const { userRoles, employee, password, avatarUrl, ...userData } = dto;

  return this.prisma.$transaction(async (tx) => {
    // 2. ดึงข้อมูล User เดิมขึ้นมาเช็ค
    const user = await this.findById(id); 
    if (!user) throw new NotFoundException('ไม่พบข้อมูลผู้ใช้งาน');

    // 3. เตรียมก้อนข้อมูลสำหรับการอัปเดตตาราง secUser
    const updateData: any = { 
      ...userData,
      // 🎨 จัดการรูปโปรไฟล์: ถ้าส่งมาเป็นค่าว่างให้เป็น null, ถ้าไม่ส่งมาให้ใช้ค่าเดิม (undefined)
      avatarUrl: avatarUrl !== undefined ? (avatarUrl || null) : undefined,
    };

    // 4. ลอจิกการเปลี่ยนรหัสผ่าน
    if (password) {
      await this.validatePasswordPolicy(password);
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    // 5. จัดการบทบาท (Roles)
    if (userRoles) {
      // ล้างสิทธิ์เก่าทิ้งก่อน
      await tx.secUserRole.deleteMany({ where: { userId: id } });
      if (userRoles.length > 0) {
        await tx.secUserRole.createMany({
          data: userRoles.map(role => ({
            userId: id,
            companyId: role.companyId,
            roleId: role.roleId
          }))
        });
      }
    }

    // 6. จัดการข้อมูลพนักงาน (Employee)
    if (employee) {
      // อัปเดตชื่อ-นามสกุล ถ้ามีการส่ง fullName มาใหม่ หรือใช้ของเดิมที่มีใน DB
      const fullNameToSplit = userData.fullName || user.fullName;
      const { firstName, lastName } = this.splitFullName(fullNameToSplit);
      
      // หา CompanyId หลัก
      const primaryCompanyId = userRoles && userRoles.length > 0 
        ? userRoles[0].companyId 
        : (user.roles && user.roles.length > 0 ? user.roles[0].companyId : 1);

      if (user.employee) {
        // กรณีมีประวัติพนักงานอยู่แล้ว ให้ทำการ Update
        await tx.hrEmployee.update({
          where: { userId: id },
          data: {
            firstName: firstName,
            lastName: lastName,
            employeeCode: employee.employeeCode,
            joinDate: employee.joinDate ? new Date(employee.joinDate) : undefined,
            hrDepartmentId: employee.departmentId, 
            positionId: employee.positionId,
            status: employee.status as any
          }
        });
      } else {
        // กรณีไม่มีประวัติพนักงาน ให้ทำการ Create ใหม่
        await tx.hrEmployee.create({
          data: {
            userId: id,
            companyId: primaryCompanyId,
            firstName: firstName,
            lastName: lastName,
            employeeCode: employee.employeeCode,
            joinDate: new Date(employee.joinDate),
            hrDepartmentId: employee.departmentId, 
            positionId: employee.positionId,
            status: (employee.status as any) || 'PROBATION'
          }
        });
      }
    }

    // 7. บันทึกข้อมูลทั้งหมดลงในตาราง secUser และคืนค่าพร้อมข้อมูลที่เกี่ยวข้อง
    return tx.secUser.update({ 
      where: { id }, 
      data: updateData,
      include: { 
        roles: { include: { role: true, company: true } }, 
        employee: true 
      }
    });
  });
}

  async remove(id: number) {
    await this.findById(id);
    return this.prisma.secUser.delete({ where: { id } });
  }

  // =========================================================
  // 🔑 แอดมินรีเซ็ตรหัสผ่านให้พนักงาน
  // =========================================================
  async adminResetPassword(targetUserId: number, newPassword: string, adminUserId: number) {
    // 1. หาข้อมูล User พร้อมอีเมล
    const user = await this.prisma.secUser.findUnique({ 
      where: { id: targetUserId },
      include: { roles: true } // ดึง Role เพื่อหา companyId
    });
    
    if (!user) throw new NotFoundException('ไม่พบข้อมูลผู้ใช้งานนี้ในระบบ');
    if (!user.email) throw new BadRequestException('ผู้ใช้งานนี้ไม่มีข้อมูลอีเมล ไม่สามารถส่งการแจ้งเตือนได้');

    // 2. เข้ารหัสผ่านใหม่
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3. อัปเดตข้อมูลลง DB
    await this.prisma.secUser.update({
      where: { id: targetUserId },
      data: {
        passwordHash: hashedPassword,
        passwordUpdatedAt: new Date(),
        isLocked: false,
        lockoutExpires: null
      }
    });

    // 🌟 4. ส่งอีเมลแจ้งเตือน (เพิ่มส่วนนี้)
    const companyId = user.roles.length > 0 ? user.roles[0].companyId : null;
    
    try {
      await this.mailService.sendEmail({
        to: user.email,
        templateCode: 'ADMIN_RESET_PASSWORD', 
        // 🌟 แก้ไขตรงนี้: ใช้ ?? undefined เพื่อเปลี่ยนจาก null เป็น undefined
        companyId: companyId ?? undefined, 
        variables: {
          name: user.fullName || user.username,
          newPassword: newPassword,
          loginUrl: 'https://kkvservice.com/login'
        }
      });
    } catch (error) {
  if (error instanceof Error) {
    throw new InternalServerErrorException(error.message);
  }
  throw new InternalServerErrorException('เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
}

    return { message: 'รีเซ็ตรหัสผ่านและส่งอีเมลแจ้งเตือนสำเร็จ' };
  }
}