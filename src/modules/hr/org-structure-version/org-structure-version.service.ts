import { BadRequestException, Injectable ,NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; // ปรับ path ตามจริง
import { CreateOrgVersionDto } from './dto/create-org-version.dto';
import { SaveOrgTreeDto } from './dto/save-org-tree.dto';

@Injectable()
export class OrgStructureVersionService {
  constructor(private prisma: PrismaService) {}

 
// 1. สร้าง Version พร้อมก๊อปปี้ Master Data อัตโนมัติ (Auto-Clone)
  async createDraftVersion(companyId: number, dto: CreateOrgVersionDto) {
    return this.prisma.$transaction(async (tx) => {
      // 🌟 1. หาเลข Version ถัดไป เพื่อป้องกัน P2002
      const lastVersion = await tx.hrOrgStructureVersion.findFirst({
        where: { companyId, calendarId: dto.calendarId },
        orderBy: { version: 'desc' },
      });
      const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

      // 🌟 2. สร้างแฟ้ม Version (Header)
      const newVersion = await tx.hrOrgStructureVersion.create({
        data: {
          companyId,
          calendarId: dto.calendarId,
          name: dto.name,
          version: nextVersion,
          status: 'DRAFT',
        },
      });

      // 🌟 3. ก๊อปปี้ข้อมูลโครงสร้างจริง (Master) มาเป็นสารตั้งต้นให้ Draft นี้
      const masterDepts = await tx.hrDepartment.findMany({
        where: { companyId },
        include: { allowedPositions: true }, // ดึงตำแหน่งมาด้วย
      });

      if (masterDepts.length > 0) {
        const idMap = new Map(); // เอาไว้จำ Mapping ระหว่าง ID เก่า กับ ID ใหม่

        // Step A: โคลนแผนกทั้งหมดสร้างลง Database ก่อน (ยังไม่ผูก Parent)
        for (const dept of masterDepts) {
          const newDeptV = await tx.hrDepartmentVersion.create({
            data: {
              companyId,
              versionId: newVersion.id,
              originalDeptId: dept.id, // 👈 เก็บ ID ต้นฉบับไว้สำคัญมากตอนเอาไปใช้งาน
              code: dept.code,
              name: dept.name,
              sortOrder: dept.sortOrder,
            },
          });
          idMap.set(dept.id, newDeptV.id); // จดจำ ID
        }

        // Step B: วนลูปอีกรอบเพื่อผูกสายบังคับบัญชา (Parent) และยัดตำแหน่งใส่แผนก
        for (const dept of masterDepts) {
          const realId = idMap.get(dept.id);
          const realParentId = dept.parentId ? idMap.get(dept.parentId) : null;

          await tx.hrDepartmentVersion.update({
            where: { id: realId },
            data: {
              parentId: realParentId,
              positions: dept.allowedPositions.length > 0 ? {
                create: dept.allowedPositions.map(p => ({
                  companyId,
                  positionId: p.positionId,
                  maxHeadcount: p.maxHeadcount,
                }))
              } : undefined
            },
          });
        }
      }

      return newVersion;
    });
  }

// =========================================================
  // 2. ฟีเจอร์เด็ด: Copy ผังองค์กรเดิม มาเป็น Draft ใหม่ (พร้อมลอจิกผูก Tree อัตโนมัติ)
  // =========================================================
  async copyStructureToNewVersion(
    companyId: number, 
    sourceVersionId: number, 
    newCalendarId: number, 
    newName: string = 'คัดลอกฉบับร่างใหม่' // เผื่อหน้าบ้านไม่ได้ส่งชื่อมา
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. ตรวจสอบว่ามี sourceVersionId (ต้นฉบับ) อยู่จริง
      const sourceVersion = await tx.hrOrgStructureVersion.findUnique({
        where: { id: sourceVersionId, companyId },
      });

      if (!sourceVersion) {
        throw new NotFoundException('ไม่พบโครงสร้างองค์กรต้นฉบับที่ต้องการคัดลอก');
      }

      // 2. หาเลข Version ถัดไปของ Calendar ใหม่ เพื่อป้องกัน Error ซ้ำ
      const lastVersion = await tx.hrOrgStructureVersion.findFirst({
        where: { companyId, calendarId: newCalendarId },
        orderBy: { version: 'desc' },
      });
      const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

      // 3. สร้าง HrOrgStructureVersion ตัวใหม่ (สถานะ DRAFT เสมอ)
      const newVersion = await tx.hrOrgStructureVersion.create({
        data: {
          companyId,
          calendarId: newCalendarId,
          name: newName,
          version: nextVersion,
          status: 'DRAFT', 
        },
      });

      

      // 4. Query แผนกทั้งหมดจากเวอร์ชันต้นฉบับ (พร้อมตำแหน่งที่อยู่ข้างใน)
      const oldDepts = await tx.hrDepartmentVersion.findMany({
        where: { versionId: sourceVersionId, companyId },
        include: { positions: true },
      });

      if (oldDepts.length > 0) {
        const idMap = new Map(); // 🌟 พระเอกของเรา: เอาไว้จดจำ ID เก่า -> ID ใหม่

        // 🌟 รอบที่ 1: สร้างแผนกทั้งหมดลง Version ใหม่ (ยังไม่ผูก Parent)
        for (const oldDept of oldDepts) {
          const newDept = await tx.hrDepartmentVersion.create({
            data: {
              companyId,
              versionId: newVersion.id,
              originalDeptId: oldDept.originalDeptId, // รักษาจุดเชื่อมต่อกับ Master Data ไว้
              code: oldDept.code,
              name: oldDept.name,
              sortOrder: oldDept.sortOrder,
            },
          });
          idMap.set(oldDept.id, newDept.id); // จดจำว่า ID เก่านี้ กลายเป็น ID ใหม่เลขอะไร
        }

        // 🌟 รอบที่ 2: วนลูปอีกครั้งเพื่อผูก ParentId และใส่ตำแหน่ง (Positions)
        for (const oldDept of oldDepts) {
          const newDeptId = idMap.get(oldDept.id);
          // ถ้าแผนกเดิมมีหัวหน้า ก็ไปหา ID ใหม่ของหัวหน้ามาใส่
          const newParentId = oldDept.parentId ? idMap.get(oldDept.parentId) : null;

          await tx.hrDepartmentVersion.update({
            where: { id: newDeptId },
            data: {
              parentId: newParentId, // ผูกสายบังคับบัญชาใหม่ให้ถูกต้อง 100%
              positions: oldDept.positions.length > 0 ? {
                create: oldDept.positions.map(p => ({
                  companyId,
                  positionId: p.positionId,
                  maxHeadcount: p.maxHeadcount,
                }))
              } : undefined
            },
          });
        }
      }

      return newVersion;
    });
  }



// =========================================================
  // 3. ฟีเจอร์ Publish (ประกาศใช้ Version และซิงค์ข้อมูลลง Master อย่างปลอดภัย)
  // =========================================================
  async publishVersion(companyId: number, versionId: number) {
    // 1. ตรวจสอบว่า Version นี้มีอยู่จริงและเป็น DRAFT
    const targetVersion = await this.prisma.hrOrgStructureVersion.findUnique({
      where: { id: versionId, companyId },
    });

    if (!targetVersion || targetVersion.status !== 'DRAFT') {
      throw new BadRequestException('สามารถประกาศใช้ได้เฉพาะโครงสร้างที่มีสถานะเป็น DRAFT เท่านั้น');
    }

    return this.prisma.$transaction(async (tx) => {
      // 🌟 Step 1: ปลดประจำการ Version เก่าในปีปฏิทินนี้ (PUBLISHED -> ARCHIVED)
      await tx.hrOrgStructureVersion.updateMany({
        where: {
          companyId,
          calendarId: targetVersion.calendarId,
          status: 'PUBLISHED', // หาตัวที่ใช้อยู่ปัจจุบัน
        },
        data: { status: 'ARCHIVED' }, // เก็บเข้ากรุประวัติศาสตร์ (Enum ตัวใหม่ที่เราเพิ่ม)
      });

      // 🌟 Step 2: เลื่อนขั้น Version นี้ให้กลายเป็นตัวจริง (DRAFT -> PUBLISHED)
      const published = await tx.hrOrgStructureVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED' },
      });

      // 🌟 Step 3: ซิงค์ข้อมูลลงตาราง Master (HrDepartment) อย่างปลอดภัย
      const draftDepts = await tx.hrDepartmentVersion.findMany({
        where: { versionId, companyId },
        include: { positions: true },
      });

      const versionToMasterIdMap = new Map(); // เอาไว้จำ ID สำหรับผูก Parent

      // 3.1 วนลูปสร้าง/อัปเดตแผนก (ยังไม่ผูกสายบังคับบัญชา)
      for (const draft of draftDepts) {
        if (draft.originalDeptId) {
          // กรณีเป็นแผนกเก่าที่มีอยู่แล้ว -> อัปเดตชื่อ/รหัส
          const updated = await tx.hrDepartment.update({
            where: { id: draft.originalDeptId },
            data: {
              name: draft.name,
              code: draft.code,
              sortOrder: draft.sortOrder,
            },
          });
          versionToMasterIdMap.set(draft.id, updated.id);
        } else {
          // กรณีเป็นแผนกใหม่ที่เพิ่งถูกสร้างขึ้นมาในหน้า Draft -> สร้างใหม่ใน Master
          const created = await tx.hrDepartment.create({
            data: {
              companyId,
              name: draft.name,
              code: draft.code,
              sortOrder: draft.sortOrder,
            },
          });
          versionToMasterIdMap.set(draft.id, created.id);

          // อัปเดต ID จริงกลับไปที่ Version เพื่อเป็น Reference ในอนาคต
          await tx.hrDepartmentVersion.update({
            where: { id: draft.id },
            data: { originalDeptId: created.id },
          });
        }
      }

      // 3.2 วนลูปผัง Parent (สายบังคับบัญชา) และยัด Positions ลงตารางจริง
      for (const draft of draftDepts) {
        const masterId = versionToMasterIdMap.get(draft.id);
        const masterParentId = draft.parentId ? versionToMasterIdMap.get(draft.parentId) : null;

        // ล้างตำแหน่งเก่าใน Master ทิ้ง (เช็คด้วย companyId เพื่อความปลอดภัยระดับ Enterprise)
        await tx.hrDepartmentPosition.deleteMany({
          where: { 
            departmentId: masterId,
            companyId: companyId 
          },
        });

        // อัปเดต ParentId และเซฟตำแหน่งใหม่ลงไป (รวม companyId ตาม Schema ใหม่)
        await tx.hrDepartment.update({
          where: { id: masterId },
          data: {
            parentId: masterParentId,
            allowedPositions: draft.positions.length > 0 ? {
              create: draft.positions.map(p => ({
                companyId: companyId, // 🌟 ใส่ได้แล้วเพราะเพิ่มใน Schema แล้ว
                positionId: p.positionId,
                maxHeadcount: p.maxHeadcount,
              }))
            } : undefined
          },
        });
      }

      return published;
    });
  }

  // =========================================================
  // 3.1 ฟังก์ชันสำหรับกดขออนุมัติ Publish (วิ่งเข้า Workflow)
  // =========================================================
  async requestPublishWorkflow(companyId: number, versionId: number, userId: number) {
    const targetVersion = await this.prisma.hrOrgStructureVersion.findUnique({
      where: { id: versionId, companyId },
    });

    if (!targetVersion || targetVersion.status !== 'DRAFT') {
      throw new BadRequestException('สามารถขออนุมัติได้เฉพาะโครงสร้างที่มีสถานะเป็น DRAFT เท่านั้น');
    }

    // 1. ค้นหา Mapping ว่าแอดมินตั้งค่า Workflow สำหรับ "ประกาศใช้ผังองค์กร" ไว้หรือไม่
    const mapping = await this.prisma.wfModuleMapping.findFirst({
      where: { companyId, moduleCode: 'HR_ORG_PUBLISH' }
    });

    if (!mapping) {
      throw new BadRequestException('ยังไม่ได้ตั้งค่าสายอนุมัติสำหรับการประกาศใช้โครงสร้างองค์กร กรุณาตั้งค่าโมดูล HR_ORG_PUBLISH ในเมนู Workflow');
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. สร้างใบคำร้องเข้าสู่ระบบ Workflow
      const wfRequest = await tx.wfRequest.create({
        data: {
          companyId,
          workflowId: mapping.workflowId,
          businessId: versionId.toString(),
          businessType: 'HR_ORG_PUBLISH',
          topic: `ขออนุมัติประกาศใช้โครงสร้างองค์กร: ${targetVersion.name} (ปี ${targetVersion.calendarId})`,
          requesterId: userId,
          status: 'PENDING',
        }
      });

      // 3. เปลี่ยนสถานะ Version เป็นรออนุมัติ และผูก ID Workflow
      const updatedVersion = await tx.hrOrgStructureVersion.update({
        where: { id: versionId },
        data: { 
          status: 'PENDING_APPROVAL' as any, // 👈 ล็อกไม่ให้แก้ Draft ต่อ (ต้องมี PENDING_APPROVAL ใน Enum)
          wfRequestId: wfRequest.id 
        },
      });

      return updatedVersion;
    });
  }

  // =========================================================
  // 3.2 ฟังก์ชันสำหรับซิงค์ลง Master (จะถูกเรียกโดย Webhook/Service เมื่อ Workflow อนุมัติ 'จบแล้ว' เท่านั้น)
  // =========================================================
  async executeSyncToMaster(companyId: number, versionId: number) {
    const targetVersion = await this.prisma.hrOrgStructureVersion.findUnique({
      where: { id: versionId, companyId },
    });

    if (!targetVersion) {
      throw new BadRequestException('ไม่พบโครงสร้างองค์กรที่ระบุ');
    }

    return this.prisma.$transaction(async (tx) => {
      // 🌟 Step 1: ปลดประจำการ Version เก่าในปีปฏิทินนี้ (PUBLISHED -> ARCHIVED)
      await tx.hrOrgStructureVersion.updateMany({
        where: {
          companyId,
          calendarId: targetVersion.calendarId,
          status: 'PUBLISHED', 
        },
        data: { status: 'ARCHIVED' as any }, // (ต้องมี ARCHIVED ใน Enum)
      });

      // 🌟 Step 2: เลื่อนขั้น Version นี้ให้กลายเป็นตัวจริง (รออนุมัติ -> PUBLISHED)
      const published = await tx.hrOrgStructureVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED' },
      });

      // 🌟 Step 3: ซิงค์ข้อมูลลงตาราง Master (HrDepartment)
      const draftDepts = await tx.hrDepartmentVersion.findMany({
        where: { versionId, companyId },
        include: { positions: true },
      });

      const versionToMasterIdMap = new Map(); 

      // 3.1 วนลูปสร้าง/อัปเดตแผนก
      for (const draft of draftDepts) {
        if (draft.originalDeptId) {
          const updated = await tx.hrDepartment.update({
            where: { id: draft.originalDeptId },
            data: {
              name: draft.name,
              code: draft.code,
              sortOrder: draft.sortOrder,
            },
          });
          versionToMasterIdMap.set(draft.id, updated.id);
        } else {
          const created = await tx.hrDepartment.create({
            data: {
              companyId,
              name: draft.name,
              code: draft.code,
              sortOrder: draft.sortOrder,
            },
          });
          versionToMasterIdMap.set(draft.id, created.id);

          await tx.hrDepartmentVersion.update({
            where: { id: draft.id },
            data: { originalDeptId: created.id },
          });
        }
      }

      // 3.2 วนลูปผัง Parent (สายบังคับบัญชา) และยัด Positions ลงตารางจริง
      for (const draft of draftDepts) {
        const masterId = versionToMasterIdMap.get(draft.id);
        const masterParentId = draft.parentId ? versionToMasterIdMap.get(draft.parentId) : null;

        await tx.hrDepartmentPosition.deleteMany({
          where: { 
            departmentId: masterId,
            companyId: companyId 
          },
        });

        await tx.hrDepartment.update({
          where: { id: masterId },
          data: {
            parentId: masterParentId,
            allowedPositions: draft.positions.length > 0 ? {
              create: draft.positions.map(p => ({
                companyId: companyId, 
                positionId: p.positionId,
                maxHeadcount: p.maxHeadcount,
              }))
            } : undefined
          },
        });
      }

      return published;
    });
  }

  // =========================================================
  // 3.3 ฟังก์ชันตีดราฟต์กลับ (ถูกเรียกเมื่อ Workflow โดน Reject หรือ Cancel)
  // =========================================================
  async revertToDraft(companyId: number, versionId: number) {
    const targetVersion = await this.prisma.hrOrgStructureVersion.findUnique({
      where: { id: versionId, companyId },
    });

    if (!targetVersion) {
      throw new NotFoundException('ไม่พบโครงสร้างองค์กรที่ระบุ');
    }

    // เปลี่ยนสถานะกลับเป็น DRAFT และเคลียร์เลข Workflow ทิ้งเพื่อให้ส่งตั้งเรื่องใหม่ได้
    return this.prisma.hrOrgStructureVersion.update({
      where: { id: versionId },
      data: { 
        status: 'DRAFT',
        wfRequestId: null 
      },
    });
  }

  // =========================================================
  // 🌟 ดึงรายการ Version ทั้งหมดของปีปฏิทินนั้น (สำหรับ Dropdown)
  // =========================================================
  async findAllVersions(companyId: number, calendarId: number) {
    return this.prisma.hrOrgStructureVersion.findMany({
      where: { companyId, calendarId },
      orderBy: { version: 'desc' }, // เรียงจากเวอร์ชันล่าสุดขึ้นก่อน
    });
  }

 // =========================================================
  // 🌟 บันทึกตำแหน่งเข้าแผนก (เฉพาะในฉบับร่าง DRAFT)
  // =========================================================
  async updateDraftDepartmentPositions(
    companyId: number,
    versionId: number,
    deptVersionId: number,
    positions: { positionId: number; maxHeadcount?: number }[]
  ) {
    // 1. เช็คก่อนว่า Version นี้เป็น DRAFT จริงๆ
    const version = await this.prisma.hrOrgStructureVersion.findUnique({
      where: { id: versionId, companyId },
    });
    if (!version || version.status !== 'DRAFT') {
      throw new BadRequestException('สามารถแก้ไขได้เฉพาะโครงสร้างฉบับร่าง (DRAFT) เท่านั้น');
    }

    // 2. เช็คว่าแผนกนี้มีอยู่จริงใน Version นี้
    const dept = await this.prisma.hrDepartmentVersion.findUnique({
      where: { id: deptVersionId, versionId, companyId },
    });
    if (!dept) {
      throw new NotFoundException('ไม่พบแผนกในโครงสร้างฉบับร่างนี้');
    }

    return this.prisma.$transaction(async (tx) => {
      // 🌟 3. ล้างตำแหน่งเก่าของแผนกนี้ทิ้ง (ล็อก companyId ไว้แล้ว ปลอดภัย 100%)
      await tx.hrDepartmentPositionVersion.deleteMany({
        where: { deptVersionId, companyId }, 
      });

      // 🌟 4. บันทึกตำแหน่งใหม่ที่ถูกลากเข้ามา (ยัด companyId ให้ทุก Record ตั้งแต่แรกแล้ว)
      if (positions && positions.length > 0) {
        await tx.hrDepartmentPositionVersion.createMany({
          data: positions.map(p => ({
            companyId: companyId, // 👈 มีการใส่ companyId ไว้อย่างถูกต้องอยู่แล้วครับ
            deptVersionId,
            positionId: p.positionId,
            maxHeadcount: p.maxHeadcount || null,
          })),
        });
      }
      return { message: 'อัปเดตตำแหน่งในแผนกสำเร็จ' };
    });
  }

  async deleteDraftVersion(companyId: number, versionId: number) {
    // 1. ค้นหา Version ที่ต้องการลบก่อน
    const targetVersion = await this.prisma.hrOrgStructureVersion.findUnique({
      where: {
        id: versionId,
        companyId: companyId, // 🛡️ ตรวจสอบว่าเป็นของบริษัทนี้จริงๆ ป้องกันการลบข้ามบริษัท
      },
    });

    if (!targetVersion) {
      throw new NotFoundException('ไม่พบข้อมูลโครงสร้างองค์กรที่ต้องการลบ');
    }

    // 2. กฎเหล็ก: ต้องเป็น DRAFT เท่านั้นถึงจะลบได้
    if (targetVersion.status !== 'DRAFT') {
      throw new BadRequestException('ลบได้เฉพาะโครงสร้างที่มีสถานะเป็น DRAFT เท่านั้น');
    }

    // 3. สั่งลบข้อมูล 
    // 💡 (เนื่องจากเราตั้ง onDelete: Cascade ไว้ที่ตารางลูกๆ แล้ว 
    // แค่ลบตัวแม่ ข้อมูลแผนกและตำแหน่งจำลองข้างในจะถูกลบทิ้งให้หมดอัตโนมัติครับ)
    return this.prisma.hrOrgStructureVersion.delete({
      where: { id: versionId },
    });
  }

  // =========================================================
  // 🌟 ดึงข้อมูลต้นไม้ของ Version นั้นๆ ไปแสดงฝั่งซ้าย
  // =========================================================
  async getDraftTree(companyId: number, versionId: number) {
    const departments = await this.prisma.hrDepartmentVersion.findMany({
      where: { companyId, versionId },
      include: {
        positions: { include: { position: true } }, // ดึงตำแหน่งที่ลากใส่มาด้วย
      },
      orderBy: { sortOrder: 'asc' },
    });
    return departments; // หน้าบ้านเอาไปแปลงเป็น Tree หรือใช้ Flat Array ก็ได้
  }

  // =========================================================
  // 🌟 บันทึกโครงสร้างแบบ Draft (Save Draft)
  // =========================================================
  async saveDraftTree(companyId: number, versionId: number, dto: SaveOrgTreeDto) {
    // 1. เช็คก่อนว่า Version นี้เป็น DRAFT จริงๆ (ถ้า Publish แล้วห้ามแก้)
    const version = await this.prisma.hrOrgStructureVersion.findUnique({
      where: { id: versionId, companyId },
    });
    if (!version || version.status !== 'DRAFT') {
      throw new BadRequestException('สามารถบันทึกได้เฉพาะสถานะ DRAFT เท่านั้น');
    }

    // 2. เคลียร์ข้อมูลแผนกและตำแหน่งจำลอง "ของเวอร์ชันนี้" ทิ้งให้หมดก่อน (เพื่อวาดใหม่ทั้งหมดจากที่หน้าบ้านส่งมา)
    await this.prisma.hrDepartmentVersion.deleteMany({
      where: { versionId, companyId },
    });

    // 3. วนลูปสร้างแผนกใหม่ตามที่หน้าบ้านส่งมา (ใช้ Transaction)
    return this.prisma.$transaction(async (tx) => {
      const idMap = new Map(); // เก็บ Mapping ระหว่าง refId ของหน้าบ้าน กับ id จริงใน DB

      // Step A: สร้างแผนกทั้งหมดก่อน (ยังไม่ผูกแม่ลูก)
      for (const dept of dto.departments) {
        const newDept = await tx.hrDepartmentVersion.create({
          data: {
            companyId,
            versionId,
            originalDeptId: dept.originalDeptId,
            code: dept.code,
            name: dept.name,
            sortOrder: dept.sortOrder || 0,
          },
        });
        idMap.set(dept.refId, newDept.id); // จดจำ ID ไว้
      }

      // Step B: วนลูปอีกรอบ เพื่ออัปเดต parentId และใส่ตำแหน่ง (Positions)
      for (const dept of dto.departments) {
        const realId = idMap.get(dept.refId);
        const realParentId = dept.parentId ? idMap.get(dept.parentId) : null;

        await tx.hrDepartmentVersion.update({
          where: { id: realId },
          data: {
            parentId: realParentId, // ผูกแม่ลูกเรียบร้อย
            positions: dept.positions?.length ? {
              create: dept.positions.map(p => ({
                companyId,
                positionId: p.positionId,
                maxHeadcount: p.maxHeadcount || null,
              }))
            } : undefined
          }
        });
      }
      return { message: 'บันทึกโครงสร้างฉบับร่างสำเร็จ' };
    });
  }

  


  // =========================================================
  // 🌟 ดึงโครงสร้างแผนกและอัตรากำลังที่ใช้งานจริง ณ วันที่ระบุ (Effective Date)
  // =========================================================
  async getActiveStructureByDate(companyId: number, effectiveDateStr?: string) {
    // 1. หาวันที่เป้าหมาย (ถ้าไม่ส่งมา ให้ใช้วันนี้)
    const targetDate = effectiveDateStr ? new Date(effectiveDateStr) : new Date();
    const targetYear = targetDate.getFullYear();

    // 2. ค้นหา Version ที่มีสถานะ PUBLISHED ในปีปฏิทินนั้น
    // (หมายเหตุ: สมมติว่าตาราง HrOrgStructureVersion เชื่อมกับ Calendar แล้วเช็คปีได้
    // หากโครงสร้างตาราง Calendar ของคุณกฤษฎาอิงตามวันที่ ให้แก้เงื่อนไข where ตรงนี้ได้เลยครับ)
    const publishedVersion = await this.prisma.hrOrgStructureVersion.findFirst({
      where: {
        companyId,
        status: 'PUBLISHED',
        // ตัวอย่างการเชื่อมโยงกับปฏิทิน:
        // calendar: { year: targetYear } 
      },
      orderBy: { updatedAt: 'desc' }, // เอาตัวล่าสุดที่ประกาศใช้
    });

    // 3. 🛡️ Fallback: ถ้าในปีนั้นยังไม่มีโครงสร้างใดถูก Publish เลย (หรือเพิ่งเปิดบริษัท)
    // ระบบจะไปดึง Master Data จากตาราง HrDepartment หลักมาให้ใช้งานแก้ขัดก่อน
    if (!publishedVersion) {
      const masterDepartments = await this.prisma.hrDepartment.findMany({
        where: { companyId },
        include: {
          allowedPositions: {
            include: { position: true },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      // แปลงหน้าตาข้อมูลให้เหมือนกับฝั่ง Version เพื่อให้หน้าบ้านใช้โค้ดชุดเดียวกันได้
      return masterDepartments.map(dept => ({
        id: dept.id,
        isMasterData: true, // 🚩 บอกหน้าบ้านว่านี่คือข้อมูลจาก Master นะ ไม่ใช่ Version
        code: dept.code,
        name: dept.name,
        parentId: dept.parentId,
        positions: dept.allowedPositions.map(ap => ({
          positionId: ap.positionId,
          maxHeadcount: ap.maxHeadcount,
          position: ap.position,
        })),
      }));
    }

    // 4. ✅ เจอโครงสร้างที่ PUBLISHED แล้ว ดึงแผนกจำลองและตำแหน่งจำลองออกมาให้หมด
    const departmentVersions = await this.prisma.hrDepartmentVersion.findMany({
      where: {
        companyId,
        versionId: publishedVersion.id,
      },
      include: {
        positions: {
          include: { position: true }, // ดึงรายละเอียดตำแหน่ง (ชื่อ, ระดับ) มาด้วย
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return departmentVersions.map(dept => ({
      id: dept.originalDeptId || dept.id, // ใช้ originalDeptId เพื่อให้ผูกกับประวัติพนักงานได้
      isMasterData: false,
      versionId: publishedVersion.id,
      code: dept.code,
      name: dept.name,
      parentId: dept.parentId,
      positions: dept.positions.map(pv => ({
        positionId: pv.positionId,
        maxHeadcount: pv.maxHeadcount,
        position: pv.position,
      })),
    }));
  }

  
  // =========================================================
  // 📊 สรุปอัตรากำลังพล (Manpower Summary: Plan vs Actual)
  // =========================================================
  // ในไฟล์ org-structure-version.service.ts

async getManpowerSummary(companyId: number, versionId: number) {
  // 1. ดึงแผนกและตำแหน่งตามเวอร์ชันที่เลือก
  const versionDepts = await this.prisma.hrDepartmentVersion.findMany({
    where: { companyId, versionId },
    include: {
      positions: {
        include: { position: true }
      }
    },
    orderBy: { sortOrder: 'asc' }
  });

  // 2. ดึงพนักงานที่ยังทำงานอยู่ทั้งหมดของบริษัท
  const activeEmployees = await this.prisma.hrEmployee.findMany({
    where: {
      companyId,
      isActive: true,
      status: { notIn: ['RESIGNED', 'TERMINATED'] }
    },
    select: { 
      id: true, 
      employeeCode: true, 
      firstName: true, 
      lastName: true, 
      profileImageUrl: true,
      hrDepartmentId: true, // ใช้เช็คสังกัดหลัก
      positionId: true 
    }
  });

  const summaryData: any[] = []; 

  for (const dept of versionDepts) {
    const actualDeptId = dept.originalDeptId; 

    for (const posVersion of dept.positions) {
      const planHeadcount = posVersion.maxHeadcount;
      
      // 🌟 กรองหาพนักงานที่ "นั่งเก้าอี้" ในตำแหน่งนี้ของแผนกนี้จริงๆ
      const employeesInSlot = activeEmployees.filter(emp => 
        emp.hrDepartmentId === actualDeptId && 
        emp.positionId === posVersion.positionId
      );

      const actualHeadcount = employeesInSlot.length;
      let diff = 0;
      let status = 'UNLIMITED';

      if (planHeadcount !== null) {
        diff = actualHeadcount - planHeadcount;
        if (diff < 0) status = 'VACANT';
        else if (diff > 0) status = 'OVER';
        else status = 'FULL';
      }

      summaryData.push({
        departmentId: dept.id,
        departmentCode: dept.code,
        departmentName: dept.name,
        positionId: posVersion.positionId,
        positionName: posVersion.position?.name || 'ไม่ระบุ', 
        plan: planHeadcount,
        actual: actualHeadcount,
        diff: diff,
        status: status,
        // 🌟 ส่งรายชื่อคนทำงานจริงไปให้หน้าบ้านวาด Avatar
        employees: employeesInSlot.map(e => ({
          id: e.id,
          code: e.employeeCode,
          name: `${e.firstName} ${e.lastName}`,
          avatar: e.profileImageUrl
        }))
      });
    }
  }

  return summaryData;
}


}