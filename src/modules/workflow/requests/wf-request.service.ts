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
  // 1. สร้างคำร้อง (Start Workflow) + ระบบ Fast-Forward (Top-Down Bypass)
  // =========================================================
  async create(companyId: number, userId: number, dto: any) {
    const cId = Number(companyId);
    const uId = Number(userId);
    let workflow: any = null;

    if (dto.workflowId) {
      workflow = await this.prisma.wfDefinition.findFirst({
        where: { id: Number(dto.workflowId), companyId: cId },
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

    // 🌟🌟 ระบบ Fast-Forward แบบ Look-Ahead (Top-Down Bypass)
    // เช็กว่าเป็น Super Admin ระดับระบบหรือไม่
    const userRoles = await this.prisma.secUserRole.findMany({ where: { userId: uId }, select: { roleId: true } });
    const isSuperAdmin = userRoles.some(r => r.roleId === 1);

    // --- 1. ค้นหาโหนดที่ลึกที่สุดที่ผู้ขอมีสิทธิ์อนุมัติ ---
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

    // --- 2. ทะลวงสายอนุมัติ (Bypass) ไปจนถึงโหนดอำนาจสูงสุด ---
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

        // ถ้าผู้ขอมีอำนาจในโหนดนี้ หรือมีอำนาจในโหนดที่ลึกกว่า (Top-Down Bypass)
        if (isRequesterApprover || furthestNodeId !== null) {
           if (currentNodeInPath.id === furthestNodeId) {
              // ถึงจุดสูงสุดของอำนาจแล้ว
              // ถ้าโหนดนี้บังคับ ALL_MUST_APPROVE และไม่ได้เป็น Super Admin จะทะลวงไม่ได้ ต้องรอคนอื่น
              if (currentNodeInPath.voteRule === 'ALL_MUST_APPROVE' && approvers.length > 1 && !isSuperAdmin) {
                  break; 
              }
              
              // อนุมัติโหนดสุดท้ายในอำนาจตัวเองให้จบ (ข้าม requireSignature ไปเลยตามเงื่อนไขของ User)
              highestApprovalNode = currentNodeInPath;
              currentNodeInPath = workflow.nodes.find((n: any) => n.id === currentNodeInPath.nextApproveId);
              break; 
           } else {
              // โหนดนี้ต่ำกว่าระดับอำนาจที่มี ทะลวงข้ามได้เลย
              highestApprovalNode = currentNodeInPath;
              currentNodeInPath = workflow.nodes.find((n: any) => n.id === currentNodeInPath.nextApproveId);
           }
        } else {
           // ไม่มีสิทธิ์ใดๆ ให้เบรกรอการทำงานตามปกติ
           break; 
        }
      }
    }

    // --- 3. บันทึกประวัติ Action สำหรับโหนดที่ถูกทะลวงผ่าน ---
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
      // ถ้าระบบไม่ได้ Fast-Forward (เช่น Manager1 ติดโหนด ALL_MUST_APPROVE) ให้รัน Route มาตรฐาน
      await this.processNextNodeRouting(request.id, firstNode, uId, cId, request.data, workflow.nodes);
    }

    return request;
  }

  // =========================================================
  // 🌟 4. ระบบ Routing อัจฉริยะ (ทะลวงผ่าน CONDITION และ FYI อัตโนมัติ)
  // =========================================================
  async processNextNodeRouting(requestId: number, targetNode: any, requesterUserId: number, companyId: number, requestData: any, allNodes: any[]) {
    let currentNode = targetNode;
    
    // 🚀 วนลูปเดินหน้าเรื่อยๆ ตราบใดที่ยังเจอโหนดทางแยก(CONDITION) หรือโหนดแจ้งทราบ(FYI)
    while (currentNode && (currentNode.nodeType === 'CONDITION' || currentNode.nodeType === 'FYI')) {
      
      // อัปเดตเข็มทิศชั่วคราวว่าวิ่งมาถึงนี่แล้ว
      await this.prisma.wfRequest.update({ where: { id: requestId }, data: { currentNodeId: currentNode.id } });

      if (currentNode.nodeType === 'CONDITION') {
        const isPassed = this.evaluateCondition(currentNode.conditionLogic, requestData);
        const nextNodeId = isPassed ? currentNode.nextApproveId : currentNode.nextRejectId;
        currentNode = nextNodeId ? allNodes.find((n: any) => n.id === nextNodeId) : null;
      }
      else if (currentNode.nodeType === 'FYI') {
        // ดึงรายชื่อผู้ที่ต้องรับทราบ
        const rawApproverIds = await this.getApproversForNode(currentNode, requesterUserId, companyId);
        const uniqueUserIds = [...new Set(rawApproverIds.map(id => Number(id)))];

        if (uniqueUserIds.length > 0) {
          // 📝 สร้างประวัติ "แจ้งให้ทราบแล้ว" ทิ้งไว้ให้ ไม่ต้องสร้างกล่อง PENDING
          await this.prisma.wfAction.createMany({
            data: uniqueUserIds.map(uid => ({
              requestId,
              actorId: uid,
              stepName: currentNode.nodeName || `แจ้งทราบ`,
              action: 'APPROVE', // ถือว่า Action สมบูรณ์แบบ
              comment: 'System Auto-Skip: ระบบได้ส่งเรื่องแจ้งให้ทราบ (FYI) เรียบร้อยแล้ว'
            }))
          });
        }
        console.log(`[Workflow] ⏭️ Auto-Skip FYI Node for Request: ${requestId}`);
        
        // วิ่งไปโหนดเป้าหมายถัดไป (FYI มีทางออกทางเดียวคือ Approve)
        const nextNodeId = currentNode.nextApproveId;
        currentNode = nextNodeId ? allNodes.find((n: any) => n.id === nextNodeId) : null;
      }
    }

    // เมื่อหลุดลูปมา (แปลว่าเจอโหนด APPROVAL ของจริง หรือจบสายแล้ว)
    if (currentNode) {
      await this.prisma.wfRequest.update({ where: { id: requestId }, data: { currentNodeId: currentNode.id } });
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
  // ฟังก์ชันแจกงาน: assignApprovers (ป้องกัน Auto-Approve ตอนตีกลับ)
  // =========================================================
  async assignApprovers(
    requestId: number, 
    node: any, 
    requesterUserId: any, 
    companyId: number, 
    requestData: any, 
    allNodes: any[], 
    isSendBack: boolean = false // 🌟 เพิ่ม Flag สำหรับป้องกัน Auto-Approve
  ) {
    const reqUserId = Number(requesterUserId);
    const cId = Number(companyId);
    
    // ดึงรายชื่อคนที่มีสิทธิ์ใน Node นี้ (ประมวลผลคำนวณใหม่ทุกครั้ง)
    const rawApproverIds = await this.getApproversForNode(node, reqUserId, cId);
    const uniqueUserIds = [...new Set(rawApproverIds.map(id => Number(id)))];

    // เช็กว่าคนขอเรื่อง เป็นหนึ่งในคนที่ต้องอนุมัติหรือไม่
    const isRequesterInvolved = uniqueUserIds.includes(reqUserId);
    
    // 🛑 🛑 กฎเหล็ก: ถ้าเป็นการตีกลับ (SEND_BACK) ห้าม Auto-Approve เด็ดขาด!! บังคับให้ทุกคนต้องกดเอง
    const shouldAutoApprove = !isSendBack && isRequesterInvolved && !node.requireSignature;

    const pendingUserIds = shouldAutoApprove 
      ? uniqueUserIds.filter(id => id !== reqUserId) 
      : uniqueUserIds;

    // สร้าง PENDING ให้ทุกคนที่มีสิทธิ์ (ถ้าตีกลับ Manager ทุกคนใน Step 1 จะได้ PENDING)
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

    // ลอจิก Auto-Approve (จะทำงานเฉพาะตอนเดินเรื่องไปข้างหน้าปกติ)
    if (shouldAutoApprove) {
      console.log(`[Workflow] ⚡ Auto-Approve สำหรับผู้ขอเรื่อง: ${reqUserId}`);
      
      await this.prisma.wfAction.create({
        data: {
          requestId,
          actorId: reqUserId,
          stepName: node.nodeName || `ขั้นตอนที่ ${node.stepOrder}`,
          action: 'APPROVE',
          comment: 'System Auto-Approve: อนุมัติอัตโนมัติเนื่องจากเป็นผู้ขอรายการ'
        }
      });

      if (node.voteRule === 'ALL_MUST_APPROVE' && uniqueUserIds.length > 1) {
        return; 
      }

      if (pendingUserIds.length > 0) {
          await this.prisma.wfAction.updateMany({
            where: { requestId, action: 'PENDING', actorId: { in: pendingUserIds }, stepName: node.nodeName || `ขั้นตอนที่ ${node.stepOrder}` },
            data: { action: 'CANCELLED', comment: 'ถูกยกเลิกเนื่องจากได้รับการอนุมัติอัตโนมัติไปแล้ว' }
          });
      }

      return this.processNextNodeRouting(requestId, node, reqUserId, cId, requestData, allNodes);
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
        const accessReq = await this.prisma.docAccessRequest.findUnique({
          where: { wfRequestId: request.id }
        });

        if (accessReq) {
          const expireDate = new Date();
          expireDate.setDate(expireDate.getDate() + accessReq.durationDays);

          if (accessReq.targetType === 'FILE') {
            await this.prisma.docFileAccess.create({
              data: {
                companyId: accessReq.companyId,
                fileId: accessReq.targetId,
                userId: accessReq.requesterId,
                canView: true,
                canDownload: true,
                expiresAt: expireDate
              }
            });
          } else if (accessReq.targetType === 'FOLDER') {
            await this.prisma.docFolderAccess.create({
              data: {
                companyId: accessReq.companyId,
                folderId: accessReq.targetId,
                userId: accessReq.requesterId,
                canView: true,
                expiresAt: expireDate
              }
            });
          }

          await this.prisma.docAccessRequest.update({
            where: { id: accessReq.id },
            data: { status: 'APPROVED' }
          });
          
          console.log(`[Workflow Hook] ให้สิทธิ์เข้าถึง ${accessReq.targetType} ID ${accessReq.targetId} สำเร็จ`);
        }
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ให้สิทธิ์เข้าถึงข้อมูลไม่สำเร็จ: ${error.message}`);
      }
    }

    // 🌟 [เพิ่มใหม่] 1. Hook สำหรับการขออัตรากำลัง
    if (request.businessType === 'HR_MANPOWER') {
      try {
        console.log(`[Workflow Hook] อนุมัติการขอคนสำเร็จ กำลังสร้างเก้าอี้สำหรับคำร้อง ID ${request.businessId}...`);
        await this.manpowerRequestService.approveAndGenerateSeats(request.companyId, Number(request.businessId));
      } catch (error: any) {
        console.error(`[Workflow Hook Error] สร้างอัตรากำลังไม่สำเร็จ: ${error.message}`);
      }
    }

    // 🌟 [เพิ่มใหม่] 2. Hook สำหรับการประกาศใช้โครงสร้างองค์กร
    if (request.businessType === 'HR_ORG_PUBLISH') {
      try {
        console.log(`[Workflow Hook] อนุมัติผังองค์กรสำเร็จ กำลังซิงค์โครงสร้าง ID ${request.businessId} ลงตาราง Master...`);
        await this.orgStructureVersionService.executeSyncToMaster(request.companyId, Number(request.businessId));
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ประกาศใช้ผังองค์กรไม่สำเร็จ: ${error.message}`);
      }
    }

    // 🌟 📦 [เพิ่มใหม่] 3. Hook สำหรับการอนุมัติคำขอคืน/เคลมสินค้า (RETURN_REQUEST)
    if (request.businessType === 'RETURN_REQUEST') {
      try {
        console.log(`[Workflow Hook] Workflow อนุมัติใบเคลมสินค้า เลขที่ ${request.businessId} สำเร็จ`);
        
        // อัปเดตสถานะคำขอคืนสินค้าเป็น APPROVED (ผ่านการพิจารณา) เพื่อให้หน้าบ้านดำเนินกระบวนการส่งคืน/คืนเงิน ต่อได้เลย
        await this.prisma.comReturnRequest.update({
          where: {
            companyId_docNo: {
              companyId: request.companyId,
              docNo: request.businessId // ในระบบเคลม บันทึก businessId เป็น docNo (RMA-XXXX)
            }
          },
          data: { status: 'APPROVED' } // หรือใช้ RmaStatus.APPROVED ตาม Prisma Client
        });
        
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ปรับสถานะอนุมัติใบเคลมสินค้าไม่สำเร็จ: ${error.message}`);
      }
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

    // =========================================================
    // 🌟 🛒 [เพิ่มใหม่] Hook สำหรับการอนุมัติใบสั่งซื้อสินค้า (PURCHASE_ORDER)
    // =========================================================
    if (request.businessType === 'PURCHASE_ORDER') {
      try {
        console.log(`[Workflow Hook] Workflow อนุมัติใบสั่งซื้อสินค้า เลขที่ ${request.businessId} สำเร็จ`);
        
        // ปรับสถานะใบ PO เป็น APPROVED เพื่อปลดล็อกให้พนักงานคลังสามารถกด "รับสินค้าเข้าคลัง" ได้
        await this.prisma.proPurchaseOrder.update({
          where: {
            companyId_docNo: {
              companyId: request.companyId,
              docNo: request.businessId 
            }
          },
          data: { status: 'APPROVED' } 
        });
        
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ปรับสถานะอนุมัติใบสั่งซื้อไม่สำเร็จ: ${error.message}`);
      }
    }

    // =========================================================
    // 🌟 🎓 [เพิ่มใหม่] Hook สำหรับการเปิดคลาสเรียน (Training Session)
    // =========================================================
    if (request.businessType === 'HR_TRAINING_SESSION') {
      try {
        console.log(`[Workflow Hook] อนุมัติการเปิดคลาสเรียน เปลี่ยนสถานะ Session ID ${request.businessId}...`);
        await this.prisma.hrTrainingSession.update({
          where: { id: Number(request.businessId) },
          data: { status: 'PUBLISHED' } // 💡 อนุมัติแล้วปรับสถานะเป็นประกาศเปิดรับสมัคร
        });
      } catch (error: any) {
        console.error(`[Workflow Hook Error] อัปเดตสถานะคลาสเรียนไม่สำเร็จ: ${error.message}`);
      }
    }

    // =========================================================
    // 🌟 🎓 [เพิ่มใหม่] Hook สำหรับการอนุมัติพนักงานเข้าอบรม
    // =========================================================
    if (request.businessType === 'HR_TRAINING_ENROLL') {
      try {
        console.log(`[Workflow Hook] อนุมัติการเข้าอบรม เปลี่ยนสถานะ Enrollment ID ${request.businessId}...`);
        await this.prisma.hrTrainingEnrollment.update({
          where: { id: Number(request.businessId) },
          data: { status: 'REGISTERED' } 
        });
      } catch (error: any) {
        console.error(`[Workflow Hook Error] อัปเดตสถานะการอบรมไม่สำเร็จ: ${error.message}`);
      }
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

    // =========================================================
    // 🌟 📄 [เพิ่มใหม่] Hook สำหรับการปฏิเสธขอสิทธิ์เข้าถึงข้อมูล (DATA_ACCESS)
    // =========================================================
    if (request.businessType === 'DATA_ACCESS') {
      try {
        console.log(`[Workflow Hook] ไม่อนุมัติสิทธิ์เข้าถึงข้อมูล กำลังอัปเดตคำร้อง ID ${request.businessId}...`);
        
        // อัปเดตตารางคำขอ (docAccessRequest) ให้เป็น REJECTED เพื่อปิดงานไม่ให้ค้าง PENDING
        await this.prisma.docAccessRequest.update({
          where: { id: Number(request.businessId) }, // ใช้ businessId เพราะตอนสร้างเราฝาก ID ของตารางนี้มา
          data: { status: 'REJECTED' }
        });
        
      } catch (error: any) {
        console.error(`[Workflow Hook Error] อัปเดตสถานะปฏิเสธสิทธิ์เข้าถึงไม่สำเร็จ: ${error.message}`);
      }
    }

    // =========================================================
    // 🌟 🗑️ [เพิ่มใหม่] Hook สำหรับการปฏิเสธการทำลายเอกสาร (DOC_DELETE)
    // =========================================================
    if (request.businessType === 'DOC_DELETE') {
      try {
        console.log(`[Workflow Hook] ไม่อนุมัติการทำลายเอกสาร กำลังปลดล็อกไฟล์ ID ${request.businessId}...`);
        
        // ปลดล็อก wfRequestId ออกจาก DocFile เพื่อให้เอกสารกลับคืนสู่สถานะปกติ
        // และสามารถทำรายการอื่นๆ (เช่น ขอลบใหม่ในอนาคต) ได้
        await this.prisma.docFile.update({
          where: { id: Number(request.businessId) },
          data: { wfRequestId: null }
        });
        
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ปลดล็อกเอกสารจากการขอลบไม่สำเร็จ: ${error.message}`);
      }
    }

    // =========================================================
    // 🌟 📄 [เพิ่มใหม่] Hook สำหรับเอกสารที่ถูกตีตก (DOC_UPLOAD) ให้เวลา 7 วันก่อนลบทิ้ง
    // =========================================================
    if (request.businessType === 'DOC_UPLOAD' && request.businessId) {
      try {
        console.log(`[Workflow Hook] ไม่อนุมัติเอกสาร ID ${request.businessId} กำลังตั้งเวลาลบทิ้งในอีก 7 วัน...`);
        const fileId = parseInt(request.businessId, 10);
        if (!isNaN(fileId)) {
          const deleteDate = new Date();
          deleteDate.setDate(deleteDate.getDate() + 7); 
          await this.prisma.docFile.update({
            where: { id: fileId },
            data: { autoDeleteAt: deleteDate }
          });
        }
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ตั้งเวลาลบเอกสารไม่สำเร็จ: ${error.message}`);
      }
    }

    // 🌟 [เพิ่มใหม่] Hook สำหรับตีดราฟต์ผังองค์กรกลับ
    if (request.businessType === 'HR_ORG_PUBLISH') {
      try {
        console.log(`[Workflow Hook] ไม่อนุมัติผังองค์กร กำลังตีดราฟต์ ID ${request.businessId} กลับให้แก้ไข...`);
        // เรียกใช้ฟังก์ชัน revertToDraft ที่เราสร้างไว้ใน orgStructureVersionService
        await this.orgStructureVersionService.revertToDraft(request.companyId, Number(request.businessId));
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ตีดราฟต์กลับไม่สำเร็จ: ${error.message}`);
      }
    }

    // 🌟 [เพิ่มใหม่] Hook สำหรับการขออัตรากำลัง (ถ้าโดน Reject ก็ปลดล็อกให้แก้ส่งใหม่ได้)
    if (request.businessType === 'HR_MANPOWER') {
      try {
        console.log(`[Workflow Hook] ไม่อนุมัติขออัตรากำลัง กำลังปลดล็อกคำร้อง ID ${request.businessId}...`);
        await this.prisma.hrManpowerRequest.update({
          where: { id: Number(request.businessId) },
          data: { wfRequestId: null } // ปลดเลข Workflow ออก เพื่อให้หน้าบ้านกด Edit / Submit ใหม่ได้
        });
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ปลดล็อกใบขอคนไม่สำเร็จ: ${error.message}`);
      }
    }

    // 🌟 📦 [เพิ่มใหม่] 4. Hook สำหรับการปฏิเสธคำขอคืน/เคลมสินค้า (RETURN_REQUEST)
    if (request.businessType === 'RETURN_REQUEST') {
      try {
        console.log(`[Workflow Hook] Workflow ไม่อนุมัติ/ปฏิเสธ ใบเคลมสินค้า เลขที่ ${request.businessId}`);
        
        // ปรับสถานะของเอกสารคำขอคืนสินค้าตัวนี้เป็น REJECTED เพื่อยกเลิกสิทธิ์ในการเคลมก้อนนี้ และคืนจำนวนสสิทธิ์สต็อกกลับไปให้ลูกค้ากดเคลมใหม่ได้ (ตามด่านตรวจงูกินหาง)
        await this.prisma.comReturnRequest.update({
          where: {
            companyId_docNo: {
              companyId: request.companyId,
              docNo: request.businessId
            }
          },
          data: { status: 'REJECTED' } // หรือใช้ RmaStatus.REJECTED ตาม Prisma Client
        });

      } catch (error: any) {
        console.error(`[Workflow Hook Error] ปรับสถานะปฏิเสธใบเคลมสินค้าไม่สำเร็จ: ${error.message}`);
      }
    }

    // =========================================================
    // 🌟 🎁 [เพิ่มใหม่] Hook สำหรับการปฏิเสธใบแลกของรางวัล (CRM_REDEMPTION) -> คืนแต้ม + คืนสต็อก
    // =========================================================
    if (request.businessType === 'CRM_REDEMPTION') {
      try {
        console.log(`[Workflow Hook] Workflow ปฏิเสธใบแลกของรางวัล รหัส ${request.businessId} กำลังทำการคืนแต้มและคืนสต็อก...`);
        
        // 1. ดึงข้อมูลประวัติการแลกของรางวัลรายการนี้ขึ้นมาตรวจสอบก่อน
        const redemption = await this.prisma.crmRedemption.findFirst({
          where: { redeemCode: request.businessId, companyId: request.companyId },
          include: { reward: true }
        });

        // 🛡️ ป้องกันการคืนแต้มซ้ำซ้อน (ตรวจเช็คว่าต้องเป็นรายการที่ค้าง PENDING อยู่เท่านั้น)
        if (redemption && redemption.status === 'PENDING') {
          await this.prisma.$transaction(async (tx) => {
            
            // 2.1 ปรับสถานะใบแลกเป็น CANCELLED (ยกเลิกรายการ)
            await tx.crmRedemption.update({
              where: { id: redemption.id },
              data: { status: 'CANCELLED' }
            });

            // 2.2 ค้นหาบัญชีสมาชิกร้านค้า (รายสาขา) ของลูกค้าเพื่อบวกแต้มคืน
            if (redemption.shopId) {
              const shopMember = await tx.crmMemberShop.findUnique({
                where: {
                  memberId_shopId: {
                    memberId: redemption.memberId,
                    shopId: redemption.shopId
                  }
                }
              });

              if (shopMember) {
                const newBalance = shopMember.pointBalance + redemption.pointUsed;

                // 2.3 อัปเดตยอดแต้มสะสมเพิ่มกลับเข้าไปในตาราง CrmMemberShop แทน CrmMember
                await tx.crmMemberShop.update({
                  where: { id: shopMember.id },
                  data: { pointBalance: newBalance }
                });

                // 2.4 บันทึก Point Log ขาบวกแต้มคืน (Refund) เพื่อให้ตรวจสอบประวัติย้อนหลังได้ชัดเจน
                await tx.crmPointLog.create({
                  data: {
                    companyId: redemption.companyId,
                    memberId: redemption.memberId,
                    amount: redemption.pointUsed, // ส่งค่าแต้มเป็นบวกเพื่อคืนเข้าบัญชี
                    balanceAfter: newBalance,
                    action: 'ADJUSTMENT', 
                    note: `คืนคะแนนเนื่องจากคำขอแลกรางวัลถูกปฏิเสธ: ${redemption.redeemCode}`,
                    refRedemptionId: redemption.id
                  }
                });
              }
            }

            // 2.5 คืนโควต้าสต็อกของรางวัลชิ้นนั้น (หากของรางวัลมีการจำกัด Stock)
            if (redemption.reward && redemption.reward.stockQty !== null) {
              await tx.crmReward.update({
                where: { id: redemption.rewardId },
                data: { stockQty: { increment: 1 } }
              });
            }
          });
          
          console.log(`[Workflow Hook] ดำเนินการคืนคะแนน ${redemption.pointUsed} แต้ม และสต็อกของรางวัลคืนระบบเรียบร้อยครับ`);
        }
      } catch (error: any) {
        console.error(`[Workflow Hook Error] จัดการคืนแต้มและสต็อกใบแลกของรางวัลไม่สำเร็จ: ${error.message}`);
      }
    }

    // =========================================================
    // 🌟 🛒 [เพิ่มใหม่] Hook สำหรับการปฏิเสธใบสั่งซื้อสินค้า (PURCHASE_ORDER)
    // =========================================================
    if (request.businessType === 'PURCHASE_ORDER') {
      try {
        console.log(`[Workflow Hook] Workflow ปฏิเสธ/ไม่อนุมัติ ใบสั่งซื้อสินค้า เลขที่ ${request.businessId}`);
        
        // ปรับสถานะใบ PO เป็น REJECTED เพื่อล็อกไม่ให้มีการรับสินค้าเข้าคลังเด็ดขาด
        await this.prisma.proPurchaseOrder.update({
          where: {
            companyId_docNo: {
              companyId: request.companyId,
              docNo: request.businessId
            }
          },
          data: { status: 'REJECTED' } 
        });

      } catch (error: any) {
        console.error(`[Workflow Hook Error] ปรับสถานะปฏิเสธใบสั่งซื้อไม่สำเร็จ: ${error.message}`);
      }
    }

    // =========================================================
    // 🌟 🎓 [เพิ่มใหม่] Hook สำหรับปฏิเสธการเปิดคลาสเรียน
    // =========================================================
    if (request.businessType === 'HR_TRAINING_SESSION') {
      try {
        console.log(`[Workflow Hook] ไม่อนุมัติการเปิดคลาสเรียน เปลี่ยนสถานะ Session ID ${request.businessId}...`);
        await this.prisma.hrTrainingSession.update({
          where: { id: Number(request.businessId) },
          data: { status: 'CANCELLED' } // ถ้าผู้บริหารไม่อนุมัติให้จัด ก็ปรับสถานะเป็นยกเลิก 
        });
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ยกเลิกคลาสเรียนไม่สำเร็จ: ${error.message}`);
      }
    }

    // =========================================================
    // 🌟 🎓 [เพิ่มใหม่] Hook สำหรับปฏิเสธการเข้าอบรมของพนักงาน
    // =========================================================
    if (request.businessType === 'HR_TRAINING_ENROLL') {
      try {
        console.log(`[Workflow Hook] ไม่อนุมัติการเข้าอบรม เปลี่ยนสถานะ Enrollment ID ${request.businessId}...`);
        await this.prisma.hrTrainingEnrollment.update({
          where: { id: Number(request.businessId) },
          data: { status: 'REJECTED' } // หัวหน้าตีตกไม่ให้ไปอบรม
        });
      } catch (error: any) {
        console.error(`[Workflow Hook Error] ปฏิเสธสถานะการอบรมไม่สำเร็จ: ${error.message}`);
      }
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
      where: {
        delegateUserId: userId,
        startDate: { lte: now },
        endDate: { gte: now }
      }
    });

    const delegatorIds = activeDelegations.map(d => d.ownerUserId);
    const allTargetUserIds = [userId, ...delegatorIds];

    const pendingActions = await this.prisma.wfAction.findMany({
      where: {
        action: 'PENDING',
        actorId: { in: allTargetUserIds },
        request: { companyId: companyId } 
      },
      include: {
        request: {
          include: {
            requester: { select: { fullName: true, username: true } },
            currentNode: true
          }
        },
        actor: { select: { fullName: true, username: true } } 
      },
      orderBy: { createdAt: 'desc' }
    });

    return pendingActions.map(action => {
      const isDelegated = action.actorId !== userId;
      return {
        ...action.request,
        actionId: action.id, 
        isDelegated: isDelegated,
        delegatorName: isDelegated ? (action.actor.fullName || action.actor.username) : null
      };
    });
  }

  // =========================================================
  // CRUD มาตรฐาน
  // =========================================================
  async findAll(companyId: number, status?: string) {
    return this.prisma.wfRequest.findMany({
      where: { companyId, status: status as WorkflowStatus || undefined },
      include: {
        requester: { select: { fullName: true, username: true } },
        currentNode: true, 
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: number, companyId: number) {
    const request = await this.prisma.wfRequest.findFirst({
      where: { id, companyId },
      include: { workflow: true, currentNode: true }
    });
    if (!request) throw new NotFoundException('ไม่พบรายการคำร้องขอ');
    return request;
  }
}