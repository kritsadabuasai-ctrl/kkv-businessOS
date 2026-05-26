import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface PotentialApprover {
  userId: number | null;
  displayName: string; 
}

// 🌟 อัปเดต Interface ให้ครบตามที่หน้าบ้านต้องการ
export interface SimulationStep {
  stepOrder: number;
  nodeName: string;
  nodeType: string;      // 🌟 [เพิ่มใหม่] ส่ง APPROVAL หรือ FYI
  approverType: string;  // STATIC หรือ DIRECT_MANAGER
  potentialApprovers: PotentialApprover[];
  note?: string; 
  requireSignature?: boolean;
  voteRule?: string | null;      
  voteThreshold?: number | null; 
}

@Injectable()
export class WorkflowSimulationService {
  constructor(private prisma: PrismaService) {}

  async simulatePath(companyId: number, requesterUserId: number, workflowId: number, mockPayload: any = {}) {
    const workflow = await this.prisma.wfDefinition.findUnique({
      where: { id: workflowId, companyId },
      include: { nodes: { orderBy: { stepOrder: 'asc' } } }
    });

    if (!workflow) throw new NotFoundException('ไม่พบโครงสร้าง Workflow');

    const fullPath: SimulationStep[] = [];
    let currentNode = workflow.nodes[0];
    let stepCount = 0; // ป้องกัน Infinite Loop

    while (currentNode && stepCount < 50) {
      stepCount++;
      
      const stepInfo: SimulationStep = {
        stepOrder: currentNode.stepOrder,
        nodeName: currentNode.nodeName,
        nodeType: currentNode.nodeType, // 🌟 บอกว่าเป็น APPROVAL, FYI, หรือ CONDITION
        approverType: currentNode.dynamicApprover || 'STATIC', // 🌟 STATIC, DIRECT_MANAGER ฯลฯ
        potentialApprovers: [],
        requireSignature: currentNode.requireSignature,
        voteRule: currentNode.voteRule,      
        voteThreshold: currentNode.voteThreshold, 
      };

      // 🚦 ตรวจสอบว่าโหนดนี้เป็น "ทางแยก (CONDITION)" หรือไม่
      if (currentNode.nodeType === 'CONDITION') {
        const isPassed = this.evaluateCondition(currentNode.conditionLogic, mockPayload);
        stepInfo.note = `เงื่อนไขทางแยก: ${isPassed ? 'ผ่าน (วิ่งไปเส้นทางอนุมัติ)' : 'ไม่ผ่าน (วิ่งไปเส้นทางปฏิเสธ/ทางเลือก)'}`;
        
        // เลือกทางแยกตามผลประเมิน
        const nextNodeId = isPassed ? currentNode.nextApproveId : currentNode.nextRejectId;
        currentNode = workflow.nodes.find(n => n.id === nextNodeId) || null as any;
      } 
      // 👤 ถ้าเป็นโหนดอนุมัติหรือแจ้งทราบ (APPROVAL / FYI)
      else {
        stepInfo.potentialApprovers = await this.resolvePotentialApprovers(companyId, requesterUserId, currentNode);
        
        if (stepInfo.potentialApprovers.length === 0) {
           stepInfo.note = '⚠️ ไม่พบผู้มีสิทธิ์อนุมัติในขั้นตอนนี้';
        }

        // เดินหน้าต่อไปในกรณีที่อนุมัติ (Happy Path)
        currentNode = workflow.nodes.find(n => n.id === currentNode.nextApproveId) || null as any;
      }

      fullPath.push(stepInfo);
    }

    if (stepCount >= 50) {
      // 🌟 [แก้ไข Bug] เพิ่ม nodeType เข้าไปใน Object สุดท้ายด้วย
      fullPath.push({ 
        stepOrder: 99, 
        nodeName: '⚠️ เกิดการวนลูปซ้ำซ้อนเกินกำหนด', 
        nodeType: 'ERROR', 
        approverType: 'ERROR', 
        potentialApprovers: [] 
      });
    }

    return {
      workflowName: workflow.name,
      requesterId: requesterUserId,
      path: fullPath
    };
  }

  // Logic การหาตัวผู้อนุมัติ (คงเดิม)
  private async resolvePotentialApprovers(companyId: any, requesterUserId: any, node: any): Promise<PotentialApprover[]> {
    // 🛡️ บังคับแปลงค่าให้เป็นตัวเลข (Integer) เสมอ ป้องกันปัญหา String Type Mismatch
    const cId = Number(companyId); 
    const reqId = Number(requesterUserId);

    const employee = await this.prisma.hrEmployee.findFirst({
      where: { userId: reqId, companyId: cId },
      include: { department: true }
    });

    let targetUsers: PotentialApprover[] = [];

    if (node.dynamicApprover === 'DIRECT_MANAGER' && employee?.managerId) {
      const mgr = await this.prisma.hrEmployee.findUnique({ where: { id: employee.managerId } });
      if (mgr && mgr.userId) targetUsers.push({ userId: mgr.userId, displayName: `${mgr.firstName} ${mgr.lastName}` });
    } 
    else if (node.dynamicApprover === 'DEPARTMENT_HEAD' && employee?.department?.managerId) {
      const deptMgr = await this.prisma.hrEmployee.findUnique({ where: { id: employee.department.managerId } });
      if (deptMgr && deptMgr.userId) targetUsers.push({ userId: deptMgr.userId, displayName: `${deptMgr.firstName} ${deptMgr.lastName}` });
    }
    else if (node.approverPositionId) {
      const peers = await this.prisma.hrEmployee.findMany({
        where: { positionId: Number(node.approverPositionId), companyId: cId, isActive: true }
      });
      targetUsers = peers.filter(p => p.userId !== null).map(p => ({ userId: p.userId, displayName: `${p.firstName} ${p.lastName}` }));
    }
    // 🌟 ส่วนสำคัญ: ค้นหาตามบทบาท (Role)
    else if (node.approverRoleId) {
      const roleIdNum = Number(node.approverRoleId);
      
      const usersInRole = await this.prisma.secUserRole.findMany({
        where: { roleId: roleIdNum, companyId: cId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              employee: { select: { firstName: true, lastName: true } }
            }
          }
        }
      });
      
      targetUsers = usersInRole.map(roleData => {
        const user = roleData.user;
        let finalName = user.username;
        if (user.employee) finalName = `${user.employee.firstName} ${user.employee.lastName}`;
        else if (user.fullName) finalName = user.fullName;

        return { userId: user.id, displayName: finalName };
      });
    }

    return targetUsers;
  }

  // 🌟 ฟังก์ชันช่วยคำนวณเงื่อนไข (คงเดิม)
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
}