import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWfActionDto, ActionType } from './wf-action.dto';
import { WorkflowStatus } from '@prisma/client';
import { WfRequestService } from '../requests/wf-request.service';

@Injectable()
export class WfActionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WfRequestService))
    private readonly wfRequestService: WfRequestService
  ) {}

  // =========================================================
  // 🌟 ฟังก์ชันหลัก: ประมวลผลการกระทำ (รองรับทุก Rule)
  // =========================================================
  async create(companyId: number, userId: number, dto: CreateWfActionDto) {
    const requestId = dto.requestId;
    if (!requestId) {
      throw new BadRequestException('ไม่พบรหัสคำร้องขอ (requestId)');
    }

    console.log(`\n=============================================`);
    console.log(`🚨 [DEBUG WORKFLOW] มีคนกดปุ่ม!`);
    console.log(`🚨 คำร้อง ID: ${requestId} | Action: ${dto.action}`);
    console.log(`=============================================\n`);

    const request = await this.prisma.wfRequest.findFirst({
      where: { id: requestId, companyId },
      include: { currentNode: true, requester: true }
    });

    if (!request) throw new NotFoundException('ไม่พบคำร้อง หรือคุณไม่มีสิทธิ์เข้าถึง');
    if (request.status !== WorkflowStatus.IN_PROGRESS && dto.action !== ActionType.RECALL) {
      throw new BadRequestException('คำร้องนี้ดำเนินการไปแล้ว ไม่สามารถทำรายการซ้ำได้');
    }

    const isSystemBot = dto.comment?.includes('System Auto-Action') || false;

    // ==================================================================
    // 🔙 LOGIC 1: ฟีเจอร์ "ดึงเรื่องกลับ" (RECALL)
    // ==================================================================
    if (dto.action === ActionType.RECALL) {
      const lastApproveAction = await this.prisma.wfAction.findFirst({
        where: { requestId: request.id, action: 'APPROVE', comment: { not: { contains: 'System Auto' } } },
        orderBy: { id: 'desc' }
      });

      if (!lastApproveAction) throw new BadRequestException('ไม่สามารถดึงเรื่องกลับได้ เนื่องจากยังไม่มีการอนุมัติโดยบุคคล');
      if (lastApproveAction.actorId !== userId && userId !== 1) {
         throw new ForbiddenException('คุณไม่มีสิทธิ์ดึงเรื่องกลับ (สงวนสิทธิ์เฉพาะผู้อนุมัติคนล่าสุดที่ทำให้เปลี่ยนขั้นตอนเท่านั้น)');
      }

      const workflow = await this.prisma.wfDefinition.findFirst({ where: { id: request.workflowId }, include: { nodes: true } });
      let targetNodeId = request.currentNodeId; 
      const lastNodeMatched = workflow?.nodes.find((n: any) => lastApproveAction.stepName.includes(n.nodeName) || lastApproveAction.stepName.includes(`ขั้นตอนที่ ${n.stepOrder}`));
      
      if (lastNodeMatched) targetNodeId = lastNodeMatched.id;
      else {
        const prevByLink = workflow?.nodes.find((n: any) => n.nextApproveId === request.currentNodeId);
        if (prevByLink) targetNodeId = prevByLink.id;
      }

      const targetNode = workflow?.nodes.find((n: any) => n.id === targetNodeId);
      if (!targetNode) throw new BadRequestException('เกิดข้อผิดพลาด ไม่พบข้อมูลขั้นตอนก่อนหน้าในระบบ');

      await this.prisma.wfAction.deleteMany({
        where: { requestId: request.id, OR: [{ action: 'PENDING' }, { stepName: lastApproveAction.stepName, action: 'APPROVE' }] }
      });

      await this.saveActionHistory({ ...dto, comment: 'ดึงเรื่องกลับ: ผู้ใช้อนุมัติดึงเรื่องกลับมาพิจารณาใหม่' }, userId, targetNode.nodeName || `ขั้นตอนที่ ${targetNode.stepOrder}`);
      await this.prisma.wfRequest.update({ where: { id: request.id }, data: { currentNodeId: targetNode.id, status: WorkflowStatus.IN_PROGRESS } });

      const allNodes = workflow?.nodes || [];
      const requestData = typeof request.data === 'string' ? JSON.parse(request.data || '{}') : (request.data || {});
      await this.wfRequestService.assignApprovers(request.id, targetNode, request.requesterId, companyId, requestData, allNodes);

      return { message: 'ดึงเรื่องกลับสำเร็จ ขั้นตอนถูกรีเซ็ตและส่งให้ทุกคนพิจารณาใหม่อีกครั้ง' };
    }

    // 🛡️ 2. ตรวจสอบสิทธิ์ (รองรับ Delegation - ทำแทน)
    const validationResult = await this.validateApprover(userId, requestId, isSystemBot);
    let delegateComment = '';
    let targetActorIdToClear = userId; 

    if (validationResult?.actingOnBehalfOf) {
      targetActorIdToClear = validationResult.actingOnBehalfOf; 
      delegateComment = `\n(ดำเนินการแทน: ${validationResult.delegatorName})`;
    }

    const isAdhocTask = (validationResult?.pendingTask as any)?.isAdhoc || false;
    if (isAdhocTask && dto.action !== ActionType.COMMENT) {
       throw new ForbiddenException('คุณถูกเชิญมาเพื่อให้คำปรึกษาเท่านั้น (กรุณาใช้งานปุ่ม "ส่งความเห็น")');
    }

    // ==================================================================
    // 🧑‍🤝‍🧑 LOGIC: การส่งคำเชิญคนนอก (Ad-hoc Invite)
    // ==================================================================
    if (dto.action === ActionType.AD_HOC_INVITE) {
      if (!dto.invitedUserId) throw new BadRequestException('กรุณาระบุผู้ใช้งานที่ต้องการขอคำปรึกษา');
      if (dto.invitedUserId === userId) throw new BadRequestException('ไม่สามารถขอคำปรึกษาจากตัวเองได้');

      const existingPending = await this.prisma.wfAction.findFirst({ where: { requestId: request.id, actorId: dto.invitedUserId, action: 'PENDING' } });
      if (existingPending) throw new BadRequestException('ผู้ใช้งานท่านนี้มีสิทธิ์หรือถูกเชิญเข้ามาในขั้นตอนนี้อยู่แล้ว');

      const isBlockingRequest = dto.isBlocking !== undefined ? dto.isBlocking : true;

      await this.prisma.wfAction.create({
        data: {
          requestId: request.id, actorId: dto.invitedUserId, stepName: request.currentNode?.nodeName || 'ปรึกษาพิเศษ',
          action: 'PENDING', comment: isBlockingRequest ? 'ให้ความเห็นเพิ่มเติม (จำเป็น)' : 'ดูเอกสาร (แค่แจ้งให้ทราบ)',
          isAdhoc: true, invitedById: userId,
        } as any 
      });

      const inviteNote = isBlockingRequest ? '[ส่งคำเชิญปรึกษา (รอคำตอบ)]' : '[ส่งคำเชิญให้พิจารณา (ไม่บังคับรอ)]';
      await this.saveActionHistory({ ...dto, comment: dto.comment ? `${inviteNote}: ${dto.comment}` : inviteNote }, userId, request.currentNode?.nodeName);
      return { message: 'ส่งคำเชิญสำเร็จ' };
    }

    // ==================================================================
    // 💬 LOGIC: การคอมเมนต์
    // ==================================================================
    if (dto.action === ActionType.COMMENT) {
      if (!dto.comment) throw new BadRequestException('Comment is required');
      await this.saveActionHistory({ ...dto, comment: dto.comment + delegateComment }, userId, request.currentNode?.nodeName);

      if (isAdhocTask && validationResult?.pendingTask) {
         await this.prisma.wfAction.update({ where: { id: validationResult.pendingTask.id }, data: { action: 'CANCELLED', comment: 'ให้คำปรึกษาเรียบร้อยแล้ว' } });
         return { message: 'บันทึกความเห็นและปิดงานที่ปรึกษาสำเร็จ' };
      }
      return { message: 'บันทึกคอมเมนต์สำเร็จ' };
    }

   // 🛑 BLOCKER: ตรวจสอบสถานะ Ad-hoc (เฉพาะที่ปรึกษาที่เจ้าตัวเชิญ และบังคับรอ)
if ([ActionType.APPROVE, ActionType.REJECT, ActionType.SEND_BACK].includes(dto.action)) {
  
  // เช็คแค่ Action ที่เป็น AD_HOC_INVITE + PENDING + มีข้อความ Blocking
  const blockingAdhocConsultants = await this.prisma.wfAction.findMany({
    where: { 
      requestId: request.id, 
      stepName: request.currentNode?.nodeName, 
      isAdhoc: true, 
      action: 'PENDING', 
      invitedById: userId, // ✅ ดักแค่ที่ User คนนี้เป็นคนเชิญ
      comment: { contains: '[ส่งคำเชิญปรึกษา (รอคำตอบ)]' } // ✅ ดักแค่รายการที่ตั้งค่าเป็น Blocking เท่านั้น
    },
    include: { actor: { select: { fullName: true, username: true } } }
  });

  if (blockingAdhocConsultants.length > 0) {
    const pendingNames = blockingAdhocConsultants
      .map(u => u.actor.fullName || u.actor.username)
      .join(', ');
      
    throw new BadRequestException(
      `คุณได้ส่งคำเชิญให้ที่ปรึกษา (${pendingNames}) พิจารณาแบบบังคับรอ (Blocking) อยู่ กรุณารอความเห็นจากที่ปรึกษาของท่านก่อนดำเนินการต่อครับ`
    );
  }
}

    // 🖋️ 3. ตรวจสอบ Digital Signature
    if (request.currentNode?.requireSignature && dto.action === ActionType.APPROVE) {
      const signatureDto = dto as CreateWfActionDto & { signatureData?: string; ipAddress?: string };
      if (!signatureDto.signatureData) throw new BadRequestException('บังคับให้ต้องแนบลายเซ็นดิจิทัลก่อนอนุมัติ');

      const sigRequest = await this.prisma.docSignatureRequest.findFirst({ where: { wfRequestId: request.id, signerId: userId, status: 'PENDING' } });
      if (sigRequest) {
        await this.prisma.docSignature.create({ data: { companyId, requestId: sigRequest.id, signatureImage: signatureDto.signatureData, signedAt: new Date(), ipAddress: signatureDto.ipAddress || null } });
        await this.prisma.docSignatureRequest.update({ where: { id: sigRequest.id }, data: { status: 'SIGNED' } });
      } else {
        throw new BadRequestException('ไม่พบเอกสารหรือคำขอเซ็นที่รอคุณดำเนินการ');
      }
    }

    // 4. บันทึกประวัติการตัดสินใจ
    const stepNameForHistory = request.currentNode?.nodeName || `ขั้นตอนที่ ${request.currentNode?.stepOrder || 'ไม่ระบุ'}`;
    await this.saveActionHistory({ ...dto, comment: dto.comment ? dto.comment + delegateComment : delegateComment.trim() }, userId, stepNameForHistory);

    // 5. ลบสถานะ PENDING ของเจ้าของงาน และ เคลียร์ AD_HOC_INVITE ที่คนนี้ส่งเชิญไปแต่เขาไม่ตอบให้ทิ้งไปเลย (ไม่ต้องรอแล้ว)
    await this.prisma.wfAction.deleteMany({
      where: { 
        requestId: request.id, 
        action: 'PENDING', 
        OR: [{ actorId: targetActorIdToClear }, { isAdhoc: true, invitedById: userId }] 
      } as any
    });

    const voteRule = request.currentNode?.voteRule || 'ANY_APPROVE';

    // ==================================================================
    // 🚦 6. การหาทิศทางถัดไป (Routing Based on Voting Rules)
    // ==================================================================

    // 📊 นับคะแนนเสียงสำหรับคำนวณ (ใช้สำหรับ CUSTOM_PERCENTAGE และ ALL_MUST_APPROVE)
    const approvedCount = await this.prisma.wfAction.count({ where: { requestId, stepName: stepNameForHistory, action: 'APPROVE', isAdhoc: false } as any });
    const rejectedCount = await this.prisma.wfAction.count({ where: { requestId, stepName: stepNameForHistory, action: 'REJECT', isAdhoc: false } as any });
    const pendingCount = await this.prisma.wfAction.count({ where: { requestId, stepName: stepNameForHistory, action: 'PENDING', isAdhoc: false } as any });
    const totalVoters = approvedCount + rejectedCount + pendingCount;
    const threshold = request.currentNode?.voteThreshold || 50; 

    // ---------------------- 🟢 กรณี APPROVE ----------------------
    if (dto.action === ActionType.APPROVE) {
      if (voteRule === 'ANY_APPROVE') {
        // ใครคนใดคนหนึ่ง Approved ก็ถือว่าผ่าน
        await this.cancelOtherPendingActions(requestId, stepNameForHistory);
        await this.processAdvanceNode(request, companyId);
      }
      else if (voteRule === 'ALL_MUST_APPROVE') {
        // ทุกคนต้อง Approved
        if (pendingCount > 0) {
          return { message: 'บันทึกการอนุมัติแล้ว ระบบกำลังรอผู้อนุมัติท่านอื่น' };
        } else {
          await this.processAdvanceNode(request, companyId);
        }
      } 
      else if (voteRule === 'CUSTOM_PERCENTAGE') {
        // ต้องได้เปอร์เซ็นต์ตามที่กำหนด
        const currentPercent = totalVoters > 0 ? (approvedCount / totalVoters) * 100 : 0;
        if (currentPercent >= threshold) {
          await this.cancelOtherPendingActions(requestId, stepNameForHistory);
          await this.processAdvanceNode(request, companyId);
        } else {
          return { message: `บันทึกเสียงโหวตแล้ว (ปัจจุบัน ${currentPercent.toFixed(2)}% ต้องการ ${threshold}%)` };
        }
      }
    } 
    // ---------------------- 🔴 กรณี REJECT ----------------------
    else if (dto.action === ActionType.REJECT) {
      if (voteRule === 'ANY_APPROVE' || voteRule === 'ALL_MUST_APPROVE') {
        // คนใดคนหนึ่ง Reject ก็ถือว่า Reject เลย
        await this.cancelOtherPendingActions(requestId, stepNameForHistory);
        await this.wfRequestService.markAsRejected(request.id);
      }
      else if (voteRule === 'CUSTOM_PERCENTAGE') {
        // คำนวณความน่าจะเป็น: ถ้าคนที่เหลือ (Pending) อนุมัติทั้งหมด เปอร์เซ็นต์จะถึงเกณฑ์หรือไม่?
        const maxPossibleApproved = approvedCount + pendingCount;
        const maxPossiblePercent = totalVoters > 0 ? (maxPossibleApproved / totalVoters) * 100 : 0;

        if (maxPossiblePercent < threshold) {
          // เป็นไปไม่ได้แล้วที่จะถึงเกณฑ์ (Reject เลย)
          await this.cancelOtherPendingActions(requestId, stepNameForHistory);
          await this.wfRequestService.markAsRejected(request.id);
        } else {
          // ยังมีโอกาสถ้าคนที่เหลือ Approved (รอต่อไป)
          return { message: `บันทึกการไม่อนุมัติแล้ว ระบบยังคงรอการตัดสินใจจากผู้อนุมัติท่านอื่น` };
        }
      }
    }
    // ---------------------- 🔙 กรณี SEND_BACK ----------------------
    else if (dto.action === ActionType.SEND_BACK) {
      await this.cancelOtherPendingActions(requestId, stepNameForHistory, 'ถูกยกเลิกเนื่องจากคำร้องถูกตีกลับให้แก้ไข');

      const allNodes = await this.prisma.wfNode.findMany({ where: { workflowId: request.workflowId } });
      let previousNodeId = request.currentNode?.nextRejectId;
      
      if (!previousNodeId) {
         const fallbackNode = allNodes.find(n => n.nextApproveId === request.currentNodeId);
         if (fallbackNode) {
             previousNodeId = fallbackNode.id;
         } else if (request.currentNode?.stepOrder && request.currentNode.stepOrder > 1) {
             const fallbackByOrder = allNodes.find(n => n.stepOrder === (request.currentNode?.stepOrder || 0) - 1);
             if (fallbackByOrder) previousNodeId = fallbackByOrder.id;
         }
      }

      if (!previousNodeId) {
         await this.prisma.wfRequest.update({
           where: { id: request.id },
           data: { currentNodeId: null, status: WorkflowStatus.REJECTED } 
         });

         await this.prisma.wfAction.create({
            data: {
               requestId: request.id, actorId: request.requesterId, 
               stepName: 'ตีกลับให้ผู้ขอแก้ไขข้อมูล', action: 'PENDING',
               comment: dto.comment || 'กรุณาตรวจสอบและแก้ไขข้อมูล'
            }
         });
      } else {
         const targetNode = allNodes.find(n => n.id === previousNodeId);
         if (!targetNode) throw new NotFoundException('ไม่พบขั้นตอนก่อนหน้าในระบบ');

         await this.prisma.wfRequest.update({
           where: { id: request.id },
           data: { currentNodeId: previousNodeId, status: WorkflowStatus.IN_PROGRESS } 
         });

         const requestData = typeof request.data === 'string' ? JSON.parse(request.data || '{}') : (request.data || {});

         await this.wfRequestService.assignApprovers(
            request.id, targetNode, request.requesterId, companyId, requestData, allNodes, true
         );
      }
    }

    return { message: 'ประมวลผลการกระทำสำเร็จ' };
  }

  // =========================================================
  // 🛡️ Helper Methods
  // =========================================================
  
  // 🌟 ฟังก์ชันยกเลิกรายการ Pending ของคนอื่นในโหนดเดียวกัน
  private async cancelOtherPendingActions(requestId: number, stepName: string, customComment?: string) {
    await this.prisma.wfAction.updateMany({
      where: { requestId: requestId, stepName: stepName, action: 'PENDING' },
      data: { action: 'CANCELLED', comment: customComment || 'ถูกยกเลิกเนื่องจากผลการตัดสินใจในขั้นตอนนี้สิ้นสุดแล้ว' }
    });
  }

  // 🌟 ฟังก์ชันขับเคลื่อน Workflow ไปยังโหนดถัดไป
  private async processAdvanceNode(request: any, companyId: number) {
    const nextNodeId = request.currentNode?.nextApproveId;
    
    if (!nextNodeId) {
      await this.wfRequestService.markAsApproved(request.id);
    } else {
      await this.prisma.wfRequest.update({ where: { id: request.id }, data: { currentNodeId: nextNodeId } });
      const targetNode = await this.prisma.wfNode.findUnique({ where: { id: nextNodeId } });
      const workflowData = await this.prisma.wfDefinition.findUnique({ where: { id: request.workflowId }, include: { nodes: true } });
      const requestData = typeof request.data === 'string' ? JSON.parse(request.data || '{}') : (request.data || {});
      
      await this.wfRequestService.processNextNodeRouting(request.id, targetNode, request.requesterId, companyId, requestData, workflowData?.nodes || []);
    }
  }

  private async validateApprover(userId: number, requestId: number, isSystemBot: boolean = false) {
    if (isSystemBot) return { pendingTask: null, actingOnBehalfOf: null };

    let pendingTask = await this.prisma.wfAction.findFirst({
      where: { requestId: requestId, actorId: userId, action: 'PENDING' }
    });

    let actingOnBehalfOf: number | null = null;
    let delegatorName: string | null = null;

    if (!pendingTask) {
      const now = new Date();
      const activeDelegations = await this.prisma.secUserDelegation.findMany({
        where: { delegateUserId: userId, startDate: { lte: now }, endDate: { gte: now } },
        include: { owner: { select: { fullName: true, username: true } } }
      });

      if (activeDelegations.length > 0) {
        const delegatorIds = activeDelegations.map(d => d.ownerUserId);
        pendingTask = await this.prisma.wfAction.findFirst({
          where: { requestId: requestId, actorId: { in: delegatorIds }, action: 'PENDING' }
        });

        if (pendingTask) {
          actingOnBehalfOf = pendingTask.actorId;
          const matchedDelegation = activeDelegations.find(d => d.ownerUserId === pendingTask?.actorId);
          delegatorName = matchedDelegation?.owner.fullName || matchedDelegation?.owner.username || 'ผู้มอบหมาย';
        }
      }
    }

    const userRoles = await this.prisma.secUserRole.findMany({
      where: { userId: userId }, select: { roleId: true }
    });
    const isSuperAdmin = userRoles.some(r => r.roleId === 1);

    if (!pendingTask && !isSuperAdmin) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์อนุมัติในขั้นตอนนี้ หรือคุณได้ทำการอนุมัติไปแล้ว');
    }

    return { pendingTask, actingOnBehalfOf, delegatorName };
  }

  private async saveActionHistory(dto: CreateWfActionDto, userId: number, stepName?: string) {
    return this.prisma.wfAction.create({
      data: {
        requestId: dto.requestId as number,
        actorId: userId,
        action: dto.action,
        comment: dto.comment,
        stepName: stepName || 'Unknown Step'
      }
    });
  }

  async getHistory(companyId: number, requestId: number) {
    const request = await this.prisma.wfRequest.findFirst({
       where: { id: requestId, companyId }
    });
    if (!request) throw new NotFoundException('Request not found');

    return this.prisma.wfAction.findMany({
      where: { requestId },
      include: { actor: { select: { username: true, fullName: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }
}