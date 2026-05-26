import { Injectable, BadRequestException, NotFoundException, Logger, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowStatus, RmaStatus } from '@prisma/client'; 

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(private prisma: PrismaService) {}

 // =================================================================
  // ⚡ 1. Process Action (กดอนุมัติ / ไม่อนุมัติ) - (แก้ไขส่วน nextNode.nodeName)
  // =================================================================
  async processAction(
    companyId: number,
    userId: number,
    requestId: number,
    action: 'APPROVE' | 'REJECT',
    comment?: string
  ) {
    try {
      // 1. ดึงข้อมูลคำขอและ Workflow ที่เกี่ยวข้อง
      const request = await this.prisma.wfRequest.findFirst({
        where: { id: requestId, companyId },
        include: {
          workflow: { include: { nodes: { orderBy: { stepOrder: 'asc' } } } },
          currentNode: true,
        }
      });

      if (!request || request.status !== WorkflowStatus.IN_PROGRESS) {
        throw new BadRequestException('ไม่พบคำร้องขอ หรือคำร้องขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ');
      }

      // 2. เช็คว่า User คนนี้มีงานค้างอยู่ใน Inbox (WfAction)
      const pendingAction = await this.prisma.wfAction.findFirst({
        where: {
          requestId: request.id,
          actorId: userId,
          action: 'PENDING'
        }
      });

      if (!pendingAction) {
        throw new ForbiddenException('คุณไม่มีสิทธิ์อนุมัติรายการนี้ หรือรายการนี้ถูกอนุมัติไปแล้ว');
      }

      // 3. บันทึกการกระทำ (Update Inbox)
      await this.prisma.wfAction.update({
        where: { id: pendingAction.id },
        data: { action: action, comment: comment }
      });

      const nodes = request.workflow.nodes;
      const currentIndex = nodes.findIndex(n => n.id === request.currentNodeId);

      // 🚫 กรณี: กดไม่อนุมัติ (REJECT)
      if (action === 'REJECT') {
        await this.prisma.wfRequest.update({
          where: { id: request.id },
          data: { status: WorkflowStatus.REJECTED }
        });
        await this.updateBusinessDocument(request.businessType, request.businessId, companyId, WorkflowStatus.REJECTED);
        return { message: 'Workflow Rejected' };
      }

      // ✅ กรณี: กดอนุมัติ (APPROVE) -> หาด่านต่อไป
      const nextNode = nodes[currentIndex + 1];

      if (nextNode) {
        // 🔄 มีด่านต่อไป
        await this.prisma.wfRequest.update({
          where: { id: request.id },
          data: { currentNodeId: nextNode.id }
        });

        // 🌟 เรียกฟังก์ชันหาผู้อนุมัติ
        await this.assignApprovers(request.id, nextNode, request.requesterId, companyId);
        // ✅ แก้ไข: เปลี่ยนจาก nextNode.name เป็น nextNode.nodeName
        return { message: 'Workflow moved to next step', nextStep: nextNode.nodeName }; 
      } else {
        // 🎉 ไม่มีด่านต่อไปแล้ว
        await this.prisma.wfRequest.update({
          where: { id: request.id },
          data: { status: WorkflowStatus.APPROVED }
        });
        await this.updateBusinessDocument(request.businessType, request.businessId, companyId, WorkflowStatus.APPROVED);
        return { message: 'Workflow Approved Successfully' };
      }

    } catch (err) {
      if (err instanceof Error) throw new BadRequestException(`เกิดข้อผิดพลาด: ${err.message}`);
      throw new InternalServerErrorException(`เกิดข้อผิดพลาดที่ไม่รู้จัก: ${String(err)}`);
    }
  }

  // =================================================================
  // 🏢 2. ฟังก์ชันอัปเดตเอกสารต้นทาง (Hook to Modules)
  // =================================================================
  private async updateBusinessDocument(
    businessType: string, 
    businessId: string, 
    companyId: number, 
    status: WorkflowStatus
  ) {
    try {
      if (businessType === 'HR_LEAVE') {
        // ตัวอย่าง: ไปอัปเดตใบลา
        // await this.prisma.hrLeaveRequest.update({ ... });
      } 
      else if (businessType === 'PURCHASE_ORDER') {
        // ตัวอย่าง: ไปอัปเดตใบสั่งซื้อ
        // await this.prisma.proPurchaseOrder.update({ ... });
      }
      else if (businessType === 'RETURN_REQUEST') {
        await this.prisma.comReturnRequest.update({
          where: { companyId_docNo: { companyId, docNo: businessId } },
          data: { status: status === WorkflowStatus.APPROVED ? RmaStatus.APPROVED : RmaStatus.REJECTED }
        });
      }
    } catch (error) {
      this.logger.error(`Failed to update business document ${businessType} ID ${businessId}`, error);
    }
  }

  // =================================================================
  // 🔍 3. ฟังก์ชันคำนวณหาผู้อนุมัติและส่งเข้า Inbox (แก้ไขชื่อฟิลด์ให้ตรง Schema)
  // =================================================================
  async assignApprovers(requestId: number, node: any, requesterUserId: number, companyId: number) {
    const employee = await this.prisma.hrEmployee.findFirst({
      where: { userId: requesterUserId, companyId },
      include: { department: true }
    });

    if (!employee) return; 

    let targetUserIds: number[] = [];

    // ✅ แก้ไข: เปลี่ยนจาก approverType เป็น dynamicApprover
    if (node.dynamicApprover === 'DIRECT_MANAGER' && employee.managerId) {
      const mgr = await this.prisma.hrEmployee.findUnique({ where: { id: employee.managerId } });
      if (mgr?.userId) targetUserIds.push(mgr.userId);
    } 
    else if (node.dynamicApprover === 'DEPARTMENT_HEAD' && employee.department?.managerId) {
      const deptMgr = await this.prisma.hrEmployee.findUnique({ where: { id: employee.department.managerId } });
      if (deptMgr?.userId) targetUserIds.push(deptMgr.userId);
    }
    // ✅ แก้ไข: เช็คจาก approverPositionId โดยตรง
    else if (node.approverPositionId) {
      const peers = await this.prisma.hrEmployee.findMany({
        where: { positionId: node.approverPositionId, companyId, isActive: true }
      });
      targetUserIds = peers.map(p => p.userId).filter((id): id is number => id !== null);
    }

    // สร้าง WfAction (Inbox) ให้ผู้มีสิทธิ์อนุมัติ
    if (targetUserIds.length > 0) {
      await this.prisma.wfAction.createMany({
        data: targetUserIds.map(uid => ({
          requestId,
          actorId: uid,
          // ✅ แก้ไข: เปลี่ยนจาก node.name เป็น node.nodeName
          stepName: node.nodeName || `ขั้นตอนที่ ${node.stepOrder}`,
          action: 'PENDING',
        }))
      });
    }
  }

  // =================================================================
  // 📋 4. Get Options
  // =================================================================
  async getAvailableWorkflows(companyId: number, docType: string) {
    return this.prisma.wfDefinition.findMany({
      where: { companyId, isActive: true, code: { startsWith: docType } },
      select: { id: true, code: true, name: true, description: true }
    });
  }
}