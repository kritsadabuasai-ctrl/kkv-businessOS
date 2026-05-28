// 🌟 1. เพิ่มการ Import forwardRef และ Inject ที่ด้านบนสุดของไฟล์ร่วมกับตัวอื่น
import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { WfRequestService } from '../../workflow/requests/wf-request.service'; // 🌟 เช็ก Path ให้ตรงกับโปรเจกต์ด้วยนะครับ

import { PrismaService } from '../../../prisma/prisma.service'; 
import { CreateFolderDto } from '../dto/create-folder.dto';
import { UpdateFolderDto } from '../dto/update-folder.dto'; // 🌟 Import DTO สำหรับอัปเดตแฟ้ม
import { StorageService } from '../../sys/storage/storage.service'; // 🌟 Import เพิ่ม



@Injectable()
export class DocFolderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    
    // 🌟 2. Inject WfRequestService เข้ามาใช้งานใน Class
    @Inject(forwardRef(() => WfRequestService))
    private readonly wfRequestService: WfRequestService 
  ) {}

// ==========================================
  // 📁 1. สร้างโฟลเดอร์ใหม่ (รองรับ SaaS Gating)
  // ==========================================
  async createFolder(companyId: number, dto: CreateFolderDto | any) {
    
    // 🌟🌟 [SaaS Logic] ดักจับฟีเจอร์ Enterprise (สายอนุมัติการลบ)
    if (dto.deleteWorkflowId) {
      const hasEnterpriseFeature = await this.prisma.orgSubscription.findFirst({
        where: { 
          companyId: companyId, 
          module: { code: 'MOD_DOC_SECURE_DELETE' }, // เช็คสิทธิ์การใช้ Module Enterprise
          status: 'ACTIVE' 
        }
      });

      if (!hasEnterpriseFeature) {
        throw new ForbiddenException('ฟีเจอร์ "สายอนุมัติการทำลายเอกสาร" สงวนสิทธิ์สำหรับแพ็กเกจ Enterprise เท่านั้น กรุณาอัปเกรดแพ็กเกจของคุณ');
      }
    }

    const existing = await this.prisma.docFolder.findFirst({
      where: {
        companyId: companyId,
        parentId: dto.parentId || null,
        name: dto.name,
      },
    });

    if (existing) throw new BadRequestException('ชื่อโฟลเดอร์นี้มีอยู่แล้วในตำแหน่งเดียวกัน');

    return this.prisma.docFolder.create({
      data: {
        companyId: companyId,
        name: dto.name,
        description: dto.description,
        parentId: dto.parentId,
        isWorkspace: dto.isWorkspace || false,
        defaultWorkflowId: dto.defaultWorkflowId || null,
        deleteWorkflowId: dto.deleteWorkflowId || null, 
      },
    });
  }

// ==========================================
  // 🌟 [Full Update] ดึงโครงสร้างโฟลเดอร์พร้อมสถานะการล็อก (Security 2 Layers)
  // ==========================================
  async getFolderTree(companyId: number, roleId: number, isHQ: boolean = false, userId: number = 0) {
    const cId = Number(companyId);
    const rId = Number(roleId);
    const uId = Number(userId);

    // 1. ดึงโฟลเดอร์ทั้งหมดระดับบนสุด (Root) ของบริษัทนั้นๆ
    // รวมถึงดึงข้อมูลสิทธิ์ และลูกๆ ออกมาด้วย
    const folders = await this.prisma.docFolder.findMany({
      where: { companyId: cId, parentId: null },
      include: {
        accessRoles: true, // ตารางสิทธิ์
        children: {
          include: { 
            accessRoles: true,
            children: { include: { accessRoles: true } } // รองรับ Sub-folder อีกชั้น
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const now = new Date();

    /**
     * 🛡️ Helper ฟังก์ชันสำหรับเช็คสิทธิ์เข้าถึง (hasAccess)
     */
    const checkAccess = (folder: any): boolean => {
      // กฎข้อ 1: ถ้าเป็น Super Admin (Role ID: 1) หรือบัญชีระดับ HQ ให้เข้าได้ทุกโฟลเดอร์เสมอ
      if (rId === 1 || isHQ) return true;

      // กฎข้อ 2: ถ้าโฟลเดอร์นั้นไม่ได้มีการตั้งค่าสิทธิ์ใดๆ ไว้เลย (Array ว่าง) ถือว่าเป็น Public ให้ทุกคนเห็น
      if (!folder.accessRoles || folder.accessRoles.length === 0) return true;

      // กฎข้อ 3: เช็คสิทธิ์ในตารางสิทธิ์ (ต้องตรงกับ Role หรือตรงกับ User เฉพาะคน และต้องยังไม่หมดอายุ)
      return folder.accessRoles.some((acc: any) => {
        // ถ้ามีการระบุวันหมดอายุ (expiresAt) และปัจจุบันเลยกำหนดนั้นมาแล้ว ให้ถือว่าไม่มีสิทธิ์
        if (acc.expiresAt && new Date(acc.expiresAt) < now) return false;
        
        // ตรวจสอบว่า Role ID ตรงกัน หรือ User ID ตรงกัน และมีสิทธิ์ canView
        return (acc.roleId === rId || acc.userId === uId) && acc.canView;
      });
    };

    /**
     * 🔄 ฟังก์ชัน Recursive สำหรับแปะสถานะ isLocked ให้โฟลเดอร์และลูกๆ
     */
    const mapFolderStatus = (folder: any) => {
      const isLocked = !checkAccess(folder);
      
      return {
        ...folder,
        isLocked: isLocked, // 🌟 หน้าบ้านใช้ตัวนี้เพื่อวาดรูปแม่กุญแจ 🔒
        // ทำซ้ำสำหรับลูกๆ (Recursive)
        children: folder.children ? folder.children.map((child: any) => mapFolderStatus(child)) : []
      };
    };

    // 2. ประมวลผลข้อมูลทั้งหมดและส่งกลับ
    return folders.map(folder => mapFolderStatus(folder));
  }

// ==========================================
  // ✏️ 2. แก้ไขข้อมูลแฟ้ม (Full Security Check)
  // ==========================================
  async updateFolder(companyId: number, folderId: number, userId: number, dto: UpdateFolderDto | any) { 
    const folder = await this.prisma.docFolder.findFirst({
      where: { id: folderId, companyId: companyId }
    });

    if (!folder) throw new NotFoundException('ไม่พบโฟลเดอร์ที่ระบุ หรือคุณไม่มีสิทธิ์');

    // 🌟 [SaaS Logic] ตรวจสอบสิทธิ์เฉพาะตอนที่มีการ "ขอตั้งค่า Workflow ลบใหม่" เท่านั้น
    if (dto.deleteWorkflowId && dto.deleteWorkflowId !== folder.deleteWorkflowId) {
      const hasEnterpriseFeature = await this.prisma.orgSubscription.findFirst({
        where: { 
          companyId: companyId, 
          module: { code: 'MOD_DOC_SECURE_DELETE' },
          status: 'ACTIVE' 
        }
      });

      if (!hasEnterpriseFeature) {
        throw new ForbiddenException('ฟีเจอร์ "สายอนุมัติการทำลายเอกสาร" สงวนสิทธิ์สำหรับแพ็กเกจ Enterprise เท่านั้น กรุณาอัปเกรดแพ็กเกจของคุณ');
      }
    }

    // ตรวจสอบชื่อซ้ำ
    if (dto.name && dto.name !== folder.name) {
      const existing = await this.prisma.docFolder.findFirst({
        where: {
          companyId: companyId,
          parentId: folder.parentId, 
          name: dto.name,
        },
      });
      if (existing) throw new BadRequestException('ชื่อโฟลเดอร์นี้มีอยู่แล้วในตำแหน่งเดียวกัน');
    }

    // 🛑 [SECURITY DOWNGRADE CHECK] 🛑
    if (folder.isWorkspace === true && dto.isWorkspace === false) {
      
      // 🔒 1. [เพิ่มใหม่] ตรวจสอบว่ามีเอกสารข้างใน (หรือในโฟลเดอร์ย่อย) ติด Workflow อยู่หรือไม่
      const allFolderIdsToCheck = await this.getAllFolderIdsRecursive(folderId);
      
      const lockedFilesCount = await this.prisma.docFile.count({
        where: { 
          folderId: { in: allFolderIdsToCheck }, 
          companyId: companyId,
          wfRequest: {
            // เช็กสถานะคำร้องของไฟล์นั้นๆ ว่ากำลังทำงานอยู่หรือไม่
            status: { in: ['PENDING', 'IN_PROGRESS'] } 
          }
        }
      });

      // ถ้ามีไฟล์ค้างอยู่ ให้ดีด Error กลับทันที ห้ามทำอะไรต่อเด็ดขาด
      if (lockedFilesCount > 0) {
        throw new BadRequestException(`ไม่สามารถปิดโหมด Workspace ได้ เนื่องจากมีเอกสารในแฟ้มนี้ (หรือแฟ้มย่อย) จำนวน ${lockedFilesCount} รายการ กำลังอยู่ในกระบวนการรออนุมัติ กรุณาจัดการเอกสารให้เสร็จสิ้นก่อน`);
      }

      // 📋 2. ถ้าไม่มีไฟล์ค้าง และแฟ้มนี้มี Workflow คุมอยู่ ให้ส่งตัวแฟ้มเองเข้า Workflow
      if (folder.defaultWorkflowId) {
        const request = await this.prisma.wfRequest.create({
          data: {
            companyId: companyId,
            workflowId: folder.defaultWorkflowId, 
            requesterId: userId,
            businessType: 'FOLDER_SECURITY_DOWNGRADE', 
            businessId: String(folderId), 
            topic: `ขออนุมัติปิดโหมด Workspace ของโฟลเดอร์: ${dto.name || folder.name}`, 
            data: { 
              name: dto.name || folder.name,
              description: dto.description ?? folder.description,
              isWorkspace: false,
              defaultWorkflowId: dto.defaultWorkflowId ?? folder.defaultWorkflowId,
              deleteWorkflowId: dto.deleteWorkflowId ?? folder.deleteWorkflowId
            }
          }
        });

        return {
          success: true,
          message: 'ระบบได้ส่งคำร้องขอปิดโหมด Workspace เข้าสู่สายอนุมัติเรียบร้อยแล้ว',
          workflowRequestId: request.id,
          status: 'PENDING_APPROVAL'
        };
      }
    }

    // 🔄 กรณีปกติ: อัปเดตลงฐานข้อมูลทันที
    return this.prisma.docFolder.update({
      where: { id: folderId },
      data: {
        name: dto.name,
        description: dto.description,
        isWorkspace: dto.isWorkspace,
        defaultWorkflowId: dto.defaultWorkflowId,
        deleteWorkflowId: dto.deleteWorkflowId, 
      },
    });
  }

 



  // ==========================================
  // 🌟 [แก้ไข] อัปเดตสิทธิ์โฟลเดอร์ (รับ Rules ที่มีทั้ง Role และ User + Access Guard)
  // ==========================================
  async updateFolderAccess(companyId: number, folderId: number, userId: number, roleId: number, rules: any[]) {
    const folder = await this.prisma.docFolder.findFirst({
      where: { id: folderId, companyId: companyId }
    });

    if (!folder) throw new NotFoundException('ไม่พบโฟลเดอร์ที่ระบุ หรือคุณไม่มีสิทธิ์');

    // 🛡️ 1. ตรวจสอบสิทธิ์การเป็น "ผู้ดูแล" (Admin / Workspace Manager)
    let canManageAccess = false;

    // กฎข้อที่ 1: เป็น Super Admin ของระบบ (มีอำนาจสูงสุด ทะลุได้ทุกโฟลเดอร์)
    if (roleId === 1) {
      canManageAccess = true;
    } 
    // กฎข้อที่ 2: เช็คสิทธิ์ 'canDelete' ในโฟลเดอร์นี้
    else {
      // ดึง Role ทั้งหมดที่ User คนนี้ถืออยู่ ณ ปัจจุบัน
      const userRoles = await this.prisma.secUserRole.findMany({
        where: { userId: userId, companyId: companyId }
      });
      const myRoleIds = userRoles.map(ur => ur.roleId);
      if (roleId > 0 && !myRoleIds.includes(roleId)) myRoleIds.push(roleId);

      // ค้นหาว่าปัจจุบัน User หรือ Role ที่เขาถืออยู่ ได้รับสิทธิ์ 'canDelete' หรือไม่
      const highestAccess = await this.prisma.docFolderAccess.findFirst({
        where: {
          folderId: folderId,
          companyId: companyId,
          OR: [
            { userId: userId },
            { roleId: { in: myRoleIds } }
          ],
          canDelete: true // 🌟 ใช้สิทธิ์ Delete เป็นตัวแทนของคำว่า "Manager ของโฟลเดอร์นี้"
        }
      });

      if (highestAccess) {
        canManageAccess = true;
      }
    }

    // 🚨 ถ้าไม่ใช่ Super Admin และไม่ได้มีสิทธิ์ canDelete ในโฟลเดอร์นี้ -> เตะออกทันที
    if (!canManageAccess) {
      throw new ForbiddenException('ไม่อนุญาตให้แก้ไขสิทธิ์ (สงวนสิทธิ์เฉพาะผู้ดูแลระบบ หรือผู้จัดการที่มีสิทธิ์ลบข้อมูลในโฟลเดอร์นี้เท่านั้น)');
    }

    // ==========================================
    // ✅ 2. ถ้าผ่านด่านมาได้ ให้ทำการเคลียร์สิทธิ์เดิมและบันทึกสิทธิ์ใหม่
    // ==========================================
    await this.prisma.docFolderAccess.deleteMany({ where: { folderId } });

    if (rules && rules.length > 0) {
      const accessData = rules.map((rule: any) => ({
        folderId,
        companyId: companyId,
        roleId: rule.roleId || null,
        userId: rule.userId || null,
        canView: rule.canView || false,
        canUpload: rule.canUpload || false,
        canDelete: rule.canDelete || false,
        expiresAt: rule.expiresAt ? new Date(rule.expiresAt) : null,
      }));
      await this.prisma.docFolderAccess.createMany({ data: accessData });
    }

    return { message: 'อัปเดตสิทธิ์การเข้าถึงโฟลเดอร์เรียบร้อยแล้ว' };
  }

  // ==========================================
  // 🔍 ฟังก์ชันช่วย: หาแฟ้มย่อยทั้งหมดแบบ Recursive
  // ==========================================
  private async getAllFolderIdsRecursive(folderId: number): Promise<number[]> {
    const folderIds: number[] = [];
    let currentLevelIds = [folderId];

    // ไล่ทะลวงลงไปทีละชั้นจนกว่าจะไม่เจอโฟลเดอร์ย่อย
    while (currentLevelIds.length > 0) {
      folderIds.push(...currentLevelIds);
      const children = await this.prisma.docFolder.findMany({
        where: { parentId: { in: currentLevelIds } },
        select: { id: true }
      });
      currentLevelIds = children.map(c => c.id);
    }
    
    // คืนค่าแบบกลับหลัง (จากแฟ้มลูกสุด วิ่งขึ้นมาหาแฟ้มหลัก) เพื่อป้องกัน Error ตอนไล่ลบ
    return folderIds.reverse(); 
  }

// ==========================================
  // 🚚 ฟังก์ชันย้ายโฟลเดอร์ (SharePoint Guard + Look-Ahead Auto-Approve)
  // ==========================================
  async moveFolder(companyId: number, folderId: number, userId: number, roleId: number, newParentId: number | null) {
    // 1. ตรวจสอบโฟลเดอร์ต้นทาง
    const folderToMove = await this.prisma.docFolder.findFirst({
      where: { id: folderId, companyId: companyId }
    });

    if (!folderToMove) throw new NotFoundException('ไม่พบโฟลเดอร์ที่ต้องการย้าย หรือคุณไม่มีสิทธิ์');

    // ถ้าตำแหน่งใหม่เป็นตำแหน่งเดิม (ไม่ได้ย้ายจริง)
    if (folderToMove.parentId === newParentId) {
      return { message: 'โฟลเดอร์อยู่ที่ตำแหน่งนี้อยู่แล้ว' };
    }

    // 🛑 2. ป้องกันไม่ให้ย้ายโฟลเดอร์ไปใส่ตัวเอง หรือใส่ในลูกของตัวเอง (Circular Dependency)
    if (newParentId) {
      if (newParentId === folderId) {
        throw new BadRequestException('ไม่สามารถย้ายโฟลเดอร์ไปไว้ในตัวมันเองได้');
      }
      const allChildrenIds = await this.getAllFolderIdsRecursive(folderId);
      if (allChildrenIds.includes(newParentId)) {
        throw new BadRequestException('ไม่สามารถย้ายโฟลเดอร์หลักเข้าไปไว้ในโฟลเดอร์ย่อยของตัวเองได้');
      }
    }

    // --- 🛡️ 3. เช็กสิทธิ์ดึงโฟลเดอร์ออกจาก "ตำแหน่งเดิม" ---
    let hasSourceAccess = false;
    if (roleId === 1) {
      hasSourceAccess = true;
    } else {
      hasSourceAccess = await this.hasFolderAccess(folderId, userId, roleId, 'canDelete');
    }
    if (!hasSourceAccess) throw new ForbiddenException('คุณไม่มีสิทธิ์ดึงโฟลเดอร์นี้ออกจากตำแหน่งเดิม');

    // --- 🛡️ 4. เช็กสิทธิ์เอาโฟลเดอร์ไปวางใน "โฟลเดอร์ปลายทางใหม่" ---
    if (newParentId) {
      let hasTargetAccess = false;
      if (roleId === 1) {
        hasTargetAccess = true;
      } else {
        hasTargetAccess = await this.hasFolderAccess(newParentId, userId, roleId, 'canUpload');
      }
      if (!hasTargetAccess) throw new ForbiddenException('คุณไม่มีสิทธิ์นำโฟลเดอร์มาวางในโฟลเดอร์ปลายทางนี้');
    }

    // 🛑 5. [CRITICAL LOGIC] ป้องกันการย้าย ถ้ามีไฟล์ด้านใน (รวมถึงแฟ้มลูก) ติด Workflow อยู่
    const allFolderIdsToCheck = await this.getAllFolderIdsRecursive(folderId);
    const lockedFilesCount = await this.prisma.docFile.count({
      where: { 
        folderId: { in: allFolderIdsToCheck }, 
        companyId: companyId,
        wfRequest: {
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        }
      }
    });

    if (lockedFilesCount > 0) {
      throw new BadRequestException(`ไม่สามารถย้ายโฟลเดอร์นี้ได้ เนื่องจากมีเอกสารด้านใน จำนวน ${lockedFilesCount} รายการ กำลังอยู่ในกระบวนการรออนุมัติ`);
    }

    // 🔄 6. ทำการอัปเดตตำแหน่งย้ายจริงลงฐานข้อมูล
    await this.prisma.docFolder.update({
      where: { id: folderId },
      data: { parentId: newParentId }
    });

    // =========================================================
    // 🚦 7. ระบบตรวจสอบสายอนุมัติการย้าย (Workflow Integration)
    // =========================================================
    // 🌟 [แก้ไขจุดนี้] ระบุ Type ให้ชัดเจนเพื่อบอก TS ว่า ตัวแปรนี้ใส่ number ได้นะ ไม่ใช่แค่ null
    let targetWorkflowId: number | null = null;

    // หาดูว่าโฟลเดอร์ปลายทางใหม่ มีการผูกสายอนุมัติเริ่มต้นไว้ไหม
    if (newParentId) {
      const targetFolder = await this.prisma.docFolder.findUnique({
        where: { id: newParentId },
        select: { defaultWorkflowId: true }
      });
      targetWorkflowId = targetFolder?.defaultWorkflowId ?? null;
    }

    // หากแฟ้มปลายทางไม่มีสายอนุมัติเฉพาะ ให้วิ่งไปหาจาก Module Mapping ส่วนกลาง (รหัส DOC_MOVE)
    if (!targetWorkflowId) {
      const mapping = await this.prisma.wfModuleMapping.findFirst({
        where: { companyId, moduleCode: 'DOC_MOVE', isActive: true }
      });
      targetWorkflowId = mapping?.workflowId ?? null;
    }

    // 🚀 8. ถ้าระบบตรวจเจอสายอนุมัติ ให้เตะเข้า Workflow Engine ทันที
    if (targetWorkflowId) {
      console.log(`[Move Folder] พบสายอนุมัติ ID ${targetWorkflowId} สำหรับการย้ายแฟ้ม ${folderId} กำลังส่งประมวลผล...`);

      const request: any = await this.wfRequestService.create(companyId, userId, {
        moduleCode: 'DOC_MOVE',
        workflowId: targetWorkflowId,
        businessId: String(folderId),
        topic: `ขออนุมัติย้ายโฟลเดอร์: ${folderToMove.name}`,
      } as any);

      if (request.status === 'APPROVED') {
        return { 
          message: 'ย้ายโฟลเดอร์สำเร็จ (ระบบอนุมัติอัตโนมัติเนื่องจากท่านเป็นผู้มีอำนาจในสายงานนี้)', 
          isPendingApproval: false 
        };
      }

      return { 
        message: 'ส่งคำขออนุมัติย้ายโฟลเดอร์เข้าสู่กระบวนการตรวจสอบเรียบร้อยแล้ว', 
        isPendingApproval: true,
        workflowRequestId: request.id
      };
    }

    return { message: 'ย้ายโฟลเดอร์เรียบร้อยแล้ว (ไม่มีเงื่อนไขสายอนุมัติบังคับ)', isPendingApproval: false };
  }



  // ==========================================
  // 🔍 Helper 1: เช็กสิทธิ์โฟลเดอร์แบบ Multi-Role (ลอจิกเดียวกับ DocFile)
  // ==========================================
  private async hasFolderAccess(
    folderId: number | null, 
    userId: number, 
    roleId: number, 
    permissionField: 'canView' | 'canUpload' | 'canDelete'
  ): Promise<boolean> {
    if (!folderId) return false;

    const folder = await this.prisma.docFolder.findUnique({
      where: { id: folderId }
    });
    if (!folder) return false;

    // ดึง Role ทั้งหมดที่ User ถืออยู่มาเช็ก
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId: userId }
    });
    const myRoleIds = userRoles.map(ur => ur.roleId);

    if (roleId > 0 && !myRoleIds.includes(roleId)) {
      myRoleIds.push(roleId);
    }

    const explicitAccess = await this.prisma.docFolderAccess.findFirst({
      where: {
        folderId,
        OR: [
          { userId: userId },
          { roleId: { in: myRoleIds } }
        ]
      }
    });

    if (explicitAccess) return !!explicitAccess[permissionField];
    if (folder.isWorkspace || !folder.parentId) return false;

    return this.hasFolderAccess(folder.parentId, userId, roleId, permissionField);
  }


  // ==========================================
  // 🔍 Helper 2: เช็กว่าโฟลเดอร์นี้อยู่ใต้สาย Workspace หรือไม่
  // ==========================================
  private async checkIsWorkspaceTree(folderId: number | null): Promise<boolean> {
    let currentFolderId = folderId;
    while (currentFolderId) {
      const folder = await this.prisma.docFolder.findUnique({
        where: { id: currentFolderId },
        select: { parentId: true, isWorkspace: true }
      });
      if (!folder) break;
      if (folder.isWorkspace) return true; 
      currentFolderId = folder.parentId; 
    }
    return false; 
  }

  // ==========================================
  // 🗑️ 2. ฟังก์ชันลบโฟลเดอร์ (Enterprise Guard: Multi-Role + Workflow Lock)
  // ==========================================
  async deleteFolder(companyId: number, folderId: number, userId: number = 0, roleId: number = 0) {
    // 1. ค้นหาโฟลเดอร์เป้าหมาย
    const folder = await this.prisma.docFolder.findUnique({
      where: { id: folderId, companyId: companyId }
    });

    if (!folder) {
      throw new NotFoundException('ไม่พบโฟลเดอร์ที่ต้องการลบ หรือโฟลเดอร์ถูกลบไปแล้ว');
    }

    // --- 🛡️ ด่านที่ 1: ตรวจสอบสิทธิ์การลบ (Access Control แบบดึง Role จริงจาก DB) ---
    const isWorkspaceTree = await this.checkIsWorkspaceTree(folderId);
    let hasAccess = false;

    if (userId === 0) {
      hasAccess = true; // ให้ระบบสั่งลบได้ (เช่น Auto-delete)
    } else {
      // ไม่ว่าจะเป็น Workspace หรือ Personal ถ้าจะลบแฟ้ม ต้องมีสิทธิ์ canDelete ที่สืบทอดมา 
      // (เนื่องจากแฟ้มไม่มีฟิลด์ uploadedBy เหมือนเอกสาร จึงต้องยึดตารางสิทธิ์เป็นหลัก)
      hasAccess = await this.hasFolderAccess(folderId, userId, roleId, 'canDelete');
    }

    if (!hasAccess) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ลบโฟลเดอร์นี้ (กรุณาตรวจสอบสิทธิ์ใน Permission Matrix)');
    }

    // 2. ดึง ID ของโฟลเดอร์นี้และลูกหลานทั้งหมด
    const allFolderIds = await this.getChildFolderIds(folderId);
    allFolderIds.push(folderId);

    // --- 🛑 ด่านที่ 2: ตรวจสอบเอกสารภายใน ว่ามี Workflow ค้างอยู่หรือไม่ ---
    const lockedFilesCount = await this.prisma.docFile.count({
      where: { 
        folderId: { in: allFolderIds }, 
        companyId: companyId,
        wfRequest: {
          status: { in: ['PENDING', 'IN_PROGRESS'] } // ล็อกห้ามลบทันทีถ้ามีไฟล์ค้าง
        }
      }
    });

    if (lockedFilesCount > 0) {
      throw new BadRequestException(`ไม่สามารถลบโฟลเดอร์ได้ เนื่องจากมีเอกสารด้านใน (หรือในโฟลเดอร์ย่อย) จำนวน ${lockedFilesCount} รายการ กำลังอยู่ในกระบวนการรออนุมัติ`);
    }

    // 3. ดึงไฟล์ทั้งหมดที่อยู่ในสายโฟลเดอร์นี้เพื่อเตรียมล้างข้อมูลขยะ (Storage, KB, etc.)
    const filesToDelete = await this.prisma.docFile.findMany({
      where: { folderId: { in: allFolderIds }, companyId: companyId },
      include: { versions: true, wfRequest: true } 
    });

    // 4. วนลูปเคลียร์ไฟล์ (ล้าง Storage, ล้าง Knowledge Base, ล้าง Workflow)
    if (filesToDelete && filesToDelete.length > 0) {
      for (const file of filesToDelete) {
        // ล้าง Vector Database / Knowledge Base
        if (file.knowledgeBaseId) {
          await this.prisma.intKnowledgeBase.delete({
            where: { id: file.knowledgeBaseId }
          }).catch(() => null); 
        }

        // คืนโควตา Storage 
        if (file.versions && file.versions.length > 0) {
          for (const ver of file.versions) {
            if (ver.url) {
              await this.storageService.restoreQuota(companyId, ver.url).catch(() => null);
            }
          }
        }
      }
    }

    // ==========================================
    // 🧹 ขั้นตอนการ Hard Delete ข้อมูลจริงจาก Database
    // ==========================================

    // 5. ลบเอกสารทั้งหมดที่อยู่ภายใต้โฟลเดอร์และโฟลเดอร์ย่อย
    if (filesToDelete.length > 0) {
      await this.prisma.docFile.deleteMany({
        where: { folderId: { in: allFolderIds }, companyId: companyId }
      });
    }

    // 6. ลบสิทธิ์การเข้าถึงโฟลเดอร์ (DocFolderAccess) ทั้งตระกูลทิ้ง
    await this.prisma.docFolderAccess.deleteMany({
      where: { folderId: { in: allFolderIds } }
    }).catch(() => null);

    // 7. ลบตัวโฟลเดอร์ (ลบทั้งก้อนจาก allFolderIds)
    await this.prisma.docFolder.deleteMany({
      where: { id: { in: allFolderIds }, companyId: companyId }
    });

    return {
      success: true,
      message: 'ลบโฟลเดอร์และเอกสารภายในสำเร็จเรียบร้อยแล้ว'
    };
  }



  // ==========================================
  // 🔍 Helper Function: ดึง ID โฟลเดอร์ลูกทั้งหมด
  // ==========================================
  private async getChildFolderIds(parentId: number): Promise<number[]> {
    const children = await this.prisma.docFolder.findMany({
      where: { parentId: parentId },
      select: { id: true }
    });
    
    let ids = children.map(c => c.id);
    for (const child of children) {
      const grandChildrenIds = await this.getChildFolderIds(child.id);
      ids = [...ids, ...grandChildrenIds];
    }
    return ids;
  }
}