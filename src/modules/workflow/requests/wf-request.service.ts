import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowStatus } from '@prisma/client';
import { DocFileService } from '../../document/services/doc-file.service';

import { ManpowerRequestService } from '../../hr/manpower-requests/manpower-request.service';    
import { OrgStructureVersionService } from '../../hr/org-structure-version/org-structure-version.service' ;  
import { ReturnRequestsService } from '../../com/return-requests/return-requests.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class WfRequestService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => DocFileService)) 
    private docFileService: DocFileService,

    @Inject(forwardRef(() => ManpowerRequestService))
    private manpowerRequestService: ManpowerRequestService,

    @Inject(forwardRef(() => OrgStructureVersionService))
    private orgStructureVersionService: OrgStructureVersionService,

    @Inject(forwardRef(() => ReturnRequestsService))
    private returnRequestsService: ReturnRequestsService
  ) {}

// =========================================================
  // 1. สร้างคำร้อง (Start Workflow) + ระบบย้าย/ลบไฟล์อัจฉริยะ + Fast-Forward Bypass
  // =========================================================
  async create(companyId: number, userId: number, dto: any) {
    const cId = Number(companyId);
    const uId = Number(userId);
    let workflow: any = null;
    let targetWfId = dto.workflowId ? Number(dto.workflowId) : null;

    // =========================================================
    // 🌟 [ปรับปรุงใหม่] Logic ค้นหาสายอนุมัติแบบ Hierarchical (ลบ, อัปโหลด, ย้ายไฟล์)
    // =========================================================
    if (['DOC_DELETE', 'DOC_UPLOAD', 'DOC_MOVE'].includes(dto.moduleCode)) {
      const file = await this.prisma.docFile.findUnique({
        where: { id: Number(dto.businessId) },
        include: { folder: true } 
      });
      
      if (!file) throw new NotFoundException('ไม่พบไฟล์ที่ระบุในระบบ');

      // 🛡️ ขั้นที่ 1: ดึง Workflow จากโฟลเดอร์แม่/โฟลเดอร์ปลายทาง
      if (dto.moduleCode === 'DOC_DELETE') {
        if (file.folder && file.folder.deleteWorkflowId) targetWfId = file.folder.deleteWorkflowId; 
      } else {
        // กรณีอัปโหลดหรือย้ายไฟล์ ให้ใช้ defaultWorkflowId ของโฟลเดอร์ปลายทาง
        if (file.folder && file.folder.defaultWorkflowId) targetWfId = file.folder.defaultWorkflowId;
      }

      // 🛡️ ขั้นที่ 2: ดูที่ Module Mapping (ส่วนกลาง)
      if (!targetWfId) {
        const mapping = await this.prisma.wfModuleMapping.findFirst({
          where: { companyId: cId, moduleCode: dto.moduleCode, isActive: true }
        });
        targetWfId = mapping?.workflowId ?? null; 
      }

      // 🛡️ ขั้นที่ 3: ตรวจสอบกฎ Workspace และกรณีไม่มี Workflow เลย
      if (!targetWfId) {
        const isWorkspace = file.folder?.isWorkspace || false;

        if (dto.moduleCode === 'DOC_DELETE') {
          if (isWorkspace) throw new BadRequestException('ไม่สามารถลบไฟล์ใน Workspace ได้เนื่องจากยังไม่มีการตั้งค่าสายอนุมัติ (Workflow)');
          console.log(`[Workflow] ลบไฟล์ ID ${file.id} ทันทีเนื่องจากไม่ใช่ Workspace และไม่มี Workflow ควบคุม`);
          await this.docFileService.deleteFile(file.id, cId, uId);
          return { message: 'ลบไฟล์สำเร็จเรียบร้อยแล้ว' };
        } 
        else {
          // 🌟 กรณี DOC_UPLOAD หรือ DOC_MOVE แต่โฟลเดอร์ปลายทางไม่มี Workflow ควบคุม
          console.log(`[Workflow] อนุญาตให้ย้าย/อัปโหลดไฟล์ ID ${file.id} ทันที เนื่องจากไม่มี Workflow ควบคุมโฟลเดอร์นี้`);
          
          // ปลดล็อกไฟล์ให้ใช้งานได้เลย (Auto-Approve แบบไม่มี Workflow)
          await this.prisma.docFile.update({
             where: { id: file.id },
             data: { wfRequestId: null }
          });
          
          return { message: 'ดำเนินการสำเร็จเรียบร้อยแล้ว (ไม่มีเงื่อนไขสายอนุมัติบังคับ)' };
        }
      }
    }

    // =========================================================
    // ดึงข้อมูล Workflow (ใช้ targetWfId ที่ถูกคำนวณมา)
    // =========================================================
    if (targetWfId) {
      workflow = await this.prisma.wfDefinition.findFirst({
        where: { id: targetWfId, companyId: cId },
        include: { nodes: { orderBy: { stepOrder: 'asc' } } }
      });
    } else {
      const mapping = await this.prisma.wfModuleMapping.findFirst({
        where: { companyId: cId, moduleCode: dto.moduleCode, isActive: true },
        include: { workflow: { include: { nodes: { orderBy: { stepOrder: 'asc' } } } } }
      });
      workflow = mapping?.workflow;
    }

    if (!workflow) throw new NotFoundException(`ไม่พบการตั้งค่าสายอนุมัติ (Workflow) สำหรับรายการนี้`);

    const firstNode = workflow.nodes[0];
    if (!firstNode) throw new BadRequestException('สายอนุมัตินี้ยังไม่ได้ระบุขั้นตอน (Nodes)');

    const request = await this.prisma.wfRequest.create({
      data: {
        companyId: cId,
        workflowId: workflow.id,
        businessType: dto.moduleCode, 
        businessId: dto.businessId,
        requesterId: uId,
        topic: dto.topic,
        data: dto.data ? (typeof dto.data === 'string' ? JSON.parse(dto.data) : dto.data) : null,
        currentNodeId: firstNode.id,
        status: WorkflowStatus.IN_PROGRESS,
      }
    });

    // =========================================================
    // 🌟🌟 ระบบ Fast-Forward แบบ Look-Ahead (Top-Down Bypass)
    // =========================================================
    const userRoles = await this.prisma.secUserRole.findMany({ where: { userId: uId }, select: { roleId: true } });
    const isSuperAdmin = userRoles.some(r => r.roleId === 1);

    let tempNode = firstNode;
    let furthestNodeId: number | null = null;
    let tempVisited = new Set();
    
    while (tempNode && !tempVisited.has(tempNode.id)) {
      tempVisited.add(tempNode.id);
      if (tempNode.nodeType === 'CONDITION') {
        const isPassed = this.evaluateCondition(tempNode.conditionLogic, request.data);
        const nextId = isPassed ? tempNode.nextApproveId : tempNode.nextRejectId;
        tempNode = workflow.nodes.find((n: any) => n.id === nextId);
      } else if (tempNode.nodeType === 'FYI') {
        tempNode = workflow.nodes.find((n: any) => n.id === tempNode.nextApproveId);
      } else {
        const approvers = await this.getApproversForNode(tempNode, uId, cId);
        if (approvers.includes(uId) || isSuperAdmin) {
          furthestNodeId = tempNode.id;
        }
        tempNode = workflow.nodes.find((n: any) => n.id === tempNode.nextApproveId);
      }
    }

    let currentNodeInPath = firstNode;
    let highestApprovalNode: any = null;
    let visitedNodes = new Set();
    let pathNodes: any[] = [];

    while (currentNodeInPath && !visitedNodes.has(currentNodeInPath.id)) {
      visitedNodes.add(currentNodeInPath.id);
      pathNodes.push(currentNodeInPath);

      if (currentNodeInPath.nodeType === 'CONDITION') {
        const isPassed = this.evaluateCondition(currentNodeInPath.conditionLogic, request.data);
        const nextId = isPassed ? currentNodeInPath.nextApproveId : currentNodeInPath.nextRejectId;
        currentNodeInPath = workflow.nodes.find((n: any) => n.id === nextId);
      } 
      else if (currentNodeInPath.nodeType === 'FYI') {
        highestApprovalNode = currentNodeInPath;
        currentNodeInPath = workflow.nodes.find((n: any) => n.id === currentNodeInPath.nextApproveId);
      } 
      else {
        const approvers = await this.getApproversForNode(currentNodeInPath, uId, cId);
        const isRequesterApprover = approvers.includes(uId) || isSuperAdmin;

        if (isRequesterApprover || furthestNodeId !== null) {
           if (currentNodeInPath.id === furthestNodeId) {
              if (currentNodeInPath.voteRule === 'ALL_MUST_APPROVE' && approvers.length > 1 && !isSuperAdmin) break; 
              
              highestApprovalNode = currentNodeInPath;
              currentNodeInPath = workflow.nodes.find((n: any) => n.id === currentNodeInPath.nextApproveId);
              break; 
           } else {
              highestApprovalNode = currentNodeInPath;
              currentNodeInPath = workflow.nodes.find((n: any) => n.id === currentNodeInPath.nextApproveId);
           }
        } else {
           break; 
        }
      }
    }

    if (highestApprovalNode) {
      console.log(`[Workflow] ⚡ Fast-Forward Enabled for User: ${uId} up to Node: ${highestApprovalNode.id}`);
      for (const node of pathNodes) {
        if (node.nodeType === 'CONDITION') continue;

        if (node.nodeType === 'FYI') {
           const fyiApprovers = await this.getApproversForNode(node, uId, cId);
           const uniqueFyiIds = [...new Set(fyiApprovers.map(id => Number(id)))];
           if (uniqueFyiIds.length > 0) {
              await this.prisma.wfAction.createMany({
                data: uniqueFyiIds.map(fyiId => ({
                  requestId: request.id,
                  actorId: fyiId,
                  stepName: node.nodeName || `แจ้งทราบ`,
                  action: 'APPROVE',
                  comment: 'System Auto-Skip: ระบบได้ส่งเรื่องแจ้งให้ทราบ (FYI) เรียบร้อยแล้ว'
                }))
              });
           }
        } else {
           await this.prisma.wfAction.create({
             data: {
               requestId: request.id,
               actorId: uId,
               stepName: node.nodeName || `ขั้นตอนที่ ${node.stepOrder}`,
               action: 'APPROVE',
               comment: node.id === highestApprovalNode.id
                  ? 'System Auto-Approve: อนุมัติอัตโนมัติเนื่องจากเป็นผู้ขอรายการและมีอำนาจในขั้นตอนนี้'
                  : 'System Auto-Skip: ข้ามขั้นตอนอัตโนมัติเนื่องจากเป็นผู้อนุมัติระดับสูง (Top-Down Bypass)'
             }
           });
        }
        if (node.id === highestApprovalNode.id) break;
      }

      const nextRealNodeId = highestApprovalNode.nextApproveId;
      if (nextRealNodeId) {
         const nextNode = workflow.nodes.find((n: any) => n.id === nextRealNodeId);
         await this.processNextNodeRouting(request.id, nextNode, uId, cId, request.data, workflow.nodes);
      } else {
         await this.markAsApproved(request.id);
      }
    } else {
      await this.processNextNodeRouting(request.id, firstNode, uId, cId, request.data, workflow.nodes);
    }

    return request;
  }

// =========================================================
  // 4. ระบบ Routing อัจฉริยะ (แก้ไขบั๊กทะลวงโหนด FYI ทิ้ง)
  // =========================================================
  async processNextNodeRouting(requestId: number, targetNode: any, requesterUserId: number, companyId: number, requestData: any, allNodes: any[]) {
    let currentNode = targetNode;
    
    while (currentNode && currentNode.nodeType === 'CONDITION') {
      await this.prisma.wfRequest.update({ where: { id: requestId }, data: { currentNodeId: currentNode.id } });

      const isPassed = this.evaluateCondition(currentNode.conditionLogic, requestData);
      const nextNodeId = isPassed ? currentNode.nextApproveId : currentNode.nextRejectId;
      currentNode = nextNodeId ? allNodes.find((n: any) => n.id === nextNodeId) : null;
    }

    if (currentNode) {
      await this.prisma.wfRequest.update({ where: { id: requestId }, data: { currentNodeId: currentNode.id } });
      
      // 🌟 โยนไปให้ assignApprovers จัดการต่อว่าจะแจกงานหรือ Auto-Approve เฉพาะคน
      await this.assignApprovers(requestId, currentNode, requesterUserId, companyId, requestData, allNodes);
    } else {
      await this.markAsApproved(requestId);
    }
  }

  // =========================================================
  // 3. ฟังก์ชันค้นหาผู้อนุมัติ
  // =========================================================
  private async getApproversForNode(node: any, requesterUserId: number, companyId: number): Promise<number[]> {
    const employee = await this.prisma.hrEmployee.findFirst({
      where: { userId: Number(requesterUserId), companyId: Number(companyId) },
      include: { department: true }
    });

    let targetUserIds: number[] = [];

    if (node.dynamicApprover === 'DIRECT_MANAGER' && employee?.managerId) {
      const mgr = await this.prisma.hrEmployee.findUnique({ where: { id: employee.managerId } });
      if (mgr?.userId) targetUserIds.push(Number(mgr.userId));
    } 
    else if (node.dynamicApprover === 'DEPARTMENT_HEAD' && employee?.department?.managerId) {
      const deptMgr = await this.prisma.hrEmployee.findUnique({ where: { id: employee.department.managerId } });
      if (deptMgr?.userId) targetUserIds.push(Number(deptMgr.userId));
    }
    else if (node.approverPositionId) {
      const peers = await this.prisma.hrEmployee.findMany({
        where: { positionId: Number(node.approverPositionId), companyId: Number(companyId), isActive: true }
      });
      targetUserIds = peers.map(p => Number(p.userId)).filter(id => !isNaN(id));
    }
    else if (node.approverRoleId) {
      const usersInRole = await this.prisma.secUserRole.findMany({
        where: { roleId: Number(node.approverRoleId), companyId: Number(companyId) },
        select: { userId: true }
      });
      targetUserIds = usersInRole.map(r => Number(r.userId));
    }

    return [...new Set(targetUserIds)];
  }

  

// =========================================================
  // ฟังก์ชันแจกงาน: assignApprovers (ปรับปรุงให้โหนด FYI ผ่านอัตโนมัติ)
  // =========================================================
  async assignApprovers(
    requestId: number, 
    node: any, 
    requesterUserId: any, 
    companyId: number, 
    requestData: any, 
    allNodes: any[], 
    isSendBack: boolean = false
  ) {
    const reqUserId = Number(requesterUserId);
    const cId = Number(companyId);
    
    // ดึงคนที่มีสิทธิ์ในโหนดนี้ทั้งหมด
    const rawApproverIds = await this.getApproversForNode(node, reqUserId, cId);
    const uniqueUserIds = [...new Set(rawApproverIds.map(id => Number(id)))];

    // 🌟 1. กรณีเป็นโหนด FYI (แจ้งเพื่อทราบ)
    if (node.nodeType === 'FYI') {
      // บันทึก Log ว่า "รับทราบแล้ว (Auto-Acknowledged)" แทนที่จะให้คนไปกด
      if (uniqueUserIds.length > 0) {
        await this.prisma.wfAction.createMany({
          data: uniqueUserIds.map(uid => ({
            requestId,
            actorId: uid,
            stepName: node.nodeName || `แจ้งทราบ`,
            action: 'APPROVE', // บันทึกเป็น Approve เพื่อให้จบโหนด
            comment: 'System Auto: รับทราบข้อมูลเรียบร้อยแล้ว'
          }))
        });
      }
      
      // ทะลุผ่านโหนด FYI ไปยังโหนดถัดไปทันทีโดยไม่ต้องรอใครกด
      const nextNodeId = node.nextApproveId;
      const nextNode = nextNodeId ? allNodes.find((n: any) => n.id === nextNodeId) : null;
      return this.processNextNodeRouting(requestId, nextNode, reqUserId, cId, requestData, allNodes);
    }

    // 🌟 2. กรณีเป็นโหนดอนุมัติปกติ (APPROVAL)
    const isRequesterInvolved = uniqueUserIds.includes(reqUserId);
    const shouldAutoApprove = !isSendBack && isRequesterInvolved && !node.requireSignature;

    const pendingUserIds = shouldAutoApprove 
      ? uniqueUserIds.filter(id => id !== reqUserId) 
      : uniqueUserIds;

    // แจกกล่อง PENDING ให้คนที่ต้องรอตัดสินใจ
    if (pendingUserIds.length > 0) {
      await this.prisma.wfAction.createMany({
        data: pendingUserIds.map(uid => ({
          requestId,
          actorId: uid,
          stepName: node.nodeName || `ขั้นตอนที่ ${node.stepOrder}`,
          action: 'PENDING',
          comment: isSendBack ? 'ตีกลับ: กรุณาแก้ไขข้อมูลและพิจารณาอนุมัติอีกครั้ง' : null
        }))
      });
    }

    if (shouldAutoApprove) {
      await this.prisma.wfAction.create({
        data: {
          requestId,
          actorId: reqUserId,
          stepName: node.nodeName || `ขั้นตอนที่ ${node.stepOrder}`,
          action: 'APPROVE',
          comment: 'System Auto-Approve: อนุมัติอัตโนมัติเนื่องจากเป็นผู้ขอรายการ'
        }
      });

      // ถ้าเป็น ANY_APPROVE หรือเงื่อนไขที่อนุมัติได้ทันที ให้ทะลุโหนด
      const nextNodeId = node.nextApproveId;
      const nextNode = nextNodeId ? allNodes.find((n: any) => n.id === nextNodeId) : null;
      return this.processNextNodeRouting(requestId, nextNode, reqUserId, cId, requestData, allNodes);
    }
  }

  private async advanceToNextNode(requestId: number, nextApproveId: number | null, requesterUserId: number, companyId: number, requestData: any, allNodes: any[]) {
    if (nextApproveId) {
      const nextNode = allNodes.find((n: any) => n.id === nextApproveId);
      await this.prisma.wfRequest.update({ where: { id: requestId }, data: { currentNodeId: nextApproveId } });
      if (nextNode) await this.processNextNodeRouting(requestId, nextNode, requesterUserId, companyId, requestData, allNodes);
    } else {
      await this.markAsApproved(requestId);
    }
  }

  // =========================================================
  // 6. Helper: บันทึกสถานะจบงาน และจุดกระจายงาน (Business Hooks)
  // =========================================================
  async markAsApproved(requestId: number) {
    const request = await this.prisma.wfRequest.update({
      where: { id: requestId },
      data: { status: WorkflowStatus.APPROVED, currentNodeId: null }
    });

    console.log(`[Workflow] คำร้อง ID ${requestId} (${request.businessType}) อนุมัติสมบูรณ์แล้ว`);

    // 🌟 [ปรับปรุง] Hook สำหรับการอนุมัติ ย้ายไฟล์ และ อัปโหลดไฟล์
    if (request.businessType === 'DOC_UPLOAD' || request.businessType === 'DOC_MOVE') {
      try {
        console.log(`[Workflow Hook] อนุมัติการนำเข้า/ย้ายไฟล์ ID ${request.businessId} สำเร็จ`);
        await this.prisma.docFile.update({
          where: { id: Number(request.businessId) },
          data: { wfRequestId: null } // ปลดล็อกให้ไฟล์เข้าไปอยู่ใน Folder และพร้อมใช้งานจริง
        });
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ปลดล็อกไฟล์ไม่สำเร็จ: ${error.message}`);
      }
    }

    if (request.businessType === 'DOC_DELETE') {
      try {
        console.log(`[Workflow Hook] กำลังทำลายเอกสาร ID ${request.businessId}...`);
        await this.docFileService.deleteFile(Number(request.businessId), request.companyId, 0);
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ทำลายเอกสารไม่สำเร็จ: ${error.message}`);
      }
    }

    if (request.businessType === 'DATA_ACCESS') {
      try {
        const accessReq = await this.prisma.docAccessRequest.findUnique({ where: { wfRequestId: request.id } });
        if (accessReq) {
          const expireDate = new Date();
          expireDate.setDate(expireDate.getDate() + accessReq.durationDays);

          if (accessReq.targetType === 'FILE') {
            await this.prisma.docFileAccess.create({
              data: { companyId: accessReq.companyId, fileId: accessReq.targetId, userId: accessReq.requesterId, canView: true, canDownload: true, expiresAt: expireDate }
            });
          } else if (accessReq.targetType === 'FOLDER') {
            await this.prisma.docFolderAccess.create({
              data: { companyId: accessReq.companyId, folderId: accessReq.targetId, userId: accessReq.requesterId, canView: true, expiresAt: expireDate }
            });
          }

          await this.prisma.docAccessRequest.update({ where: { id: accessReq.id }, data: { status: 'APPROVED' } });
          console.log(`[Workflow Hook] ให้สิทธิ์เข้าถึง ${accessReq.targetType} ID ${accessReq.targetId} สำเร็จ`);
        }
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ให้สิทธิ์เข้าถึงข้อมูลไม่สำเร็จ: ${error.message}`);
      }
    }

    if (request.businessType === 'HR_MANPOWER') {
      try {
        await this.manpowerRequestService.approveAndGenerateSeats(request.companyId, Number(request.businessId));
      } catch (error: any) { console.error(`[Workflow Hook Error] สร้างอัตรากำลังไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'HR_ORG_PUBLISH') {
      try {
        await this.orgStructureVersionService.executeSyncToMaster(request.companyId, Number(request.businessId));
      } catch (error: any) { console.error(`[Workflow Hook Error] ประกาศใช้ผังองค์กรไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'RETURN_REQUEST') {
      try {
        await this.prisma.comReturnRequest.update({
          where: { companyId_docNo: { companyId: request.companyId, docNo: request.businessId } },
          data: { status: 'APPROVED' } 
        });
      } catch (error: any) { console.error(`[Workflow Hook Error] ปรับสถานะใบเคลมไม่สำเร็จ: ${error.message}`); }
    }

    // =========================================================
    // 🌟 🎁 [เพิ่มใหม่] Hook สำหรับการอนุมัติใบแลกของรางวัล (CRM_REDEMPTION)
    // =========================================================
    if (request.businessType === 'CRM_REDEMPTION') {
      try {
        console.log(`[Workflow Hook] Workflow อนุมัติใบแลกของรางวัล รหัส ${request.businessId} สำเร็จ`);
        
        // ปรับสถานะใบแลกของรางวัลเป็น COMPLETED เพื่อให้ลูกค้ามารับของหรือใช้งาน Code ได้จริง
        await this.prisma.crmRedemption.updateMany({
          where: {
            companyId: request.companyId,
            redeemCode: request.businessId // businessId ของระบบนี้เก็บค่า redeemCode (RD-XXXXX)
          },
          data: { status: 'COMPLETED' }
        });
        
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ปรับสถานะอนุมัติใบแลกของรางวัลไม่สำเร็จ: ${error.message}`);
      }
    }

    if (request.businessType === 'CRM_REDEMPTION') {
      try {
        await this.prisma.crmRedemption.updateMany({
          where: { companyId: request.companyId, redeemCode: request.businessId },
          data: { status: 'COMPLETED' }
        });
      } catch (error: any) { console.error(`[Workflow Hook Error] ปรับสถานะใบแลกรางวัลไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'PURCHASE_ORDER') {
      try {
        await this.prisma.proPurchaseOrder.update({
          where: { companyId_docNo: { companyId: request.companyId, docNo: request.businessId } },
          data: { status: 'APPROVED' } 
        });
      } catch (error: any) { console.error(`[Workflow Hook Error] ปรับสถานะใบสั่งซื้อไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'HR_TRAINING_SESSION') {
      try {
        await this.prisma.hrTrainingSession.update({
          where: { id: Number(request.businessId) }, data: { status: 'PUBLISHED' }
        });
      } catch (error: any) { console.error(`[Workflow Hook Error] อัปเดตสถานะคลาสเรียนไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'HR_TRAINING_ENROLL') {
      try {
        await this.prisma.hrTrainingEnrollment.update({
          where: { id: Number(request.businessId) }, data: { status: 'REGISTERED' } 
        });
      } catch (error: any) { console.error(`[Workflow Hook Error] อัปเดตสถานะการอบรมไม่สำเร็จ: ${error.message}`); }
    }


  }

  // =========================================================
  // 6.2 Helper: บันทึกสถานะไม่อนุมัติ/ยกเลิก (Business Hooks สำหรับ Reject)
  // =========================================================
  async markAsRejected(requestId: number) {
    const request = await this.prisma.wfRequest.update({
      where: { id: requestId },
      data: { status: WorkflowStatus.REJECTED, currentNodeId: null }
    });

    console.log(`[Workflow] คำร้อง ID ${requestId} (${request.businessType}) ถูกปฏิเสธ/ยกเลิก!`);

    // 🌟 [ปรับปรุง] Hook สำหรับการย้ายไฟล์ไม่สำเร็จ (DOC_MOVE)
    if (request.businessType === 'DOC_MOVE') {
      try {
        console.log(`[Workflow Hook] ไม่อนุมัติการย้ายไฟล์ ID ${request.businessId} ปลดล็อกสถานะ...`);
        // ปลดล็อก wfRequestId เพื่อไม่ให้ไฟล์ค้าง PENDING 
        // (ส่วนการย้ายกลับ Folder เดิม หน้าบ้านอาจจะต้องยิง API Update กลับมาครับ)
        await this.prisma.docFile.update({
          where: { id: Number(request.businessId) },
          data: { wfRequestId: null }
        });
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ปลดล็อกเอกสารจากการย้ายไม่สำเร็จ: ${error.message}`);
      }
    }

    if (request.businessType === 'DATA_ACCESS') {
      try {
        await this.prisma.docAccessRequest.update({ where: { id: Number(request.businessId) }, data: { status: 'REJECTED' } });
      } catch (error: any) { console.error(`[Workflow Hook Error] อัปเดตสถานะปฏิเสธสิทธิ์ไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'DOC_DELETE') {
      try {
        await this.prisma.docFile.update({ where: { id: Number(request.businessId) }, data: { wfRequestId: null } });
      } catch (error: any) { console.error(`[Workflow Hook Error] ปลดล็อกเอกสารจากการขอลบไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'DOC_UPLOAD' && request.businessId) {
      try {
        const fileId = parseInt(request.businessId, 10);
        if (!isNaN(fileId)) {
          const deleteDate = new Date();
          deleteDate.setDate(deleteDate.getDate() + 7); 
          await this.prisma.docFile.update({ where: { id: fileId }, data: { autoDeleteAt: deleteDate } });
        }
      } catch (error: any) { console.error(`[Workflow Hook Error] ตั้งเวลาลบเอกสารไม่สำเร็จ: ${error.message}`); }
    }

    

    if (request.businessType === 'HR_ORG_PUBLISH') {
      try {
        await this.orgStructureVersionService.revertToDraft(request.companyId, Number(request.businessId));
      } catch (error: any) { console.error(`[Workflow Hook Error] ตีดราฟต์กลับไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'HR_MANPOWER') {
      try {
        await this.prisma.hrManpowerRequest.update({ where: { id: Number(request.businessId) }, data: { wfRequestId: null } });
      } catch (error: any) { console.error(`[Workflow Hook Error] ปลดล็อกใบขอคนไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'RETURN_REQUEST') {
      try {
        await this.prisma.comReturnRequest.update({
          where: { companyId_docNo: { companyId: request.companyId, docNo: request.businessId } },
          data: { status: 'REJECTED' } 
        });
      } catch (error: any) { console.error(`[Workflow Hook Error] ปรับสถานะปฏิเสธใบเคลมไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'CRM_REDEMPTION') {
      try {
        const redemption = await this.prisma.crmRedemption.findFirst({
          where: { redeemCode: request.businessId, companyId: request.companyId }, include: { reward: true }
        });
        if (redemption && redemption.status === 'PENDING') {
          await this.prisma.$transaction(async (tx) => {
            await tx.crmRedemption.update({ where: { id: redemption.id }, data: { status: 'CANCELLED' } });
            if (redemption.shopId) {
              const shopMember = await tx.crmMemberShop.findUnique({
                where: { memberId_shopId: { memberId: redemption.memberId, shopId: redemption.shopId } }
              });
              if (shopMember) {
                const newBalance = shopMember.pointBalance + redemption.pointUsed;
                await tx.crmMemberShop.update({ where: { id: shopMember.id }, data: { pointBalance: newBalance } });
                await tx.crmPointLog.create({
                  data: {
                    companyId: redemption.companyId, memberId: redemption.memberId, amount: redemption.pointUsed, 
                    balanceAfter: newBalance, action: 'ADJUSTMENT', note: `คืนคะแนน: ${redemption.redeemCode}`, refRedemptionId: redemption.id
                  }
                });
              }
            }
            if (redemption.reward && redemption.reward.stockQty !== null) {
              await tx.crmReward.update({ where: { id: redemption.rewardId }, data: { stockQty: { increment: 1 } } });
            }
          });
        }
      } catch (error: any) { console.error(`[Workflow Hook Error] คืนแต้มไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'PURCHASE_ORDER') {
      try {
        await this.prisma.proPurchaseOrder.update({
          where: { companyId_docNo: { companyId: request.companyId, docNo: request.businessId } },
          data: { status: 'REJECTED' } 
        });
      } catch (error: any) { console.error(`[Workflow Hook Error] ปรับสถานะปฏิเสธใบสั่งซื้อไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'HR_TRAINING_SESSION') {
      try {
        await this.prisma.hrTrainingSession.update({ where: { id: Number(request.businessId) }, data: { status: 'CANCELLED' } });
      } catch (error: any) { console.error(`[Workflow Hook Error] ยกเลิกคลาสเรียนไม่สำเร็จ: ${error.message}`); }
    }

    if (request.businessType === 'HR_TRAINING_ENROLL') {
      try {
        await this.prisma.hrTrainingEnrollment.update({ where: { id: Number(request.businessId) }, data: { status: 'REJECTED' } });
      } catch (error: any) { console.error(`[Workflow Hook Error] ปฏิเสธสถานะการอบรมไม่สำเร็จ: ${error.message}`); }
    }
  }

 // =========================================================
  // 7. Helper: ประเมินผลเงื่อนไข
  // =========================================================
  private evaluateCondition(conditionLogic: any, payload: any): boolean {
    if (!conditionLogic || !payload) return true;
    const { field, operator, value } = conditionLogic;
    const actualValue = payload[field];
    if (actualValue === undefined || actualValue === null) return false;

    switch (operator) {
      case '>': return Number(actualValue) > Number(value);
      case '>=': return Number(actualValue) >= Number(value);
      case '<': return Number(actualValue) < Number(value);
      case '<=': return Number(actualValue) <= Number(value);
      case '==': 
      case '===': return String(actualValue) === String(value);
      case '!=': 
      case '!==': return String(actualValue) !== String(value);
      default: return false;
    }
  }

// =========================================================
  // 📥 ดึงรายการรออนุมัติของฉัน
  // =========================================================
  async getMyInbox(companyId: number, userId: number) {
    const now = new Date();
    const activeDelegations = await this.prisma.secUserDelegation.findMany({
      where: { delegateUserId: userId, startDate: { lte: now }, endDate: { gte: now } }
    });

    const delegatorIds = activeDelegations.map(d => d.ownerUserId);
    const allTargetUserIds = [userId, ...delegatorIds];

    const pendingActions = await this.prisma.wfAction.findMany({
      where: { action: 'PENDING', actorId: { in: allTargetUserIds }, request: { companyId: companyId } },
      include: {
        request: { include: { requester: { select: { fullName: true, username: true } }, currentNode: true } },
        actor: { select: { fullName: true, username: true } } 
      },
      orderBy: { createdAt: 'desc' }
    });

    return pendingActions.map(action => {
      const isDelegated = action.actorId !== userId;
      return {
        ...action.request, actionId: action.id, isDelegated: isDelegated,
        delegatorName: isDelegated ? (action.actor.fullName || action.actor.username) : null
      };
    });
  }

async findAll(companyId: number, status?: string) {
    return this.prisma.wfRequest.findMany({
      where: { companyId, status: status as WorkflowStatus || undefined },
      include: { requester: { select: { fullName: true, username: true } }, currentNode: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: number, companyId: number, userId: number, roleId: number) {
    const request = await this.prisma.wfRequest.findFirst({
      where: { id, companyId },
      include: { 
        requester: { select: { fullName: true, username: true } }, 
        currentNode: true 
      }
    });

    if (!request) throw new NotFoundException('ไม่พบคำร้องที่ระบุ');

    // 🌟 [NEW LOGIC] คำนวณสิทธิ์การแสดงปุ่ม Recall ให้หน้าบ้าน
    let canRecall = false;

    // กฎข้อที่ 1: เรื่องต้องยังอยู่ระหว่างดำเนินการเท่านั้น (ถ้า Approved หรือ Rejected จบไปแล้วจะดึงกลับไม่ได้)
    if (request.status === WorkflowStatus.IN_PROGRESS) {
      
      // กฎข้อที่ 2: ถ้าเป็น Super Admin ให้สิทธิ์ดึงกลับเพื่อเข้าไปแก้ไขสถานการณ์ได้ตลอดเวลา
      if (roleId === 1 || userId === 1) {
        canRecall = true;
      } else {
        // กฎข้อที่ 3: ค้นหาบุคคลล่าสุดที่กด APPROVE จริงๆ (สกัดเอา System Auto-Action ออกไป)
        const lastApproveAction = await this.prisma.wfAction.findFirst({
          where: { 
            requestId: id, 
            action: 'APPROVE', 
            comment: { not: { contains: 'System Auto' } } 
          },
          orderBy: { id: 'desc' }
        });

        // เฉพาะคนล่าสุดที่กดและทำให้ Step เปลี่ยนเท่านั้น ถึงจะมีสิทธิ์เห็นปุ่มนี้
        if (lastApproveAction && lastApproveAction.actorId === userId) {
          canRecall = true;
        }
      }
    }

    // ส่งข้อมูล Request พร้อมแปะ Flag สิทธิ์แกะกล่องให้หน้าบ้านเอาไปใช้วาดปุ่ม
    return {
      ...request,
      canRecall // 🚀 หน้าบ้านใช้ตัวนี้ตรวจสอบได้เลย เช่น *ngIf="request.canRecall" หรือ request.canRecall && <Button />
    };
  }
}