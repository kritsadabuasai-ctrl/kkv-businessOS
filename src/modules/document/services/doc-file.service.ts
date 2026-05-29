import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, UnauthorizedException,ForbiddenException,Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; 
import { UploadFileDto } from '../dto/upload-file.dto';
import { UpdateFileAccessDto } from '../dto/update-file-access.dto';
import { StorageService } from '../../sys/storage/storage.service';
import { CreateShareLinkDto } from '../dto/create-share-link.dto';
import { GoogleGenerativeAI } from '@google/generative-ai';
// (สมมติว่าคุณสร้าง UnlockFileDto ไว้แล้วตามคำแนะนำก่อนหน้า)
import { UnlockFileDto } from '../dto/unlock-file.dto'; 
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateSignatureRequestDto } from '../dto/signature-request.dto';
import { WfRequestService } from '../../workflow/requests/wf-request.service'; // ตรวจสอบ Path ให้ตรงกับโปรเจกต์คุณด้วยนะครับ
import { AiQuotasService } from '../../int/ai-quotas/ai-quotas.service'                        

import { StreamableFile } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';



@Injectable()
export class DocFileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService ,
    @Inject(forwardRef(() => WfRequestService))
    private readonly wfRequestService: WfRequestService ,
    private readonly aiQuotasService: AiQuotasService
  ) {}


  // =========================================================
  // 🛡️ คำนวณ SHA-256 Hash ของไฟล์
  // =========================================================
  private calculateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // =========================================================
  // 🛡️ ฟังก์ชันตรวจสอบความแท้จริงของเอกสาร (Tamper-Proof Check)
  // =========================================================
  async verifyDocumentAuthenticity(companyId: number, fileBuffer: Buffer) {
    // 1. คำนวณลายนิ้วมือ (Hash) ของไฟล์ที่อัปโหลดเข้ามาตรวจสอบ
    const uploadedHash = this.calculateFileHash(fileBuffer);

    // 2. ค้นหาในประวัติการส่งออกไฟล์
    const traceLog = await this.prisma.logDocumentTrace.findFirst({
      where: { fileHash: uploadedHash, companyId },
      include: {
        originalFile: { select: { fileName: true } },
        downloadedBy: { select: { fullName: true, username: true } } // ปรับฟิลด์ให้ตรงกับตาราง User ของคุณ
      }
    });

    // 3. ถ้าไม่เจอ แปลว่าไฟล์ถูกแก้ หรือไม่ได้โหลดจากระบบ
    if (!traceLog) {
      return {
        isAuthentic: false,
        message: '❌ ไฟล์นี้อาจถูกดัดแปลงแก้ไข หรือไม่ได้เป็นไฟล์ที่ออกจากระบบโดยตรง',
      };
    }

    // 4. ถ้าเจอ ตรงกันเป๊ะ 100%
    return {
      isAuthentic: true,
      message: '✅ ไฟล์แท้ 100% (Original Document)',
      details: {
        originalFileName: traceLog.originalFile.fileName,
        downloadedBy: traceLog.downloadedBy?.fullName || traceLog.downloadedBy?.username,
        downloadedAt: traceLog.downloadedAt, // วันเวลาที่โหลดออกไป
        documentHash: traceLog.fileHash
      }
    };
  }

 // ==========================================
  // 🛡️ [SharePoint Core] ฟังก์ชันตรวจสอบสิทธิ์โฟลเดอร์แบบสืบทอดลำดับขั้น
  // ==========================================
  private async hasFolderAccess(
    folderId: number | null, 
    userId: number, 
    roleId: number, 
    // 🌟 จำกัดสิทธิ์เฉพาะ 3 ตัวที่มีอยู่จริงในตาราง DocFolderAccess
    permissionField: 'canView' | 'canUpload' | 'canDelete' 
  ): Promise<boolean> {
    if (!folderId) return false;

    // 1. ดึงข้อมูลโฟลเดอร์ปัจจุบัน
    const folder = await this.prisma.docFolder.findUnique({
      where: { id: folderId }
    });
    if (!folder) return false;

    // 2. ดึง Role ทั้งหมดที่ User คนนี้ถืออยู่จากตาราง secUserRole โดยตรง
    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId: userId }
    });
    const myRoleIds = userRoles.map(ur => ur.roleId);

    // 3. รวม roleId ที่ส่งมาจาก Controller (ถ้ามี) เข้าไปใน Array สิทธิ์
    if (roleId > 0 && !myRoleIds.includes(roleId)) {
      myRoleIds.push(roleId);
    }

    // 4. ตรวจสอบสิทธิ์ที่ตั้งค่าไว้กับโฟลเดอร์นี้โดยตรง (ตรวจสอบทั้ง UserId และ Roles ทั้งหมด)
    const explicitAccess = await this.prisma.docFolderAccess.findFirst({
      where: {
        folderId,
        OR: [
          { userId: userId },
          { roleId: { in: myRoleIds } } 
        ]
      }
    });

    // 5. ถ้าพบสิทธิ์ที่ระบุไว้ที่โฟลเดอร์นี้ ให้คืนค่าสิทธิ์นั้นทันที
    if (explicitAccess) {
      return !!explicitAccess[permissionField];
    }

    // 6. ถ้าโฟลเดอร์นี้เป็นจุดสูงสุด (Root) หรือเป็น Workspace แต่ยังไม่มีสิทธิ์ระบุไว้ = หมดสิทธิ์
    if (folder.isWorkspace || !folder.parentId) {
      return false;
    }

    // 7. สืบทอดสิทธิ์ (Inheritance): หากไม่พบที่โฟลเดอร์นี้ ให้วิ่งขึ้นไปเช็กที่ parentId ต่อ
    return this.hasFolderAccess(folder.parentId, userId, roleId, permissionField);
  }

  // ==========================================
  // 🛡️ Helper: เช็กว่าผู้ใช้มีสิทธิ์ดูไฟล์ฉบับร่าง/รออนุมัติหรือไม่ (อัปเกรดระบบสิทธิ์ Editor & Creator)
  // ==========================================
  private async hasDraftAccess(file: any, userId: number, roleId: number, isHQ: boolean): Promise<boolean> {
    // 1. บัญชีระดับสูงสุด: ถ้าเป็น Super Admin หรือบัญชีระดับ HQ ให้สิทธิ์ดูไฟล์ร่างทุกเวอร์ชันเสมอ
    if (roleId === 1 || isHQ) return true;

    // 2. สิทธิ์ความเป็นเจ้าของหลัก: ถ้าเป็นคนสร้างเอกสารคนแรก (V1 Owner) ให้เข้าถึงไฟล์ร่างได้
    if (file.uploadedById === userId || file.createdBy === userId) return true;

    // 3. สิทธิ์ผู้ปรับปรุงล่าสุด: ถ้าเป็นคนอัปโหลดเวอร์ชันล่าสุด (คนที่เข้ามาแก้ไขและส่ง V2 ร่างขึ้นไป) ต้องเห็นไฟล์ร่างของตัวเอง
    const latestVersion = file.versions?.[0];
    if (latestVersion && Number(latestVersion.uploadedById) === userId) {
      return true;
    }

    // 4. สิทธิ์ในสายงานอนุมัติ: ถ้าไฟล์กำลังติดกระบวนการ Workflow และผู้ใช้เป็นหนึ่งในผู้อนุมัติปัจจุบัน (Current Approver)
    if (file.wfRequest && file.wfRequest.currentApproverIds) {
      if (file.wfRequest.currentApproverIds.includes(userId)) {
        return true;
      }
    }

    // 5. สิทธิ์ระดับโฟลเดอร์: ถ้าผู้ใช้มีสิทธิ์อัปโหลดเอกสาร (canUpload) ในโฟลเดอร์นี้ 
    // หมายความว่าเป็นกลุ่ม Editor/Manager ของแฟ้มนี้ จึงสมควรเห็นไฟล์ร่างและไฟล์ที่รออนุมัติทั้งหมดในแฟ้มได้
    if (file.folderId) {
      const hasFolderEditorAccess = await this.hasFolderAccess(file.folderId, userId, roleId, 'canUpload');
      if (hasFolderEditorAccess) {
        return true;
      }
    }

    // หากไม่ตรงกับเงื่อนไขด้านบนเลย (เป็นผู้ใช้ทั่วไปที่มีสิทธิ์แค่ canView) จะถูกซ่อนไฟล์ร่างไว้ และเห็นเฉพาะเวอร์ชันที่ใช้งานจริง (isCurrent === true)
    return false;
  }

  async getFileDetail(companyId: number, fileId: number, userId: number, roleId: number, isHQ: boolean = false) {
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId: companyId },
      include: {
        wfRequest: true,
        versions: { // 👈 ต้องแน่ใจว่าในตาราง DocFile ใช้ชื่อ Relation นี้
          orderBy: { version: 'desc' } // ✅ แก้จาก versionNumber เป็น version ให้ตรงกับ Schema
        }
      }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสารที่ระบุ หรือคุณไม่มีสิทธิ์เข้าถึง');

    const canAccessDraft = await this.hasDraftAccess(file, userId, roleId, isHQ);

    if (canAccessDraft) {
      return file;
    } else {
      // ✅ ถ้า Query มาแล้ว include versions ด้วย โค้ดตรงนี้ก็จะไม่พัง (Error 2339 จะหายไป)
      const approvedVersions = file.versions.filter(v => v.isCurrent === true); 

      if (approvedVersions.length === 0) {
        throw new ForbiddenException('เอกสารนี้อยู่ระหว่างกระบวนการตรวจสอบและอนุมัติครั้งแรก ผู้ใช้ทั่วไปยังไม่สามารถเข้าถึงได้');
      }

      return {
        ...file,
        versions: approvedVersions
      };
    }
  }

  // ==========================================
  // 📁 2. ดึงรายการไฟล์ทั้งหมดในแฟ้มข้อมูล (คัดกรองตามสิทธิ์การมองเห็น + แนบสิทธิ์ Recall)
  // ==========================================
  async listFilesByFolder(companyId: number, folderId: number, userId: number, roleId: number, isHQ: boolean = false) {
    // 1. ดึงไฟล์ทั้งหมดในโฟลเดอร์นั้นขึ้นมาตรวจสอบ
    const allFiles = await this.prisma.docFile.findMany({
      where: { folderId: folderId, companyId: companyId },
      include: {
        wfRequest: true,
        versions: { 
          orderBy: { version: 'desc' }
        }
      }
    });

    const filteredFiles: any[] = [];

    // 2. วนลูปตรวจสอบไฟล์ทีละรายการตามกฎสิทธิ์การมองเห็น
    for (const file of allFiles) {
      const canAccessDraft = await this.hasDraftAccess(file, userId, roleId, isHQ);

      // 🌟 [NEW LOGIC] คำนวณสิทธิ์ canRecall ของแต่ละไฟล์ในลิสต์เพื่อให้หน้าบ้านเปิด/ปิดปุ่มได้ถูกต้อง
      let canRecall = false;
      if (file.wfRequest && file.wfRequest.status === 'IN_PROGRESS') {
        if (roleId === 1 || userId === 1) {
          canRecall = true;
        } else {
          // ค้นหาบุคคลล่าสุดที่กด APPROVE จริงๆ ของคำร้องนี้ (ข้ามพวก System Auto ออกไป)
          const lastApproveAction = await this.prisma.wfAction.findFirst({
            where: {
              requestId: file.wfRequest.id,
              action: 'APPROVE',
              comment: { not: { contains: 'System Auto' } }
            },
            orderBy: { id: 'desc' }
          });
          if (lastApproveAction && lastApproveAction.actorId === userId) {
            canRecall = true;
          }
        }
      }

      if (canAccessDraft) {
        // 🟢 กลุ่มสิทธิ์พิเศษ: เห็นไฟล์ตามปกติ และเห็นข้อมูลอัปเดตล่าสุด
        filteredFiles.push({
          ...file,
          canRecall // 🚀 แนบสิทธิ์ส่งกลับไปให้หน้าบ้าน
        });
      } else {
        // 🔴 คนทั่วไป: หาเวอร์ชันที่ถูกใช้งานปัจจุบัน (isCurrent === true)
        const activeVersion = file.versions.find(v => v.isCurrent === true);

        if (!activeVersion) {
          continue; 
        }

        filteredFiles.push({
          ...file,
          fileName: file.fileName, 
          currentUrl: activeVersion.url,
          currentSize: activeVersion.size,
          versions: [activeVersion],
          canRecall // 🚀 แนบสิทธิ์ส่งกลับไปให้หน้าบ้าน
        });
      }
    }

    return filteredFiles;
  }

// ==========================================
  // 1. บันทึกข้อมูลไฟล์ (พร้อมระบบ Auto-Rename และ Auto-Trigger Workflow)
  // ==========================================
  async createFileRecord(companyId: number, uploadedById: number, dto: UploadFileDto) {

    let hashedFilePassword: string | null = null; 
      
    if (dto.filePassword) {
      hashedFilePassword = await bcrypt.hash(dto.filePassword, 10);
    }

    // 🌟 [NEW LOGIC] ระบบ Auto-Rename เปลี่ยนชื่อไฟล์อัตโนมัติหากซ้ำในโฟลเดอร์เดียวกัน
    let finalFileName = dto.fileName;
    let counter = 1;

    // แยกชื่อหลักและนามสกุลไฟล์ออกจากกัน เพื่อให้แทรกตัวเลขได้ถูกต้อง เช่น report(1).pdf
    const lastDotIndex = dto.fileName.lastIndexOf('.');
    let baseName = dto.fileName;
    let ext = '';
    
    if (lastDotIndex !== -1 && lastDotIndex !== 0) {
      baseName = dto.fileName.substring(0, lastDotIndex);
      ext = dto.fileName.substring(lastDotIndex); // จะได้นามสกุลติดจุดมาด้วย เช่น ".pdf"
    }

    // วนลูปตรวจสอบชื่อซ้ำในโฟลเดอร์เดียวกัน
    while (true) {
      const existingFile = await this.prisma.docFile.findFirst({
        where: {
          companyId: companyId,
          folderId: dto.folderId || null, // ตรวจสอบในโฟลเดอร์เดียวกัน (หรือ Root)
          fileName: finalFileName
        }
      });

      if (!existingFile) {
        break; // ชื่อนี้ว่างแล้ว ออกจากลูปได้เลย
      }

      // ถ้าชื่อซ้ำ ให้รันเลขต่อไปเรื่อยๆ
      finalFileName = `${baseName} (${counter})${ext}`;
      counter++;
    }

    // 1. บันทึกไฟล์ลงระบบตามปกติ
    const newDoc = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.docFile.create({
        data: {
          companyId,
          folderId: dto.folderId,
          fileName: finalFileName, // 👈 ใช้ชื่อไฟล์ที่ผ่านการรันเลข Auto-Rename แล้ว
          fileExtension: dto.fileExtension,
          currentSize: BigInt(dto.fileSize),
          currentUrl: dto.url,
          uploadedById,
          autoDeleteAt: dto.autoDeleteAt ? new Date(dto.autoDeleteAt) : null,
          filePassword: hashedFilePassword, 
        },
      });

      await tx.docFileVersion.create({
        data: {
          companyId,
          fileId: doc.id,
          version: 1,
          url: dto.url,
          size: BigInt(dto.fileSize),
          mimeType: dto.fileExtension,
          uploadedById,
          changeLog: 'Initial upload',
        },
      });

      if (dto.metadata && dto.metadata.length > 0) {
        await tx.docFileMetadata.createMany({
          data: dto.metadata.map((m) => ({
            companyId,
            fileId: doc.id,
            key: m.key,
            value: m.value,
          })),
        });
      }

      return doc;
    });

    // =========================================================
    // 🌟 [NEW LOGIC] ระบบ Auto-Trigger Workflow ตามการตั้งค่า
    // =========================================================
    try {
      // ค้นหาว่าโฟลเดอร์นี้ หรือโฟลเดอร์แม่ มีการตั้งค่า Workflow อัปโหลดไว้หรือไม่
      let targetWorkflowId = await this.getInheritedWorkflow(dto.folderId ?? null, companyId, 'UPLOAD');

      // ถ้าไม่มีที่โฟลเดอร์ ให้ไปค้นหาการตั้งค่าส่วนกลางของบริษัท
      if (!targetWorkflowId) {
        const mapping = await this.prisma.wfModuleMapping.findFirst({
          where: { companyId: companyId, moduleCode: 'DOC_UPLOAD', isActive: true }
        });
        if (mapping) targetWorkflowId = mapping.workflowId;
      }

      // 🚀 ถ้ามีการตั้งค่า Workflow ไว้ ให้เตะเข้าสายอนุมัติทันที!
      if (targetWorkflowId) {
        console.log(`[Auto-Workflow] พบการตั้งค่า Workflow ID ${targetWorkflowId} สำหรับไฟล์ ${newDoc.id} กำลังส่งเรื่องอัตโนมัติ...`);

        // 🌟 Fix: ระบุ Type เป็น any ป้องกัน TS2339 Error
        const request: any = await this.wfRequestService.create(companyId, uploadedById, {
          moduleCode: 'DOC_UPLOAD',
          workflowId: targetWorkflowId,
          businessId: String(newDoc.id),
          topic: `ขออนุมัติเอกสาร: ${newDoc.fileName}`, 
        } as any);

        // อัปเดต wfRequestId กลับไปที่ DocFile ให้รู้ว่าไฟล์นี้ติดสถานะรออนุมัติ
        await this.prisma.docFile.update({
          where: { id: newDoc.id },
          data: { wfRequestId: request.id }
        });

        // ส่ง Response กลับไปบอกหน้าบ้านว่า "อัปโหลดแล้ว และส่งเข้า Workflow แล้วนะ"
        return { 
          ...newDoc, 
          wfRequestId: request.id, 
          isPendingApproval: true, 
          message: 'อัปโหลดและส่งเข้าสู่กระบวนการอนุมัติอัตโนมัติเรียบร้อยแล้ว' 
        };
      }
    } catch (error: any) {
      console.error(`[Auto-Workflow Error] ไม่สามารถส่งไฟล์ ${newDoc.id} เข้า Workflow อัตโนมัติได้:`, error.message);
      // ถึง Workflow จะมีปัญหา (เช่น ตั้งค่า Node ผิด) เราก็ปล่อยให้ไฟล์บันทึกสำเร็จไปก่อน
    }

    // 🚶‍♂️ ถ้าไม่มีการกำหนด Workflow ระบบก็จะไม่วิ่ง และคืนค่ากลับไปปกติ (พร้อมใช้งานทันที)
    return {
      ...newDoc,
      message: 'อัปโหลดไฟล์สำเร็จ (ไม่มีการตั้งค่าสายอนุมัติ)'
    };
  }


  // 1. สร้างคำขอเซ็นเอกสาร
async createSignatureRequest(companyId: number, fileId: number, dto: CreateSignatureRequestDto) {
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId }
    });
    if (!file) throw new NotFoundException('ไม่พบเอกสารที่ต้องการให้เซ็น');

    return this.prisma.docSignatureRequest.create({
      data: {
        companyId,
        fileId,
        signerEmail: dto.signerEmail,
        signerName: dto.signerName,
        signerId: dto.signerId,
        pageNumber: dto.pageNumber,
        posX: dto.posX,
        posY: dto.posY,
        wfRequestId: dto.wfRequestId,
        status: 'PENDING'
      }
    });
  }

  // ==========================================
  // 🔓 ฟังก์ชันสำหรับ ลบ หรือ เปลี่ยนรหัสผ่านไฟล์ (กรณีลืม) พร้อมเก็บ Audit Log
  // ==========================================
  async resetFilePassword(
    companyId: number, 
    fileId: number, 
    userId: number, 
    dto: { 
      newPassword?: string; 
      ipAddress?: string;   
      userAgent?: string;   
    }
  ) {
    // 1. ค้นหาเอกสาร
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      select: { id: true, uploadedById: true, fileName: true, filePassword: true }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสาร');

    // 🛡️ 2. ตรวจสอบสิทธิ์ (Authorization Check)
    let isAuthorized = false;
    
    if (file.uploadedById === userId) {
      isAuthorized = true;
    } else {
      // ตรวจสอบว่าเป็นผู้ดูแลระบบ (SUPER_ADMIN) หรือไม่
      const adminRole = await this.prisma.secUserRole.findFirst({
        where: { 
          userId: userId, 
          companyId: companyId,
          role: { name: 'SUPER_ADMIN' } 
        }
      });
      if (adminRole) isAuthorized = true;
    }

    if (!isAuthorized) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เปลี่ยนรหัสผ่านเอกสารนี้ (ต้องเป็นเจ้าของไฟล์หรือผู้ดูแลระบบเท่านั้น)');
    }

    // 🌟 3. จัดการรหัสผ่านใหม่ (แก้ปัญหา TypeScript Error)
    let hashedNewPassword: string | null = null;
    const isRemovingPassword = !dto.newPassword || dto.newPassword.trim() === '';

    // เช็คให้ชัวร์ว่ามี dto.newPassword แน่ๆ TypeScript จะได้ไม่ฟ้อง Error 
    if (!isRemovingPassword && dto.newPassword) {
      hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);
    }

    // 🔄 4. ใช้ Transaction เพื่ออัปเดตข้อมูลและบันทึก Log พร้อมกัน
    return await this.prisma.$transaction(async (tx) => {
      
      // 4.1 อัปเดตรหัสผ่านใหม่ลงตาราง DocFile
      await tx.docFile.update({
        where: { id: fileId },
        data: {
          filePassword: hashedNewPassword
        }
      });

      // 4.2 บันทึกประวัติการกระทำลง LogAudit (แทน SecAuditLog ที่ถูกลบไป)
      const actionType = isRemovingPassword ? 'REMOVE_FILE_PASSWORD' : 'RESET_FILE_PASSWORD';
      
      await tx.logAudit.create({
        data: {
          companyId: companyId,
          userId: userId,
          action: actionType,
          tableName: 'DocFile', // เปลี่ยนจาก resource เป็น tableName ให้ตรงกับ Schema ของ LogAudit
          recordId: String(fileId), // เปลี่ยนจาก resourceId เป็น recordId (และแปลงเป็น String ตาม Schema)
          oldValues: { // เปลี่ยนจาก oldValue เป็น oldValues (เติม s)
            hasPassword: !!file.filePassword 
          },
          newValues: { // เปลี่ยนจาก newValue เป็น newValues (เติม s)
            hasPassword: !isRemovingPassword 
          },
          ipAddress: dto.ipAddress || null,
          userAgent: dto.userAgent || null,
        }
      });

      return { 
        message: isRemovingPassword 
          ? 'ยกเลิกรหัสผ่านของไฟล์นี้สำเร็จแล้ว' 
          : 'ตั้งรหัสผ่านใหม่สำหรับไฟล์นี้สำเร็จแล้ว' 
      };
    });
  }

  // 2. ดึงรายการคำขอเซ็นทั้งหมดของไฟล์นี้
 async getSignatureRequests(companyId: number, fileId: number) {
    return this.prisma.docSignatureRequest.findMany({
      where: { fileId, companyId },
      include: {
        signature: true, 
        // 🌟 [Fix 2] เปลี่ยนจาก firstName/lastName เป็น fullName ให้ตรงกับ SecUser
        signer: { select: { id: true, fullName: true } } 
      },
      orderBy: { createdAt: 'asc' }
    });
  }


// 3. ฟังก์ชันตรวจสอบความถูกต้องของไฟล์ (Integrity Check)
  // ใช้เปรียบเทียบ Hash ปัจจุบัน กับ Hash ตอนที่เซ็นลายเซ็น
async verifyFileIntegrity(companyId: number, fileId: number) {
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสาร');

    const signatures = await this.prisma.docSignature.findMany({
      where: { request: { fileId: file.id } },
      // 🌟 [Fix 1] เพิ่ม include request ตรงนี้ เพื่อให้เข้าถึงข้อมูล request ได้
      include: { request: true } 
    });

    if (signatures.length === 0) return { status: 'NO_SIGNATURE', message: 'เอกสารนี้ยังไม่มีการเซ็นลายเซ็นดิจิทัล' };

    const results = signatures.map(sig => ({
      signerName: sig.request.signerName,
      isAltered: sig.fileHashAtSigning !== 'CURRENT_FILE_HASH_LOGIC', 
      signedAt: sig.signedAt
    }));

    const isAnyAltered = results.some(r => r.isAltered);

    return {
      isValid: !isAnyAltered,
      checkDate: new Date(),
      results
    };
  }


  // 🌟 [NEW] ฟังก์ชันสำหรับปลดล็อกไฟล์ภายในองค์กร
  async unlockFileInternal(companyId: number, fileId: number, dto: UnlockFileDto) {
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสาร');

    // ถ้าไฟล์ไม่มีรหัสผ่านแต่แรก ก็คืน URL ให้เลย
    if (!file.filePassword) {
      return { url: file.currentUrl };
    }

    // 🌟 [แก้ไขตรงนี้] ใช้ bcrypt.compare เพื่อเทียบรหัสผ่านดิบ กับ Hash ใน Database
    const isPasswordMatch = await bcrypt.compare(dto.password, file.filePassword);

    if (!isPasswordMatch) {
      throw new UnauthorizedException('รหัสผ่านไม่ถูกต้อง ไม่สามารถเข้าถึงไฟล์นี้ได้');
    }

    // ถ้ารหัสผ่านถูก คืน URL จริงกลับไป
    return { url: file.currentUrl };
  }

 // 2. ฟังก์ชันสร้างลิงก์แชร์ภายนอก
  async createShareLink(companyId: number, userId: number, dto: CreateShareLinkDto) {
    const token = crypto.randomBytes(16).toString('hex'); 
    
    // 🌟 [แก้ไข] ระบุ Type ให้ชัดเจนว่าเป็น string หรือ null เพื่อป้องกัน TS Error 2322
    let hashedPassword: string | null = null;
    
    if (dto.password && dto.password.trim() !== '') {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }
    
    return this.prisma.docFileShareLink.create({
      data: {
        companyId,
        fileId: dto.fileId,
        token,
        password: hashedPassword, // 👈 บันทึกรหัสที่ Hash แล้ว (หรือ null ถ้าไม่ได้ตั้ง)
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxDownloads: dto.maxDownloads || null,
        createdBy: userId
      }
    });
  }

// 🌟 เพิ่ม parameter รับ password (optional เพราะบางลิงก์อาจไม่ได้ตั้งรหัส)
  async getFileByShareToken(token: string, password?: string) {
    const shareLink = await this.prisma.docFileShareLink.findUnique({
      where: { token },
      include: { file: true }
    });

    if (!shareLink) throw new NotFoundException('ลิงก์ไม่ถูกต้องหรือหมดอายุ');
    
    // ตรวจสอบวันหมดอายุ
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      throw new BadRequestException('ลิงก์นี้หมดอายุแล้ว');
    }

    // ตรวจสอบจำนวนครั้งที่ดาวน์โหลด
    if (shareLink.maxDownloads && shareLink.currentDownloads >= shareLink.maxDownloads) {
      throw new BadRequestException('ลิงก์นี้ครบจำนวนครั้งที่อนุญาตให้ดาวน์โหลดแล้ว');
    }

    // 🌟 [เพิ่มใหม่] ตรวจสอบรหัสผ่าน (ถ้าระบบบันทึกรหัสผ่านไว้ใน DB)
    if (shareLink.password) {
      if (!password) {
        // ถ้าลิงก์มีรหัส แต่หน้าบ้านไม่ได้ส่งรหัสมา ให้เด้งกลับไปถามรหัสผ่าน
        throw new UnauthorizedException('ลิงก์นี้มีการป้องกันด้วยรหัสผ่าน กรุณาะบุรหัสผ่าน');
      }

      // เทียบรหัสผ่านด้วย bcrypt
      const isPasswordMatch = await bcrypt.compare(password, shareLink.password);
      if (!isPasswordMatch) {
        throw new UnauthorizedException('รหัสผ่านไม่ถูกต้อง');
      }
    }

    // อัปเดตจำนวนการดาวน์โหลด
    await this.prisma.docFileShareLink.update({
      where: { id: shareLink.id },
      data: { currentDownloads: { increment: 1 } }
    });

    return shareLink.file;
  }

  async findAll(companyId: number, folderId?: number) {
    return this.prisma.docFile.findMany({
      where: { companyId, folderId: folderId || null },
      include: {
        // 🌟 [Fix 2] เปลี่ยนจาก firstName/lastName เป็น fullName
        uploadedBy: { select: { fullName: true } }, 
        // 🌟 [Fix 3] เปลี่ยนชื่อ relation ให้ตรงกับ Prisma Schema
        _count: { select: { versions: true, docSignatureRequest: true } } 
      },
      orderBy: { updatedAt: 'desc' },
    });
  }


// ==========================================
  // 🌟 [ฟังก์ชันเต็ม] ฝังลายน้ำ (เพิ่มระบบ Safety Valve ป้องกันเซิร์ฟเวอร์ล่ม)
  // ==========================================
  private async applyWatermark(buffer: Buffer, mimeType: string, watermarkText: string, userId: number): Promise<Buffer | Uint8Array> {
    
    if (mimeType && mimeType.toLowerCase().includes('pdf')) {
      try {
        console.log(`[Watermark] เริ่มตรวจสอบไฟล์ PDF ขนาด: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

        // 🛡️ [Safety Valve 1] ป้องกัน Server Crash จากไฟล์ที่ใหญ่เกินไป
        // ถ้าไฟล์ใหญ่กว่า 15 MB ให้ข้ามการฝังลายน้ำ (ปล่อยผ่านไปเลย)
        if (buffer.length > 15 * 1024 * 1024) {
          console.warn(`[Watermark Warning] ข้ามการฝังลายน้ำ: ไฟล์ใหญ่เกินไป (${(buffer.length / 1024 / 1024).toFixed(2)} MB) เพื่อป้องกันระบบล่ม`);
          return buffer; 
        }

        console.log(`[Watermark] กำลังโหลด PDF เข้าหน่วยความจำ (pdf-lib)...`);
        
        // 🌟 เพิ่ม ignoreEncryption ช่วยให้ไลบรารีโหลดไฟล์ได้เร็วขึ้นและใช้ RAM น้อยลงมาก
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true }); 
        const pages = pdfDoc.getPages();
        
        console.log(`[Watermark] โหลดสำเร็จ! ไฟล์มีทั้งหมด ${pages.length} หน้า`);

        // 🛡️ [Safety Valve 2] ป้องกันการฝังลายน้ำไฟล์ที่มีหน้าเยอะเกินไป (มักเกิดจาก Excel แปลงมา)
        if (pages.length > 100) {
          console.warn(`[Watermark Warning] ข้ามการฝังลายน้ำ: ไฟล์มีหน้าเยอะเกินไป (${pages.length} หน้า) เพื่อป้องกันระบบล่ม`);
          return buffer;
        }

        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const lines = watermarkText.split('\n');

        for (const page of pages) {
          const { width, height } = page.getSize();
          
          let currentY = height / 3;
          for (const line of lines) {
            if (!line.trim()) continue;

            page.drawText(line.trim(), {
              x: width / 5,
              y: currentY,
              size: 28, 
              font: font,
              color: rgb(0.7, 0.7, 0.7),
              opacity: 0.25,
              rotate: degrees(45),
            });

            currentY -= 35; 
          }

          // ซ่อน Metadata แบบลึก (Invisible Watermark)
          pdfDoc.setCreator('KKV Business OS DMS');
          pdfDoc.setAuthor(`System Tracking User ID: ${userId}`);
          pdfDoc.setKeywords(['Confidential', `TraceLog: ${watermarkText.replace(/\n/g, ' ')}`]);
        }

        console.log(`[Watermark] ฝังลายน้ำสำเร็จ! กำลังเตรียมส่งให้หน้าบ้าน...`);
        return await pdfDoc.save();
      } catch (error: any) {
        console.error('[Watermark Error] ไม่สามารถฝังลายน้ำลงใน PDF ได้:', error.message);
        return buffer; // ถ้ามี Error ใดๆ เกิดขึ้น ให้ส่งไฟล์ PDF ธรรมดากลับไปแทน
      }
    }
    
    return buffer;
  }


 // ==========================================
  // 📄 [ฟังก์ชันเต็ม] ดูไฟล์ผ่าน Proxy (SharePoint Access Control + ลายน้ำเฉพาะ PDF + Workflow Guard + Tamper-Proof)
  // ==========================================
  async viewFile(companyId: number, fileId: number, userId: number, roleId: number) { // 🌟 นำ isHQ ออก
    // 🌟 [UPDATE] ดึงไฟล์พร้อมข้อมูลโฟลเดอร์, workflow, และประวัติเวอร์ชันทั้งหมดเพื่อใช้คุมสิทธิ์
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      include: { 
        folder: true,
        wfRequest: true,
        versions: { orderBy: { version: 'desc' } }
      }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสาร');

    let hasAccess = false;
    const now = new Date();

    // 👑 กฎการเข้าถึงระดับสถาปัตยกรรมองค์กร (Base Access Check)
    if (roleId === 1) {
      hasAccess = true;
    } else if (file.folder?.isWorkspace) {
      hasAccess = await this.hasFolderAccess(file.folderId, userId, roleId, 'canView');
    } else {
      if (file.uploadedById === userId) {
        hasAccess = true;
      } else {
        const fileAccesses = await this.prisma.docFileAccess.findMany({
          where: { fileId, companyId }
        });

        if (fileAccesses.length === 0) {
          hasAccess = true; 
        } else {
          hasAccess = fileAccesses.some(acc => {
            if (acc.expiresAt && new Date(acc.expiresAt) < now) return false;
            return (acc.roleId === roleId || acc.userId === userId) && acc.canView;
          });
        }

        if (!hasAccess && file.folderId) {
          hasAccess = await this.hasFolderAccess(file.folderId, userId, roleId, 'canView');
        }
      }
    }

    if (!hasAccess) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้ (สิทธิ์ใน Workspace ของคุณถูกระงับหรือสิ้นสุดลงแล้ว)');
    }

    // 🌟 [NEW GUARD] ตรวจสอบสิทธิ์การเข้าถึงไฟล์ฉบับร่าง/ระหว่างอนุมัติ (Workflow Context Guard)
    const canAccessDraft = await this.hasDraftAccess(file, userId, roleId, false); // 🌟 เปลี่ยน isHQ เป็น false
    let targetUrl = file.currentUrl;

    if (!canAccessDraft) {
      // 🔴 คนทั่วไปไม่มีสิทธิ์ดูไฟล์ร่าง -> ค้นหาเวอร์ชันที่ใช้งานจริงปัจจุบัน (isCurrent === true)
      const activeVersion = file.versions?.find(v => v.isCurrent === true);
      
      // เคสที่ 1: เป็นไฟล์สร้างใหม่ซิงๆ (V1 ค้างสเตตัส Workflow) -> บล็อกห้ามเข้าดูเด็ดขาด
      if (!activeVersion) {
        throw new ForbiddenException('เอกสารนี้อยู่ระหว่างกระบวนการตรวจสอบและอนุมัติครั้งแรก ผู้ใช้ทั่วไปยังไม่สามารถเข้าถึงได้');
      }
      
      // เคสที่ 2: V1 อนุมัติแล้ว แต่ V2 ค้างคิวอยู่ -> สลับลิงก์เสิร์ฟเวอร์ชัน V1 ให้ดูแทนอย่างปลอดภัย
      targetUrl = activeVersion.url;
    }

    // 🌟 [CLOUD FIX] สร้าง URL เต็มสำหรับ Google Cloud Storage
    if (targetUrl && !targetUrl.startsWith('http')) {
      // ใช้ชื่อ Bucket เดียวกับที่อยู่ใน upload.service.ts
      const bucketName = process.env.GCS_BUCKET_NAME || 'kkvbusiness_buckets'; 
      const cleanPath = targetUrl.startsWith('/') ? targetUrl.substring(1) : targetUrl;
      targetUrl = `https://storage.googleapis.com/${bucketName}/${cleanPath}`;
    }

    try {
      const response = await axios.get(targetUrl, { responseType: 'arraybuffer' });
      let fileBuffer = Buffer.from(response.data);
      let mimeType = file.fileExtension || 'application/octet-stream';

      const timestamp = new Date().toLocaleString('en-GB');
      const watermarkText = `CONFIDENTIAL  |  User ID: ${userId}  |  Date: ${timestamp}`;
      const processedFileBytes = await this.applyWatermark(fileBuffer, mimeType, watermarkText, userId);

      // 🛡️ [TAMPER-PROOF] แปลงเป็น Buffer และคำนวณ SHA-256 Hash
      const finalBuffer = Buffer.from(processedFileBytes);
      const fileHash = crypto.createHash('sha256').update(finalBuffer).digest('hex');

      await this.prisma.logDocumentTrace.create({
        data: {
                fileHash: fileHash,
                companyId: companyId, // 🌟 แก้ไข: ใช้ ID ตรงๆ 
                originalFileId: fileId, // 🌟 แก้ไข: ใช้ ID ตรงๆ
                downloadedById: userId // 🌟 แก้ไข: ใช้ ID ตรงๆ
              }
        });

      return {
        fileStream: new StreamableFile(finalBuffer),
        mimeType: mimeType,
        fileName: file.fileName
      };
    } catch (error: any) {
      console.error(`[ViewFile Error] พยายามโหลด URL: ${targetUrl}`);
      console.error(`รายละเอียด Error: ${error.message}`);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(`ไม่สามารถดึงไฟล์จาก Cloud มาแสดงผลได้ สาเหตุ: ${error.message}`);
    }
  }

 // ==========================================
  // 📥 [ฟังก์ชันเต็ม] ดาวน์โหลดไฟล์ (SharePoint Access Control + ลายน้ำสำหรับ PDF + Workflow Guard + Tamper-Proof)
  // ==========================================
  async downloadFile(companyId: number, fileId: number, userId: number, roleId: number) { // 🌟 นำ isHQ ออก
    // 🌟 [UPDATE] ดึงไฟล์พร้อมข้อมูลโฟลเดอร์, workflow, และประวัติเวอร์ชันทั้งหมดเพื่อใช้คุมสิทธิ์
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      include: { 
        folder: true,
        wfRequest: true,
        versions: { orderBy: { version: 'desc' } }
      }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสาร');

    let hasAccess = false;
    const now = new Date();

    // 👑 กฎการเข้าถึงระดับสถาปัตยกรรมองค์กร (Base Access Check)
    if (roleId === 1) {
      hasAccess = true; 
    } else if (file.folder?.isWorkspace) {
      hasAccess = await this.hasFolderAccess(file.folderId, userId, roleId, 'canView');
    } else {
      if (file.uploadedById === userId) {
        hasAccess = true;
      } else {
        const fileAccesses = await this.prisma.docFileAccess.findMany({
          where: { fileId, companyId }
        });

        if (fileAccesses.length === 0) {
          hasAccess = true;
        } else {
          hasAccess = fileAccesses.some(acc => {
            if (acc.expiresAt && new Date(acc.expiresAt) < now) return false;
            return (acc.roleId === roleId || acc.userId === userId) && acc.canDownload; 
          });
        }

        if (!hasAccess && file.folderId) {
          hasAccess = await this.hasFolderAccess(file.folderId, userId, roleId, 'canView');
        }
      }
    }

    if (!hasAccess) throw new ForbiddenException('คุณไม่มีสิทธิ์ดาวน์โหลดเอกสารนี้ (สิทธิ์ใน Workspace ของคุณถูกระงับหรือสิ้นสุดลงแล้ว)');

    // 🌟 [NEW GUARD] ตรวจสอบสิทธิ์การเข้าถึงไฟล์ฉบับร่าง/ระหว่างอนุมัติ (Workflow Context Guard)
    const canAccessDraft = await this.hasDraftAccess(file, userId, roleId, false); // 🌟 เปลี่ยน isHQ เป็น false
    let targetUrl = file.currentUrl;

    if (!canAccessDraft) {
      // 🔴 คนทั่วไปไม่มีสิทธิ์โหลดไฟล์ร่าง -> ค้นหาเวอร์ชันที่ใช้งานจริงปัจจุบัน (isCurrent === true)
      const activeVersion = file.versions?.find(v => v.isCurrent === true);
      
      if (!activeVersion) {
        throw new ForbiddenException('เอกสารนี้อยู่ระหว่างกระบวนการตรวจสอบและอนุมัติครั้งแรก ผู้ใช้ทั่วไปยังไม่สามารถดาวน์โหลดได้');
      }
      
      // สลับลิงก์เสิร์ฟเวอร์ชัน V1 ที่เสถียรให้ดาวน์โหลดแทน
      targetUrl = activeVersion.url;
    }

    // 🌟 [CLOUD FIX] สร้าง URL เต็มสำหรับ Google Cloud Storage
    if (targetUrl && !targetUrl.startsWith('http')) {
      const bucketName = process.env.GCS_BUCKET_NAME || 'kkvbusiness_buckets';
      const cleanPath = targetUrl.startsWith('/') ? targetUrl.substring(1) : targetUrl;
      targetUrl = `https://storage.googleapis.com/${bucketName}/${cleanPath}`;
    }

    try {
      const response = await axios.get(targetUrl, { responseType: 'arraybuffer' });
      let fileBuffer = Buffer.from(response.data);
      let mimeType = file.fileExtension || 'application/octet-stream';

      const timestamp = new Date().toLocaleString('en-GB');
      const watermarkText = `RESTRICTED COPY - DOWNLOADED  |  User ID: ${userId}  |  Date: ${timestamp}`;
      const processedFileBytes = await this.applyWatermark(fileBuffer, mimeType, watermarkText, userId);

      // 🛡️ [TAMPER-PROOF] แปลงเป็น Buffer และคำนวณ SHA-256 Hash
      const finalBuffer = Buffer.from(processedFileBytes);
      const fileHash = crypto.createHash('sha256').update(finalBuffer).digest('hex');

      // 📝 บันทึกประวัติลายนิ้วมือดิจิทัลของไฟล์ฉบับนี้ลงระบบ
      await this.prisma.logDocumentTrace.create({
        data: {
                fileHash: fileHash,
                companyId: companyId, // 🌟 แก้ไข: ใช้ ID ตรงๆ 
                originalFileId: fileId, // 🌟 แก้ไข: ใช้ ID ตรงๆ
                downloadedById: userId // 🌟 แก้ไข: ใช้ ID ตรงๆ
              }
        });

      return {
        fileStream: new StreamableFile(finalBuffer),
        mimeType: mimeType,
        fileName: file.fileName
      };
    } catch (error: any) {
      console.error(`[DownloadFile Error] พยายามโหลด URL: ${targetUrl}`);
      console.error(`รายละเอียด Error: ${error.message}`);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(`ไม่สามารถดาวน์โหลดข้อมูลไฟล์จาก Cloud ได้ สาเหตุ: ${error.message}`);
    }
  }

// ==========================================
  // 🌟 [อัปเดต] ฟังก์ชันยิง Workflow ขอสิทธิ์เข้าถึง (รองรับทั้ง View และขอ RAW_FILE)
  // ==========================================
  async requestFileAccess(companyId: number, userId: number, dto: any) {
    const file = await this.prisma.docFile.findFirst({
      where: { id: dto.targetId, companyId }
    });
    if (!file) throw new NotFoundException('ไม่พบไฟล์ที่ต้องการขอสิทธิ์');

    const accessType = dto.accessType || 'VIEW'; 

    const existingReq = await this.prisma.docAccessRequest.findFirst({
      where: { 
        companyId, 
        requesterId: userId, 
        targetType: 'FILE', 
        targetId: dto.targetId, 
        status: 'PENDING' 
      }
    });
    if (existingReq) {
      throw new BadRequestException('คุณได้ส่งคำขอสิทธิ์สำหรับไฟล์นี้ไปแล้ว กรุณารอการอนุมัติ');
    }

    let targetWorkflowId = await this.getInheritedWorkflow(file.folderId, companyId, 'ACCESS');

    if (!targetWorkflowId) {
      const mapping = await this.prisma.wfModuleMapping.findFirst({
        where: { companyId, moduleCode: 'DATA_ACCESS', isActive: true }
      });
      if (mapping) targetWorkflowId = mapping.workflowId;
    }
    
    if (!targetWorkflowId) {
      throw new BadRequestException('ระบบยังไม่ได้ตั้งค่าสายอนุมัติสำหรับการขอเข้าถึงข้อมูล (DATA_ACCESS) กรุณาตั้งค่าที่แฟ้มข้อมูลหรือส่วนกลางก่อน');
    }

    let topicPrefix = 'ขอสิทธิ์เข้าดูไฟล์';
    if (accessType === 'RAW_FILE') {
      topicPrefix = '🚨 ขออนุมัติดาวน์โหลดไฟล์ต้นฉบับ (ไม่มีลายน้ำ)';
    } else if (accessType === 'DOWNLOAD') {
      topicPrefix = 'ขอสิทธิ์ดาวน์โหลดไฟล์ (มีลายน้ำ)';
    }

    // 🌟 ดึงค่าตัวแปรออกมาก่อน
    const reasonText = dto.reason || 'ขอสิทธิ์เข้าถึงเพื่อปฏิบัติงาน';
    const durationText = dto.durationDays || 1;

    const accessReq = await this.prisma.docAccessRequest.create({
      data: {
        companyId,
        requesterId: userId,
        targetType: 'FILE',
        targetId: dto.targetId,
        reason: reasonText,
        durationDays: durationText, 
        status: 'PENDING',
      }
    });

    const request: any = await this.wfRequestService.create(companyId, userId, {
      moduleCode: 'DATA_ACCESS',
      workflowId: targetWorkflowId, 
      businessId: String(accessReq.id),
      
      // 🌟 [แก้ตรงนี้ครับ] จับเหตุผลและจำนวนวัน ยัดใส่ Topic ให้มันโชว์ในหน้าบ้านทันที!
      topic: `${topicPrefix}: ${file.fileName} | เหตุผล: ${reasonText} | ระยะเวลา: ${durationText} วัน`,
      
      data: {
        accessType: accessType,
        reason: reasonText,
        durationDays: durationText
      }
    } as any);

    await this.prisma.docAccessRequest.update({
      where: { id: accessReq.id },
      data: { wfRequestId: request.id }
    });

    return { 
      message: 'ส่งคำขอเข้าถึงไฟล์เรียบร้อยแล้ว กรุณารอการอนุมัติจากผู้ดูแล', 
      requestId: request.id 
    };
  }


  // ==========================================
  // 💎 [ฟังก์ชันเต็ม] ดาวน์โหลดเอกสารต้นฉบับแบบไม่มีลายน้ำ (Strict Folder Guard + Workflow Access + Tamper-Proof)
  // ==========================================
  async downloadOriginalFile(companyId: number, fileId: number, userId: number, roleId: number) { // 🌟 นำ isHQ ออก
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      include: { 
        folder: true,
        wfRequest: true,
        versions: { orderBy: { version: 'desc' } }
      }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสาร');

    let hasAccess = false;

    // --- 🛡️ ด่านที่ 1: ตรวจสอบสิทธิ์ระดับผู้จัดการแฟ้ม (Strict Folder Guard) ---
    if (roleId === 1) {
      hasAccess = true; 
    } else if (file.folderId) {
      // 🚨 บังคับเช็กสิทธิ์ canDelete จากโฟลเดอร์แม่เท่านั้น (ตัดสิทธิ์คนอัปโหลด)
      hasAccess = await this.hasFolderAccess(file.folderId, userId, roleId, 'canDelete');
    } else if (!file.folderId && file.uploadedById === userId) {
      // 🌟 ข้อยกเว้น: ไฟล์ที่ยังลอยอยู่หน้า Root (ยังไม่จัดเก็บ) ยอมให้คนอัปโหลดโหลดไฟล์ตัวเองได้
      hasAccess = true;
    }

    // --- 🛡️ ด่านที่ 2: ตรวจสอบสิทธิ์จากการขออนุมัติผ่านระบบ (Workflow Access Request) ---
    // สำหรับ Staff ทั่วไปที่ไม่มีสิทธิ์ canDelete แต่ได้รับอนุมัติให้โหลดไฟล์ต้นฉบับได้ชั่วคราว
    if (!hasAccess) {
      const approvedRequest = await this.prisma.docAccessRequest.findFirst({
        where: {
          companyId,
          requesterId: userId,
          targetType: 'FILE',
          targetId: fileId,
          status: 'APPROVED'
        },
        include: { wfRequest: true },
        orderBy: { updatedAt: 'desc' } // เอาคำขอล่าสุดที่ได้รับการอนุมัติ
      });

      if (approvedRequest) {
        // 🔍 เช็กว่าเป็นคำขอแบบ "ต้นฉบับ" หรือไม่ (ตรวจสอบจาก Topic ของ Workflow หรือถ้าในอนาคตมีฟิลด์ accessType ก็ดักได้เลย)
        const isRawRequest = approvedRequest.wfRequest?.topic?.includes('ต้นฉบับ') || 
                     (approvedRequest as any).accessType === 'RAW_FILE';

        if (isRawRequest) {
          // ⏱️ คำนวณเวลาหมดอายุสิทธิ์ (นับจากวันที่อนุมัติ updatedAt + durationDays)
          const expireDate = new Date(approvedRequest.updatedAt);
          expireDate.setDate(expireDate.getDate() + (approvedRequest.durationDays || 1));

          if (new Date() <= expireDate) {
            hasAccess = true; // ✅ อนุมัติให้โหลดได้เพราะ Workflow ผ่านและยังไม่หมดเวลา
          }
        }
      }
    }

    // 🚨 ถ้าไม่ผ่านทั้งผู้จัดการแฟ้ม และไม่มีสิทธิ์จาก Workflow ให้เตะออกทันที
    if (!hasAccess) {
      throw new ForbiddenException('สงวนสิทธิ์การดาวน์โหลดไฟล์ต้นฉบับเฉพาะผู้จัดการแฟ้ม หรือผู้ที่ได้รับอนุมัติผ่านระบบขอสิทธิ์ (Workflow) เท่านั้น');
    }

    // --- 🛡️ ด่านที่ 3: เช็กสิทธิ์เข้าถึงไฟล์ร่าง/รออนุมัติ (Workflow Context Guard) ---
    const canAccessDraft = await this.hasDraftAccess(file, userId, roleId, false); // 🌟 เปลี่ยน isHQ เป็น false
    let targetUrl = file.currentUrl;

    if (!canAccessDraft) {
      const activeVersion = file.versions?.find(v => v.isCurrent === true);
      
      if (!activeVersion) {
        throw new ForbiddenException('เอกสารนี้อยู่ระหว่างกระบวนการตรวจสอบและอนุมัติครั้งแรก ผู้ใช้ทั่วไปยังไม่สามารถเข้าถึงได้');
      }
      
      targetUrl = activeVersion.url;
    }

    // 🌟 [CLOUD FIX] สร้าง URL เต็มสำหรับ Google Cloud Storage
    if (targetUrl && !targetUrl.startsWith('http')) {
      const bucketName = process.env.GCS_BUCKET_NAME || 'kkvbusiness_buckets';
      const cleanPath = targetUrl.startsWith('/') ? targetUrl.substring(1) : targetUrl;
      targetUrl = `https://storage.googleapis.com/${bucketName}/${cleanPath}`;
    }

    try {
      // 📥 ดึงไฟล์จาก Storage จริง
      const response = await axios.get(targetUrl, { responseType: 'arraybuffer' });
      const originalBuffer = Buffer.from(response.data);

      // 🛡️ [TAMPER-PROOF] คำนวณ SHA-256 Hash ของไฟล์ต้นฉบับ
      const fileHash = crypto.createHash('sha256').update(originalBuffer).digest('hex');

      // 📝 บันทึกประวัติว่าใครโหลดไฟล์ "ต้นฉบับ" (Hash นี้) ออกไป เพื่อใช้ในระบบ Audit Log
      await this.prisma.logDocumentTrace.create({
        data: {
                fileHash: fileHash,
                companyId: companyId, // 🌟 แก้ไข: ใช้ ID ตรงๆ 
                originalFileId: fileId, // 🌟 แก้ไข: ใช้ ID ตรงๆ
                downloadedById: userId // 🌟 แก้ไข: ใช้ ID ตรงๆ
              }
        });
      
      return {
        fileStream: new StreamableFile(originalBuffer),
        mimeType: file.fileExtension || 'application/octet-stream',
        fileName: file.fileName
      };
    } catch (error: any) {
      console.error(`[DownloadOriginal Error] พยายามโหลด URL: ${targetUrl}`);
      console.error(`รายละเอียด Error: ${error.message}`);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(`ไม่สามารถดาวน์โหลดไฟล์ต้นฉบับจาก Cloud ได้ สาเหตุ: ${error.message}`);
    }
  }


  // ==========================================
  // 🔍 Helper: ด่านตรวจสิทธิ์ "ผู้จัดการไฟล์" (ใช้ร่วมกันหลายฟังก์ชัน)
  // ==========================================
  private async checkCanManageFile(fileId: number, companyId: number, userId: number, roleId: number): Promise<boolean> {
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      include: { folder: true }
    });

    if (!file) return false;

    if (roleId === 1) return true; // Super Admin ทำได้เสมอ
    
    if (file.folderId) {
      // เช็กสิทธิ์ canDelete จากโฟลเดอร์แม่
      return await this.hasFolderAccess(file.folderId, userId, roleId, 'canDelete');
    } else {
      // ไฟล์ที่ยังไม่เข้าแฟ้ม คนอัปโหลดเป็นผู้จัดการ
      return file.uploadedById === userId;
    }
  }

  // ==========================================
  // 🛡️ 1. ดึงรายการสิทธิ์ที่ "ฉันมีอำนาจจัดการ" (โชว์ในหน้า Dashboard)
  // ==========================================
  async getManagedAccessList(companyId: number, userId: number, roleId: number) {
    const now = new Date();

    // 1. ดึงสิทธิ์ที่ "ยังไม่หมดอายุ" หรือ "ไม่มีวันหมดอายุ" ทั้งหมดของบริษัทออกมาก่อน
    const activeAccesses = await this.prisma.docFileAccess.findMany({
      where: {
        companyId,
        OR: [
          { expiresAt: { gt: now } },
          { expiresAt: null }
        ]
      },
      include: {
        file: { 
          select: { id: true, fileName: true, folderId: true, uploadedById: true } 
        },
        user: { 
          select: { id: true, fullName: true, username: true } 
        },
        role: { 
          select: { id: true, name: true, displayName: true } 
        }
      },
      orderBy: { expiresAt: 'asc' } // เรียงอันที่ใกล้หมดอายุขึ้นก่อน
    });

    // 2. กรองข้อมูล (Row-Level Security) เอาเฉพาะไฟล์ที่ฉันมีสิทธิ์ canDelete
    const managedList: any[] = [];
    for (const access of activeAccesses) {
      const canManage = await this.checkCanManageFile(access.fileId, companyId, userId, roleId);
      if (canManage) {
        managedList.push(access);
      }
    }

    return managedList;
  }

  // ==========================================
  // 🛡️ 2. ยกเลิกสิทธิ์ทันที (Revoke Access)
  // ==========================================
  async revokeFileAccessGrant(companyId: number, fileId: number, accessId: number, userId: number, roleId: number) {
    // ด่านตรวจสิทธิ์ canDelete
    const canManage = await this.checkCanManageFile(fileId, companyId, userId, roleId);
    if (!canManage) throw new ForbiddenException('คุณไม่มีสิทธิ์จัดการสิทธิ์การเข้าถึงของไฟล์นี้');

    // ลบสิทธิ์ออกจาก Database ทันที (หรือจะใช้วิธี set expiresAt = now() ก็ได้ แต่ลบออกเลยจะคลีนกว่าครับ)
    await this.prisma.docFileAccess.delete({
      where: { id: accessId }
    });

    return { message: 'ตัดสิทธิ์การเข้าถึงเรียบร้อยแล้ว ผู้ใช้นี้จะไม่สามารถเข้าถึงไฟล์ได้อีก' };
  }

  // ==========================================
  // 🛡️ 3. ขยายเวลาสิทธิ์ (Extend Access)
  // ==========================================
  async extendFileAccessGrant(companyId: number, fileId: number, accessId: number, userId: number, roleId: number, additionalDays: number) {
    // ด่านตรวจสิทธิ์ canDelete
    const canManage = await this.checkCanManageFile(fileId, companyId, userId, roleId);
    if (!canManage) throw new ForbiddenException('คุณไม่มีสิทธิ์จัดการสิทธิ์การเข้าถึงของไฟล์นี้');

    const accessRecord = await this.prisma.docFileAccess.findUnique({ where: { id: accessId } });
    if (!accessRecord) throw new NotFoundException('ไม่พบข้อมูลสิทธิ์นี้ในระบบ');

    // คำนวณวันหมดอายุใหม่ โดยนับต่อจากของเดิม (หรือนับจากปัจจุบันถ้าระบุเป็น null มา)
    const baseDate = accessRecord.expiresAt && accessRecord.expiresAt > new Date() 
                     ? accessRecord.expiresAt 
                     : new Date();
                     
    const newExpireDate = new Date(baseDate);
    newExpireDate.setDate(newExpireDate.getDate() + additionalDays);

    await this.prisma.docFileAccess.update({
      where: { id: accessId },
      data: { expiresAt: newExpireDate }
    });

    return { 
      message: `ขยายเวลาการเข้าถึงเรียบร้อยแล้ว สิทธิ์จะหมดอายุในวันที่ ${newExpireDate.toLocaleDateString('th-TH')}`,
      newExpireDate
    };
  }


// ==========================================
  // 🕒 ระบบลบไฟล์อัตโนมัติเมื่อถึงกำหนดเวลา (Retention Policy)
  // ==========================================
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) 
  async handleFileRetention() {
    const now = new Date();
    
    const expiredFiles = await this.prisma.docFile.findMany({
      where: {
        autoDeleteAt: { lte: now }
      }
    });

    if (expiredFiles.length > 0) {
      console.log(`[Retention Policy] พบเอกสารหมดอายุจำนวน ${expiredFiles.length} รายการ กำลังดำเนินการลบ...`);
      
      for (const file of expiredFiles) {
        try {
          await this.deleteFile(file.id, file.companyId, 0);
          console.log(`✅ ลบเอกสารหมดอายุสำเร็จ: ID ${file.id}`);
        } catch (error: any) {
          console.error(`❌ ลบเอกสาร ID ${file.id} ไม่สำเร็จ: ${error.message}`);
        }
      }
    }
  }

  // ==========================================
  // 🔐 [เพิ่มใหม่] กวาดลบสิทธิ์การเข้าถึงข้อมูลที่หมดอายุ (Data Access Request Revocation)
  // ==========================================
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredAccess() {
    const now = new Date();
    
    try {
      const deletedFiles = await this.prisma.docFileAccess.deleteMany({
        where: { expiresAt: { lte: now } }
      });

      const deletedFolders = await this.prisma.docFolderAccess.deleteMany({
        where: { expiresAt: { lte: now } }
      });
      
      if (deletedFiles.count > 0 || deletedFolders.count > 0) {
        console.log(`[Security] ยกเลิกสิทธิ์ที่หมดอายุเรียบร้อยแล้ว: ไฟล์ ${deletedFiles.count} รายการ, โฟลเดอร์ ${deletedFolders.count} รายการ.`);
      }
    } catch (error: any) {
      console.error(`[Security Error] ไม่สามารถดึงสิทธิ์ที่หมดอายุคืนได้: ${error.message}`);
    }
  }

  // ==========================================
  // 2. อัปโหลดเวอร์ชันใหม่ (New Version)
  // ==========================================
 async uploadNewVersion(companyId: number, fileId: number, uploadedById: number, dto: { url: string, fileSize: bigint, changeLog?: string }) {
    const doc = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      include: { wfRequest: true }
    });

    if (!doc) throw new NotFoundException('ไม่พบเอกสารที่ต้องการอัปเดต');

    if (doc.wfRequest && ['PENDING', 'IN_PROGRESS'].includes(doc.wfRequest.status)) {
      throw new BadRequestException('ไม่สามารถเพิ่มเวอร์ชันใหม่ได้ เนื่องจากเอกสารกำลังอยู่ในขั้นตอนการอนุมัติ');
    }

    return await this.prisma.$transaction(async (tx) => {
      const lastVer = await tx.docFileVersion.findFirst({
        where: { fileId, companyId },
        orderBy: { version: 'desc' }
      });
      const nextVersion = (lastVer?.version || 0) + 1;

      const newVersion = await tx.docFileVersion.create({
        data: {
          companyId,
          fileId,
          version: nextVersion,
          url: dto.url,
          size: dto.fileSize,
          uploadedById,
          changeLog: dto.changeLog || `อัปเดตเวอร์ชัน ${nextVersion}`,
        }
      });

      const updatedDoc = await tx.docFile.update({
        where: { id: fileId },
        data: {
          currentUrl: dto.url,
          currentSize: dto.fileSize,
        }
      });

      await this.storageService.linkMedia(companyId, dto.url, 'document', fileId);
      return { updatedDoc, newVersion };
    });
  }

  // ==========================================
  // 3. จัดการ Metadata สำหรับ Advanced Search (Workflow Guarded)
  // ==========================================
  async updateMetadata(companyId: number, fileId: number, metadata: { key: string, value: string }[]) {
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      include: { wfRequest: true } 
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสาร');

    if (file.wfRequest && ['PENDING', 'IN_PROGRESS'].includes(file.wfRequest.status)) {
      throw new BadRequestException('ไม่สามารถแก้ไข Metadata ได้ เนื่องจากเอกสารฉบับนี้กำลังอยู่ในขั้นตอนกระบวนการอนุมัติ');
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.docFileMetadata.deleteMany({ where: { fileId, companyId } });

      if (metadata && metadata.length > 0) {
        await tx.docFileMetadata.createMany({
          data: metadata.map(m => ({
            companyId,
            fileId,
            key: m.key,
            value: m.value
          }))
        });
      }
      return { success: true, count: metadata.length };
    });
  }


// ==========================================
  // 🚚 ฟังก์ชันย้ายไฟล์ (Strict Folder Guard + Trigger Workflow ปลายทาง)
  // ==========================================
  async moveFile(companyId: number, fileId: number, userId: number, roleId: number, newFolderId: number | null) {
    // 1. ดึงข้อมูลเอกสารและโฟลเดอร์ต้นทาง
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      include: { wfRequest: true, folder: true }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสารที่ต้องการย้าย');

    if (file.wfRequest && ['PENDING', 'IN_PROGRESS'].includes(file.wfRequest.status)) {
      throw new BadRequestException('ไม่สามารถย้ายไฟล์ได้ เนื่องจากเอกสารนี้กำลังอยู่ในกระบวนการอนุมัติ');
    }

    if (file.folderId === newFolderId) {
      return { message: 'ไฟล์อยู่ในโฟลเดอร์นี้อยู่แล้ว' };
    }

    // --- 🛡️ ด่านที่ 1: เช็กสิทธิ์ดึงไฟล์ออกจาก "โฟลเดอร์ต้นทาง" (Source Guard) ---
    let hasSourceAccess = false;
    
    if (roleId === 1) {
      hasSourceAccess = true; // Super Admin ทำได้เสมอ
    } else if (file.folderId) {
      // 🚨 ไฟล์ที่จัดเก็บแล้ว: บังคับเช็กสิทธิ์ canDelete จากโฟลเดอร์ต้นทางเท่านั้น (ตัดสิทธิ์คนอัปโหลด)
      hasSourceAccess = await this.hasFolderAccess(file.folderId, userId, roleId, 'canDelete');
    } else if (!file.folderId && file.uploadedById === userId) {
      // 🌟 ไฟล์ที่ลอยอยู่หน้า Root: อนุญาตให้คนอัปโหลดจัดการไฟล์ตัวเองเพื่อย้ายเข้าแฟ้มได้
      hasSourceAccess = true;
    }

    if (!hasSourceAccess) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ดึงไฟล์ออกจากโฟลเดอร์ต้นทาง (ต้องมีสิทธิ์จัดการแฟ้มระดับ canDelete)');
    }

    // --- 🛡️ ด่านที่ 2: เช็กสิทธิ์เอาไฟล์ไปวางใน "โฟลเดอร์ปลายทาง" (Target Guard) ---
    if (newFolderId) {
      const targetFolder = await this.prisma.docFolder.findFirst({
        where: { id: newFolderId, companyId }
      });
      if (!targetFolder) throw new NotFoundException('ไม่พบโฟลเดอร์ปลายทาง');

      let hasTargetAccess = false;
      if (roleId === 1) {
        hasTargetAccess = true;
      } else {
        // 🚨 บังคับเช็กว่ามีสิทธิ์ canUpload ในโฟลเดอร์ปลายทางหรือไม่
        hasTargetAccess = await this.hasFolderAccess(newFolderId, userId, roleId, 'canUpload');
      }
      
      if (!hasTargetAccess) {
        throw new ForbiddenException('คุณไม่มีสิทธิ์นำไฟล์ไปวางในโฟลเดอร์ปลายทาง (ต้องมีสิทธิ์อัปโหลดเอกสารเข้าแฟ้มนี้)');
      }
    }

    // 🔄 3. อัปเดตตำแหน่งย้ายจริงลงฐานข้อมูล
    await this.prisma.docFile.update({
      where: { id: fileId },
      data: { folderId: newFolderId }
    });

    // =========================================================
    // 🚦 4. ระบบตรวจสอบสายอนุมัติของแฟ้มปลายทาง (Workflow Trigger)
    // =========================================================
    let targetWorkflowId = await this.getInheritedWorkflow(newFolderId, companyId, 'UPLOAD');

    if (!targetWorkflowId) {
      const mapping = await this.prisma.wfModuleMapping.findFirst({
        where: { companyId: companyId, moduleCode: 'DOC_UPLOAD', isActive: true }
      });
      if (mapping) targetWorkflowId = mapping.workflowId;
    }

    // ถ้าย้ายไปแฟ้มที่มีสายอนุมัติ ให้เตะเข้า Workflow อัตโนมัติ
    if (targetWorkflowId) {
      console.log(`[Move File] โฟลเดอร์ปลายทางมี Workflow ID ${targetWorkflowId} กำลังส่งเรื่องอัตโนมัติ...`);

      const request: any = await this.wfRequestService.create(companyId, userId, {
        moduleCode: 'DOC_UPLOAD',
        workflowId: targetWorkflowId,
        businessId: String(fileId),
        topic: `ขออนุมัติเอกสาร (ย้ายโฟลเดอร์): ${file.fileName}`,
      } as any);

      await this.prisma.docFile.update({
        where: { id: fileId },
        data: { wfRequestId: request.id }
      });

      return { 
        message: 'ย้ายไฟล์สำเร็จ และได้ส่งเอกสารเข้าสู่กระบวนการอนุมัติของโฟลเดอร์ใหม่เรียบร้อยแล้ว',
        isPendingApproval: true
      };
    }

    return { message: 'ย้ายไฟล์สำเร็จ (โฟลเดอร์ปลายทางไม่มีเงื่อนไขสายอนุมัติบังคับ)', isPendingApproval: false };
  }

// ==========================================
  // 🌟 [NEW] ฟังก์ชันสำหรับให้ AI คัดแยกไฟล์เข้าโฟลเดอร์ (รองรับ Hint + จัดการความกำกวม + หักโควตา AI)
  // ==========================================
  async aiClassifyFileToFolder(companyId: number, fileId: number, hint?: string) {
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId }
    });
    
    if (!file) throw new NotFoundException('ไม่พบเอกสารที่ต้องการคัดแยก');

    const folders = await this.prisma.docFolder.findMany({
      where: { companyId },
      select: { id: true, name: true, description: true, parentId: true, isWorkspace: true, defaultWorkflowId: true }
    });

    if (folders.length === 0) {
      throw new BadRequestException('ยังไม่มีโฟลเดอร์ในระบบ กรุณาสร้างโฟลเดอร์ก่อนให้ AI คัดแยก');
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException('ไม่พบ API Key สำหรับเชื่อมต่อ AI');
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = "gemini-1.5-pro"; // 🌟 เก็บชื่อ Model ไว้ใช้ตอนบันทึกโควตา
      const model = genAI.getGenerativeModel({ model: modelName }); 
      
      // 🌟 นำคำใบ้ (Hint) ที่หน้าบ้านส่งมายัดใส่ Prompt แบบสั่งบังคับให้ AI ต้องให้ความสำคัญสูงสุด
      const userHint = hint ? `\nคำแนะนำเพิ่มเติมจากผู้ใช้ (บังคับใช้เป็นเงื่อนไขหลักในการเลือก): "${hint}"` : '';

      const prompt = `
        คุณคือ AI จัดหมวดหมู่เอกสารขององค์กร
        ชื่อเอกสารที่ต้องการจัดหมวดหมู่: "${file.fileName}"
        ${userHint}
        
        นี่คือรายชื่อโฟลเดอร์ทั้งหมด (ID: ชื่อโฟลเดอร์):
        ${folders.map(f => `- ${f.id}: ${f.name} (${f.description || 'ไม่มีรายละเอียด'})`).join('\n')}
        
        กรุณาวิเคราะห์ชื่อเอกสารและคำแนะนำ แล้วเลือก ID ของโฟลเดอร์ที่เหมาะสมที่สุดเพียง 1 ตัวเลขเท่านั้น ห้ามพิมพ์ข้อความอื่นเด็ดขาด
        แต่ถ้าคุณพบว่ามีโฟลเดอร์ที่เหมาะสมมากกว่า 1 ตัวเลือก และไม่สามารถฟันธงได้ หรือไม่มีข้อมูลเพียงพอ ให้ตอบเลข 0 เท่านั้น
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text().trim();
      
      // ==========================================
      // 🪙 🌟 [NEW] ระบบตัดโควตา AI (AI Token Tracking)
      // ==========================================
      const usedPromptTokens = response.usageMetadata?.promptTokenCount || 0;
      const usedCompletionTokens = response.usageMetadata?.candidatesTokenCount || 0;

      if (usedPromptTokens > 0 || usedCompletionTokens > 0) {
        try {
          // สั่งหักโควตา AI ของบริษัทนี้
          await this.aiQuotasService.recordUsage({
            companyId,
            aiBotId: 0, // ระบุเป็น 0 หรือ null ถ้านี่คือฟีเจอร์ System AI ไม่ใช่ Bot ของผู้ใช้สร้างเอง
            modelName: modelName,
            promptTokens: usedPromptTokens,
            completionTokens: usedCompletionTokens,
            source: 'DMS_AUTO_CLASSIFY' // 🌟 ระบุที่มาให้ชัดเจนเพื่อใช้ออกรายงาน
          });
        } catch (quotaError) {
          console.error('❌ Failed to deduct tokens during AI Classification:', quotaError);
          // ปล่อยผ่านไปได้ ไม่ต้อง throw error เพื่อให้ผู้ใช้ยังคงทำงานต่อได้แม้ระบบโควตาจะมีปัญหาชั่วคราว
        }
      }
      // ==========================================

      const suggestedFolderId = parseInt(responseText, 10);

      if (suggestedFolderId === 0 || isNaN(suggestedFolderId)) {
        return { 
          message: 'AI ไม่สามารถฟันธงหมวดหมู่ได้เนื่องจากมีโฟลเดอร์ที่คล้ายกัน กรุณาเลือกโฟลเดอร์ด้วยตนเอง', 
          status: 'MANUAL_REQUIRED'
        };
      }

      const validFolder = folders.find(f => f.id === suggestedFolderId);

      if (!validFolder) {
        throw new BadRequestException('AI ไม่สามารถหาโฟลเดอร์ที่เหมาะสมได้ในขณะนี้');
      }

      // 🔍 ลอจิกค้นหา Workflow (ไล่จากลูก -> แม่ -> ส่วนกลาง)
      let currentFolder: any = validFolder;
      let effectiveWfId: number | null = null;
      let isWorkspaceContext = false;

      while (currentFolder) {
        if (currentFolder.isWorkspace) isWorkspaceContext = true;
        
        if (currentFolder.defaultWorkflowId) {
          effectiveWfId = currentFolder.defaultWorkflowId;
          break; 
        }
        
        if (currentFolder.parentId) {
          currentFolder = folders.find(f => f.id === currentFolder.parentId);
        } else {
          currentFolder = null; 
        }
      }

      if (!effectiveWfId) {
        const mapping = await this.prisma.wfModuleMapping.findFirst({
          where: { companyId, moduleCode: 'DOC_MOVE', isActive: true }
        });
        if (mapping?.workflowId) {
          effectiveWfId = mapping.workflowId;
        }
      }

      if (!effectiveWfId && isWorkspaceContext) {
        throw new BadRequestException(`ไม่สามารถให้ AI ย้ายไฟล์เข้าแฟ้ม "${validFolder.name}" ได้ เนื่องจากเป็น Workspace (คลังเอกสารองค์กร) ที่ยังไม่มีการกำหนดสายอนุมัติ (Workflow) กรุณาแจ้งผู้ดูแลระบบให้ตั้งค่าก่อน`);
      }

      // 🔄 กระบวนการย้ายไฟล์และส่งเข้า Workflow
      await this.prisma.docFile.update({
        where: { id: fileId },
        data: { 
          folderId: validFolder.id,
          wfRequestId: effectiveWfId ? -1 : null 
        }
      });

      if (effectiveWfId) {
        try {
          const wfResult: any = await this.wfRequestService.create(companyId, file.uploadedById, {
            moduleCode: 'DOC_MOVE', 
            businessId: file.id,
            workflowId: effectiveWfId, 
            topic: `[AI Auto-Classify] AI จัดเก็บเอกสารเข้าแฟ้ม: ${validFolder.name}`
          });

          if (wfResult && wfResult.id) {
            await this.prisma.docFile.update({
              where: { id: fileId },
              data: { wfRequestId: wfResult.id }
            });
          }
        } catch (wfError: any) {
          await this.prisma.docFile.update({
            where: { id: fileId },
            data: { folderId: file.folderId, wfRequestId: file.wfRequestId }
          });
          throw new InternalServerErrorException(`AI คัดแยกเอกสารสำเร็จ แต่ไม่สามารถส่งเข้าสายอนุมัติได้: ${wfError.message}`);
        }
      }

      return { 
        message: effectiveWfId 
          ? 'AI คัดแยกเอกสารและส่งเข้าสายอนุมัติเรียบร้อยแล้ว' 
          : 'AI คัดแยกเอกสารและย้ายไฟล์สำเร็จ (ไม่มีเงื่อนไขสายอนุมัติ)', 
        status: 'SUCCESS',
        movedToFolder: validFolder.name
      };

    } catch (error: any) {
      console.error("AI Classification Error:", error);
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ AI คัดแยกเอกสาร');
    }
  }


// ==========================================
  // 📤 1. ส่งไฟล์เข้าสายอนุมัติ (อัปโหลด หรือ Resubmit หลังแก้เอกสาร)
  // ==========================================
  async sendToWorkflow(companyId: number, fileId: number, userId: number) { 
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      include: { 
        wfRequest: true,
        folder: true 
      }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสาร');
    
    if (file.wfRequest && ['PENDING', 'IN_PROGRESS'].includes(file.wfRequest.status)) {
      throw new BadRequestException('เอกสารนี้อยู่ระหว่างการดำเนินการ Workflow อื่นอยู่');
    }

    let targetWorkflowId = await this.getInheritedWorkflow(file.folderId, companyId, 'UPLOAD');

    if (!targetWorkflowId) {
      const mapping = await this.prisma.wfModuleMapping.findFirst({
        where: { companyId: companyId, moduleCode: 'DOC_UPLOAD', isActive: true }
      });
      if (mapping) targetWorkflowId = mapping.workflowId;
    }

    if (!targetWorkflowId) {
      throw new BadRequestException('ยังไม่ได้ตั้งค่าสายอนุมัติสำหรับเอกสาร (ไม่พบทั้งที่โฟลเดอร์และส่วนกลาง)');
    }

    const request: any = await this.wfRequestService.create(companyId, userId, {
      moduleCode: 'DOC_UPLOAD', 
      workflowId: targetWorkflowId, 
      businessId: String(fileId),
      topic: `ขออนุมัติเอกสาร: ${file.fileName}`,
    } as any); 

    await this.prisma.docFile.update({
      where: { id: fileId },
      data: { 
        wfRequestId: request.id,
        autoDeleteAt: null 
      }
    });

    return { message: 'ส่งขออนุมัติเอกสารเรียบร้อยแล้ว', requestId: request.id };
  }


// =========================================================
  // 🤖 🌟 AI Auto-Routing (Real AI Call + Token Deduction)
  // =========================================================
  async aiAutoRoute(companyId: number, fileId: number, hint?: string) {
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId }
    });
    if (!file) throw new NotFoundException('ไม่พบไฟล์เอกสารที่ระบุ');

    const TARGET_BOT_CODE = 'AUTO_ROUTER_DOC'; 
    const bot = await this.prisma.intAiBot.findFirst({
      where: { companyId: companyId, code: TARGET_BOT_CODE }
    });

    if (!bot) throw new NotFoundException(`กรุณาสร้าง AI Bot รหัส ${TARGET_BOT_CODE} ในระบบก่อนใช้งาน`);

    const folders = await this.prisma.docFolder.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' } 
    });

    if (folders.length === 0) {
      throw new BadRequestException('กรุณาสร้างโฟลเดอร์ปลายทางในระบบก่อนใช้งานฟีเจอร์นี้');
    }

    const folderList = folders.map(f => `- [ID: ${f.id}] หมวดหมู่: ${f.name}`).join('\n');
    const instruction = bot.systemPrompt || 'จงคัดแยกเอกสารเข้าโฟลเดอร์ที่เหมาะสม';
    const userHint = hint ? `\nคำแนะนำเพิ่มเติมจากผู้ใช้: "${hint}"` : '';
    
    const finalPrompt = `
      คำสั่งหลักสำหรับ AI: ${instruction} ${userHint}
      
      ข้อมูลไฟล์ปัจจุบัน:
      - ชื่อไฟล์: "${file.fileName}"
      
      รายการโฟลเดอร์ที่อนุญาตให้จัดเก็บ:
      ${folderList}

      เงื่อนไขการตอบ: 
      - ให้วิเคราะห์ความเหมาะสมและตอบกลับเฉพาะ "ตัวเลข ID" ของโฟลเดอร์เพียงอย่างเดียวเท่านั้น
      - หากพิจารณาแล้วเอกสารไม่ตรงกับหมวดหมู่ใดเลย หรือข้อมูลขัดแย้งกัน ให้ตอบกลับเป็น ID: ${folders[0].id}
    `;

    let targetFolderId: number | null = null;
    let usedPromptTokens = 0;
    let usedCompletionTokens = 0;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: bot.modelName || 'gemini-2.5-flash' });

      const result = await model.generateContent(finalPrompt);
      const response = await result.response;
      const text = response.text().trim();

      const aiChosenId = parseInt(text.replace(/[^0-9]/g, ''), 10);

      if (folders.some(f => f.id === aiChosenId)) {
        targetFolderId = aiChosenId;
      }

      usedPromptTokens = response.usageMetadata?.promptTokenCount || 0;
      usedCompletionTokens = response.usageMetadata?.candidatesTokenCount || 0;

    } catch (error) {
      console.error('❌ AI Routing Error:', error);
    }

    if (!targetFolderId) {
      const fileNameLower = file.fileName.toLowerCase();
      const hintLower = hint ? hint.toLowerCase() : '';
      
      const matchedFolder = folders.find(f => {
        const name = f.name.toLowerCase();
        if (hintLower.includes(name)) return true;
        return fileNameLower.includes(name) || 
               (fileNameLower.includes('invoice') && (name.includes('บัญชี') || name.includes('เงิน'))) ||
               (fileNameLower.includes('สัญญา') && (name.includes('กฎหมาย') || name.includes('legal'))) ||
               (fileNameLower.includes('สมัครงาน') && name.includes('hr'));
      });

      targetFolderId = matchedFolder ? matchedFolder.id : folders[0].id;
    }

    if (usedPromptTokens > 0 || usedCompletionTokens > 0) {
      try {
        await this.aiQuotasService.recordUsage({
          companyId,
          aiBotId: bot.id,
          modelName: bot.modelName || 'gemini-2.5-flash',
          promptTokens: usedPromptTokens,
          completionTokens: usedCompletionTokens,
          source: 'DMS_AUTO_ROUTER'
        });
      } catch (quotaError) {
        console.error('❌ Failed to deduct tokens:', quotaError);
      }
    }

    await this.prisma.docFile.update({
      where: { id: fileId },
      data: { folderId: targetFolderId }
    });

    const targetFolderName = folders.find(f => f.id === targetFolderId)?.name;

    return {
      success: true,
      botName: bot.name,
      processedFile: file.fileName,
      targetFolder: targetFolderName,
      tokensUsed: usedPromptTokens + usedCompletionTokens, 
      aiFeedback: `ย้ายเข้า "${targetFolderName}" สำเร็จ`
    };
  }


// ==========================================
  // ดึงรายการไฟล์ในโฟลเดอร์ (🌟 รวม Draft Guard และ Access Control)
  // ==========================================
  async getFilesByFolder(companyId: number, folderId?: number, userId: number = 0, roleId: number = 0) {
    
    // 1. คำนวณสิทธิ์ระดับโฟลเดอร์ล่วงหน้า (เอาไว้เป็น Default ให้กับไฟล์ที่อยู่ข้างใน)
    let folderHasViewAccess = false;
    if (folderId) {
      if (roleId === 1) {
        folderHasViewAccess = true;
      } else {
        folderHasViewAccess = await this.hasFolderAccess(folderId, userId, roleId, 'canView');
      }
    } else {
      folderHasViewAccess = true; // หน้า Root ให้เห็นไฟล์ของตัวเอง
    }

    // 2. ดึงไฟล์ทั้งหมดในโฟลเดอร์นั้น
    const files = await this.prisma.docFile.findMany({
      where: {
        companyId,
        folderId: folderId || null,
      },
      include: {
        uploadedBy: { select: { id: true, username: true, fullName: true } },
        accessRoles: true,
        versions: { orderBy: { version: 'desc' } }, 
        wfRequest: {
          include: { currentNode: true }
        } 
      },
      orderBy: { createdAt: 'desc' },
    });

    const result: any[] = [];

    for (const file of files) {
      // ----------------------------------------------------
      // กฎข้อ 1: กรณีไฟล์อยู่หน้า Root (ไม่ได้อยู่ในโฟลเดอร์)
      // ----------------------------------------------------
      if (!file.folderId) {
        if (roleId !== 1 && file.uploadedById !== userId) {
          continue; 
        }
      }

      // ----------------------------------------------------
      // กฎข้อ 2: Draft Guard (คัดกรองการมองเห็นตามสถานะอนุมัติ)
      // ----------------------------------------------------
      const canAccessDraft = await this.hasDraftAccess(file, userId, roleId, false);
      let isVisible = false;

      // กลุ่มที่ 1: Manager/คนอัปโหลด (เห็นทุกไฟล์เสมอ ทั้ง Draft และ Approved)
      if (canAccessDraft) {
        isVisible = true;
      } 
      // กลุ่มที่ 2: Staff ทั่วไป / ผู้ชม (จะเห็นเฉพาะไฟล์ที่ผ่านการอนุมัติแล้วเท่านั้น)
      else {
        // 🌟 [แก้บั๊ก] ถ้าไฟล์ไม่มี wfRequestId แปลว่ามันถูก "ปลดล็อก" และใช้งานได้จริงแล้ว (อนุมัติแล้ว หรือไม่มีสายอนุมัติแต่แรก)
        const isUnlockedOrApproved = !file.wfRequestId || (file.wfRequest && file.wfRequest.status === 'APPROVED');
        
        // เผื่อกรณี V2 กำลังรออนุมัติ แต่ V1 เคยอนุมัติไปแล้ว (isCurrent = true) ก็ต้องให้เห็น
        const hasActiveVersion = file.versions.find((v: any) => v.isCurrent === true);

        if (isUnlockedOrApproved || hasActiveVersion) {
           isVisible = true; 
        }
      }

      // ถ้าไม่ผ่านเกณฑ์การมองเห็น ให้ข้ามไฟล์นี้ไป (ล่องหนจากหน้า UI)
      if (!isVisible) {
        continue; 
      }

      // ----------------------------------------------------
      // กฎข้อ 3: ตรวจสอบสิทธิ์ "canView" ของไฟล์ฉบับนี้ (เพื่อแสดงปุ่ม/ขอสิทธิ์)
      // ----------------------------------------------------
      let fileHasAccess = false;
      
      if (roleId === 1) {
        fileHasAccess = true; 
      } 
      else if (!file.folderId && file.uploadedById === userId) {
        fileHasAccess = true; 
      } 
      else {
        const now = new Date();
        // เช็กสิทธิ์พิเศษที่อาจจะได้จากการ "ขอสิทธิ์" (DocFileAccess)
        const hasSpecificFileAccess = file.accessRoles && file.accessRoles.some(acc => {
          if (acc.expiresAt && new Date(acc.expiresAt) < now) return false;
          return (acc.roleId === roleId || acc.userId === userId) && acc.canView;
        });

        if (hasSpecificFileAccess) {
          fileHasAccess = true;
        } else if (file.folderId) {
          // ถ้าไม่มีสิทธิ์พิเศษ ให้ยึดตามสิทธิ์ของโฟลเดอร์แม่
          fileHasAccess = folderHasViewAccess; 
        }
      }

      // ----------------------------------------------------
      // กฎข้อ 4: การซ่อน URL ป้องกันการดาวน์โหลดตรง (Security)
      // ----------------------------------------------------
      const isLockedByPassword = !!file.filePassword; 
      const isPendingApproval = file.wfRequest && ['PENDING', 'IN_PROGRESS'].includes(file.wfRequest.status);
      
      const shouldHideUrl = isLockedByPassword || isPendingApproval || !fileHasAccess;

      result.push({
        ...file,
        filePassword: undefined, // ห้ามส่งรหัสผ่านออกไปหน้าบ้านเด็ดขาด
        isLocked: isLockedByPassword,
        hasAccess: fileHasAccess,     
        isPendingApproval: isPendingApproval, 
        currentUrl: shouldHideUrl ? null : file.currentUrl, 
        workflowStatus: file.wfRequest ? file.wfRequest.status : null,
        pendingStepName: isPendingApproval && file.wfRequest?.currentNode ? file.wfRequest.currentNode.nodeName : null,
        versions: file.versions.map((v: any) => ({
           ...v,
           url: shouldHideUrl ? null : v.url
        }))
      });
    }

    return result;
  }

 // ==========================================
  // 🌟 [แก้ไข] อัปเดตสิทธิ์ไฟล์ (ตัดสิทธิ์คนอัปโหลด บังคับใช้สิทธิ์ canDelete)
  // ==========================================
  async updateFileAccess(companyId: number, fileId: number, userId: number, roleId: number, dto: any) { 
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId: companyId }
    });

    if (!file) throw new NotFoundException('ไม่พบไฟล์ที่ระบุ');

    // 🛡️ 1. ตรวจสอบสิทธิ์การเป็น "ผู้จัดการ" (บังคับใช้ canDelete)
    let canManageAccess = false;

    if (roleId === 1) {
      canManageAccess = true; // Super Admin ทำได้เสมอ
    } else if (file.folderId) {
      // 🚨 เช็กสิทธิ์ canDelete จากโฟลเดอร์แม่เท่านั้น (ตัดสิทธิ์คนอัปโหลดทิ้ง)
      canManageAccess = await this.hasFolderAccess(file.folderId, userId, roleId, 'canDelete');
    }

    // 🚨 ถ้าไม่ผ่านด่าน -> เตะออกทันที
    if (!canManageAccess) {
      throw new ForbiddenException('ไม่อนุญาตให้แก้ไขสิทธิ์ (สงวนสิทธิ์เฉพาะผู้จัดการแฟ้มที่มีสิทธิ์ลบ หรือผู้ดูแลระบบเท่านั้น)');
    }

    // ==========================================
    // ✅ 2. เคลียร์สิทธิ์เดิมและบันทึกสิทธิ์ใหม่
    // ==========================================
    await this.prisma.docFileAccess.deleteMany({ where: { fileId } });

    if (dto.rules && dto.rules.length > 0) {
      const accessData = dto.rules.map((rule: any) => ({
        fileId,
        companyId: companyId,
        roleId: rule.roleId || null,
        userId: rule.userId || null,
        canView: rule.canView || false,
        canDownload: rule.canDownload || false,
        expiresAt: rule.expiresAt ? new Date(rule.expiresAt) : null,
      }));
      await this.prisma.docFileAccess.createMany({ data: accessData });
    }
    
    return { message: 'อัปเดตสิทธิ์การเข้าถึงเอกสารเรียบร้อยแล้ว' };
  }


  // ==========================================
  // 🗑️ 4. ลบไฟล์ (Strict Folder Guard + Workflow Trigger + AI/Storage Cleanup)
  // ==========================================
  async deleteFile(fileId: number, companyId: number, userId: number = 0, roleId: number = 0) {
    // 1. ดึงข้อมูลไฟล์เป้าหมาย
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      include: { 
        wfRequest: true,
        versions: true,
        folder: true 
      }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสาร');
    
    // 🛡️ 2. ตรวจสอบสิทธิ์การลบ (Strict Folder-Centric Security)
    const isWorkspaceTree = await this.checkIsWorkspaceTree(file.folderId);
    let hasAccess = false;
    
    if (userId === 0 || roleId === 1) { 
      hasAccess = true; // System Auto-Delete หรือ Super Admin
    } else if (file.folderId) {
      // 🚨 ไฟล์ที่อยู่ในแฟ้มแล้ว บังคับเช็กสิทธิ์ canDelete จากโฟลเดอร์แม่เท่านั้น (ตัดสิทธิ์คนอัปโหลดทิ้ง)
      hasAccess = await this.hasFolderAccess(file.folderId, userId, roleId, 'canDelete');
    } else if (!file.folderId && file.uploadedById === userId) {
      // 🌟 ไฟล์ลอยอยู่หน้า Root (ยังไม่จัดเก็บ) อนุญาตให้คนอัปโหลดลบไฟล์ขยะของตัวเองทิ้งได้
      hasAccess = true;
    }

    if (!hasAccess) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ลบเอกสารนี้ (สงวนสิทธิ์เฉพาะผู้จัดการแฟ้มที่มีสิทธิ์ลบ หรือผู้ดูแลระบบเท่านั้น)');
    }

    // 🛑 3. ตรวจสอบสถานะสายอนุมัติที่ค้างอยู่ (ถ้ามีคนกำลังขออนุมัติเอกสารนี้อยู่ ห้ามลบ)
    if (userId !== 0 && file.wfRequest && ['PENDING', 'IN_PROGRESS'].includes(file.wfRequest.status)) {
      throw new BadRequestException('ไม่สามารถลบได้เนื่องจากเอกสารนี้กำลังอยู่ในกระบวนการอนุมัติอื่นอยู่');
    }

    // 🕒 4. กรณีระบบ Auto-Delete ลบไฟล์ที่หมดอายุ ให้เคลียร์ Workflow ที่ค้างอยู่ให้ด้วย
    if (userId === 0 && file.wfRequest && ['PENDING', 'IN_PROGRESS'].includes(file.wfRequest.status)) {
      console.log(`[Retention Policy] เอกสาร ID ${fileId} หมดอายุ ขอยกเลิก Workflow คำร้อง ID ${file.wfRequestId} ที่ค้างอยู่`);
      
      await this.prisma.wfRequest.update({
        where: { id: file.wfRequest.id },
        data: { status: 'REJECTED', currentNodeId: null } 
      });

      await this.prisma.wfAction.updateMany({
        where: { requestId: file.wfRequest.id, action: 'PENDING' },
        data: { 
          action: 'CANCELLED', 
          comment: 'System Auto-Delete: เอกสารลบอัตโนมัติตามกำหนดเวลา คำร้องนี้จึงถูกยกเลิกโดยระบบ' 
        }
      });
    }

    // 🚦 5. ตรวจสอบสายอนุมัติสำหรับการทำลายเอกสาร (DOC_DELETE)
    let targetDeleteWorkflowId = await this.getInheritedWorkflow(file.folderId, companyId, 'DELETE');

    // ถ้าไม่มีสายเฉพาะที่โฟลเดอร์ ให้ดึงจากส่วนกลาง
    if (!targetDeleteWorkflowId) {
      const mapping = await this.prisma.wfModuleMapping.findFirst({
        where: { companyId: companyId, moduleCode: 'DOC_DELETE', isActive: true }
      });
      if (mapping) targetDeleteWorkflowId = mapping.workflowId;
    }

    // ถ้าเป็นคลังองค์กร (Workspace) ต้องบังคับให้มีสายทำลายเอกสารเสมอ (ห้ามปล่อยผ่าน)
    if (isWorkspaceTree) {
      if (!targetDeleteWorkflowId && userId !== 0) {
        throw new BadRequestException('เอกสารนี้อยู่ภายใต้ Workspace (คลังเอกสารกลาง) จำเป็นต้องได้รับการอนุมัติก่อนทำลาย กรุณาตั้งค่า "สายอนุมัติการทำลายเอกสาร (DOC_DELETE)" ที่โฟลเดอร์หรือตั้งค่าส่วนกลางก่อนดำเนินการ');
      }
    }

    // ส่งคำขอเข้าสายอนุมัติ DOC_DELETE (ระบบยังไม่ลบไฟล์จริง)
    if (targetDeleteWorkflowId && userId !== 0) {
      const request: any = await this.wfRequestService.create(companyId, userId, {
        moduleCode: 'DOC_DELETE',
        workflowId: targetDeleteWorkflowId,
        businessId: String(fileId),
        topic: `ขออนุมัติทำลายเอกสาร: ${file.fileName}`,
      } as any);

      await this.prisma.docFile.update({
        where: { id: fileId },
        data: { wfRequestId: request.id }
      });

      return { 
        message: 'ส่งคำขออนุมัติทำลายเอกสารเรียบร้อยแล้ว (เอกสารจะถูกลบจริงออกจากระบบเมื่อได้รับการอนุมัติ)', 
        requestId: request.id 
      };
    }

    // ==========================================
    // 🧹 ขั้นตอนการ Hard Delete (ทำลายไฟล์จริง)
    // ==========================================
    
    // 6. คืนพื้นที่ Storage โควตาให้บริษัท (ทุกเวอร์ชัน)
    try {
      for (const ver of file.versions) {
        await this.storageService.restoreQuota(companyId, ver.url);
      }
    } catch (error) {
      throw new InternalServerErrorException('เกิดข้อผิดพลาดในการคืนพื้นที่จัดเก็บไฟล์ (Storage Service Error)');
    }

    // 7. ยกเลิกคิวงาน AI (Batch Job) ที่เกี่ยวกับไฟล์นี้ที่กำลังทำงานอยู่
    try {
      const pendingJobs = await this.prisma.intAiBatchJob.findMany({
        where: { companyId: companyId, status: 'PENDING' }
      });

      const jobsToCancel = pendingJobs.filter(job => 
        job.payload && typeof job.payload === 'object' && (job.payload as any).docFileId === fileId
      );

      if (jobsToCancel.length > 0) {
        await this.prisma.intAiBatchJob.updateMany({
          where: { id: { in: jobsToCancel.map(j => j.id) } },
          data: { status: 'CANCELLED' } 
        });
      }
    } catch (error) {
      console.error(`[Delete Warning] ไม่สามารถตรวจสอบหรือยกเลิกคิว AI ของเอกสาร ID ${fileId} ได้:`, error);
    }

    // 8. ล้างข้อมูลออกจาก Vector Database (Knowledge Base)
    if (file.knowledgeBaseId) {
      await this.prisma.intKnowledgeBase.delete({ where: { id: file.knowledgeBaseId } }).catch(() => null);
    }

    // 9. ลบข้อมูลเอกสารออกจากระบบ
    await this.prisma.docFile.delete({ where: { id: fileId } });

    return { message: 'ลบเอกสารและประวัติเวอร์ชันทั้งหมดออกจากระบบเรียบร้อยแล้ว' };
  }

  // ==========================================
  // ดึงประวัติการอัปเดตเวอร์ชันทั้งหมด (Version History)
  // ==========================================
  async getVersionHistory(companyId: number, fileId: number) {
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสาร');

    const versions = await this.prisma.docFileVersion.findMany({
      where: { fileId, companyId },
      include: {
        uploadedBy: { 
          select: { id: true, username: true } 
        }
      },
      orderBy: { version: 'desc' }
    });

    return versions.map(v => ({
      ...v,
      size: v.size.toString(), 
      url: file.filePassword ? null : v.url
    }));
  }

  


 // ==========================================
  // 🔍 Helper: ฟังก์ชันปีนหา Workflow จากแฟ้มแม่ (Folder Inheritance)
  // ==========================================
  // 🌟 เพิ่มไทป์ 'ACCESS' เข้าไป
  private async getInheritedWorkflow(folderId: any, companyId: number, type: 'UPLOAD' | 'DELETE' | 'ACCESS'): Promise<number | null> {
    if (!folderId) return null;
    
    let currentFolderId: number | null = Number(folderId);
    if (isNaN(currentFolderId) || currentFolderId === 0) return null;

    while (currentFolderId) {
      const folder = await this.prisma.docFolder.findUnique({
        where: { id: currentFolderId },
        select: { 
          parentId: true, 
          defaultWorkflowId: true, 
          deleteWorkflowId: true,
          accessWorkflowId: true // 🌟 ดึงข้อมูล accessWorkflowId ออกมาด้วย
        }
      });
      
      if (!folder) break;

      // 🌟 เพิ่มเงื่อนไขเพื่อดึง ID ให้ถูกประเภท
      const targetWfId = type === 'UPLOAD' ? folder.defaultWorkflowId : 
                         type === 'DELETE' ? folder.deleteWorkflowId : 
                         folder.accessWorkflowId;

      if (targetWfId) {
        return targetWfId; 
      }

      currentFolderId = folder.parentId; 
    }
    
    return null; 
  }


// ==========================================
  // 🔍 Helper: เช็กว่าโฟลเดอร์นี้อยู่ภายใต้สายที่เป็น Workspace หรือไม่ (Tree Climbing)
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


  async syncToKnowledgeBase(companyId: number, fileId: number, processInQueue: boolean) {
    const docFile = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId },
      include: { 
        wfRequest: true,
        knowledgeBase: true 
      } 
    });

    if (!docFile) throw new NotFoundException('ไม่พบเอกสารในระบบ');

    if (docFile.wfRequest && docFile.wfRequest.status !== 'APPROVED') {
      throw new BadRequestException('ไม่สามารถส่งเข้า AI ได้ เนื่องจากเอกสารนี้ยังไม่ได้รับการอนุมัติ (ต้องเป็นสถานะ APPROVED เท่านั้น)');
    }

    let existingKbId = docFile.knowledgeBaseId;

    if (existingKbId && docFile.knowledgeBase) {
      if (docFile.currentUrl === docFile.knowledgeBase.url) {
        throw new BadRequestException('เอกสารเวอร์ชันนี้ถูกส่งเข้า AI ไปเรียบร้อยแล้ว และยังไม่มีการอัปเดตเนื้อหาใหม่ (ประหยัด Token)');
      }
    }

    const job = await this.prisma.intAiBatchJob.create({
      data: {
        companyId,
        jobType: 'KNOWLEDGE_UPLOAD_OCR', 
        status: 'PENDING',
        totalItems: 1,
        payload: {
          fileUrl: docFile.currentUrl, 
          fileName: docFile.fileName,
          mimeType: 'application/pdf', 
          fileSize: Number(docFile.currentSize),
          topic: docFile.fileName,
          docFileId: docFile.id,
          existingKnowledgeBaseId: existingKbId 
        },
      }
    });

    return { 
      message: existingKbId 
        ? 'ส่งเอกสารเวอร์ชันใหม่เข้าคิวอัปเดตความจำ AI เรียบร้อยแล้ว' 
        : 'ส่งไฟล์เข้าคิวประมวลผล AI เรียบร้อยแล้ว', 
      jobId: job.id 
    };
  }

  async estimateAiSync(companyId: number, fileId: number) {
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, companyId }
    });

    if (!file) throw new NotFoundException('ไม่พบเอกสาร');
    const sizeInKb = Number(file.currentSize) / 1024;
    let estimatedPages = Math.max(1, Math.ceil(sizeInKb / 150)); 
    const estimatedTokens = estimatedPages * 800; 

    return {
      fileName: file.fileName,
      estimatedPages,
      estimatedTokens,
      warningIsLargeFile: estimatedPages > 50,
      message: `ประเมินเบื้องต้น: เอกสารนี้อาจจะใช้โควตา AI ประมาณ ${estimatedPages} หน้า`
    };
  }
}