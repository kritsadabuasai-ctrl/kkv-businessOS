import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWfActionDto, ActionType } from './wf-action.dto';
import { WorkflowStatus } from '@prisma/client';
import { WfRequestService } from '../requests/wf-request.service';

@Injectable()
export class WfActionService {
  constructor(
    private readonly prisma: PrismaService,
    
    // 🌟 เติม Inject forwardRef ตรงนี้!
    @Inject(forwardRef(() => WfRequestService))
    private readonly wfRequestService: WfRequestService
  ) {}

// =========================================================
  // 🌟 ฟังก์ชันหลัก: ประมวลผลการกระทำ (ตัวเต็ม + แก้บั๊ก SEND_BACK ทะลุ)
  // =========================================================
  async create(companyId: number, userId: number, dto: CreateWfActionDto) {

   // 🚨 1. เพิ่มโค้ดเรดาร์จับผิดตรงนี้เลยครับ! 🚨
    console.log(`\n=============================================`);
    console.log(`🚨 [DEBUG WORKFLOW] มีคนกดปุ่ม!`);
    console.log(`🚨 คำร้อง ID: ${dto.requestId} | Action ที่ส่งมาคือ: ${dto.action}`);
    console.log(`=============================================\n`);

    const request = await this.prisma.wfRequest.findFirst({
      where: { id: dto.requestId, companyId },
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
      const requestData = request.data ? (typeof request.data === 'string' ? JSON.parse(request.data) : request.data) : {};
      await this.wfRequestService.assignApprovers(request.id, targetNode, request.requesterId, companyId, requestData, allNodes);

      return { message: 'ดึงเรื่องกลับสำเร็จ ขั้นตอนถูกรีเซ็ตและส่งให้ทุกคนพิจารณาใหม่อีกครั้ง' };
    }

    // 🛡️ 2. ตรวจสอบสิทธิ์ (รองรับ Delegation - ทำแทน)
    const validationResult = await this.validateApprover(userId, dto.requestId, isSystemBot);
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

    // 🛑 BLOCKER: ตรวจสอบสถานะ Ad-hoc
    if ([ActionType.APPROVE, ActionType.REJECT, ActionType.SEND_BACK].includes(dto.action)) {
      const pendingAdhocUsers = await this.prisma.wfAction.findMany({
        where: { requestId: request.id, stepName: request.currentNode?.nodeName, isAdhoc: true, action: 'PENDING', invitedById: userId },
        include: { actor: { select: { fullName: true, username: true } } }
      });

      if (pendingAdhocUsers.length > 0) {
        const myInviteHistory = await this.prisma.wfAction.findMany({ where: { requestId: request.id, actorId: userId, action: 'AD_HOC_INVITE' }, orderBy: { createdAt: 'desc' } });
        const blockingUsers = pendingAdhocUsers.filter(pendingUser => myInviteHistory.some(history => history.comment?.includes('[ส่งคำเชิญปรึกษา (รอคำตอบ)]')));

        if (blockingUsers.length > 0) {
           const pendingNames = blockingUsers.map(u => u.actor.fullName || u.actor.username).join(', ');
           throw new BadRequestException(`ต้องรอให้ที่ปรึกษา (${pendingNames}) ส่งความเห็นให้ครบก่อน`);
        }
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

    // 5. ลบสถานะ PENDING ของเจ้าของงาน
    await this.prisma.wfAction.deleteMany({
      where: { requestId: request.id, action: 'PENDING', OR: [{ actorId: targetActorIdToClear }, { isAdhoc: true, invitedById: userId }] } as any
    });

    const voteRule = request.currentNode?.voteRule || 'ANY_APPROVE';

    // ==================================================================
    // 🚦 6. การหาทิศทางถัดไป (Routing)
    // ==================================================================
    if (dto.action === ActionType.APPROVE) {
      if (voteRule === 'CUSTOM_PERCENTAGE') {
        const totalVoters = await this.prisma.wfAction.count({ where: { requestId: request.id, stepName: stepNameForHistory, isAdhoc: false } as any });
        const approvedVoters = await this.prisma.wfAction.count({ where: { requestId: request.id, stepName: stepNameForHistory, action: 'APPROVE', isAdhoc: false } as any });
        const threshold = request.currentNode?.voteThreshold || 50; 
        const currentPercent = totalVoters > 0 ? (approvedVoters / totalVoters) * 100 : 100;

        if (currentPercent >= threshold) await this.prisma.wfAction.updateMany({ where: { requestId: request.id, action: 'PENDING' }, data: { action: 'CANCELLED', comment: `ถูกยกเลิกเนื่องจากมติโหวตผ่านเกณฑ์แล้ว` } });
        else return { message: `บันทึกเสียงโหวตแล้ว (ปัจจุบัน ${currentPercent.toFixed(2)}% ต้องการ ${threshold}%)` };
      }
      else if (voteRule === 'ALL_MUST_APPROVE') {
        const remainingPending = await this.prisma.wfAction.count({ where: { requestId: request.id, action: 'PENDING', isAdhoc: false } as any });
        if (remainingPending > 0) return { message: 'บันทึกการอนุมัติแล้ว ระบบกำลังรอผู้อนุมัติท่านอื่น' };
      } 
      else {
        await this.prisma.wfAction.updateMany({ where: { requestId: request.id, action: 'PENDING' }, data: { action: 'CANCELLED', comment: 'ถูกยกเลิกเนื่องจากมีผู้อนุมัติท่านอื่นอนุมัติแล้ว' } });
      }

      const nextNodeId = request.currentNode?.nextApproveId;
      if (!nextNodeId) {
        await this.wfRequestService.markAsApproved(request.id);
      } else {
        await this.prisma.wfRequest.update({ where: { id: request.id }, data: { currentNodeId: nextNodeId } });
        const targetNode = await this.prisma.wfNode.findUnique({ where: { id: nextNodeId } });
        const requestData = request.data ? (typeof request.data === 'string' ? JSON.parse(request.data) : request.data) : {};
        const workflowData = await this.prisma.wfDefinition.findUnique({ where: { id: request.workflowId }, include: { nodes: true } });
        await this.wfRequestService.processNextNodeRouting(request.id, targetNode, request.requesterId, companyId, requestData, workflowData?.nodes || []);
      }
    } 
    else if (dto.action === ActionType.REJECT) {
      await this.prisma.wfAction.updateMany({ where: { requestId: request.id, action: 'PENDING' }, data: { action: 'CANCELLED', comment: 'ถูกยกเลิกเนื่องจากคำร้องถูกปฏิเสธแล้ว' } });
      await this.wfRequestService.markAsRejected(request.id);
    }
    // ==================================================================
    // 🔙 7. ระบบตีกลับให้แก้ไข (SEND_BACK) ** [อัปเดตใหม่ ป้องกัน Auto-Approve] **
    // ==================================================================
    else if (dto.action === ActionType.SEND_BACK) {
      // ยกเลิก PENDING ทั้งหมดที่ค้างอยู่ในโหนดปัจจุบัน
      await this.prisma.wfAction.updateMany({
        where: { requestId: request.id, action: 'PENDING' },
        data: { action: 'CANCELLED', comment: 'ถูกยกเลิกเนื่องจากคำร้องถูกตีกลับให้แก้ไข' } 
      });

      const allNodes = await this.prisma.wfNode.findMany({ where: { workflowId: request.workflowId } });
      let previousNodeId = request.currentNode?.nextRejectId;
      
      // หาโหนดก่อนหน้าแบบอัตโนมัติ
      if (!previousNodeId) {
         const fallbackNode = allNodes.find(n => n.nextApproveId === request.currentNodeId);
         if (fallbackNode) {
             previousNodeId = fallbackNode.id;
         } else if (request.currentNode?.stepOrder && request.currentNode.stepOrder > 1) {
             const currentStepOrder = request.currentNode.stepOrder;
             const fallbackByOrder = allNodes.find(n => n.stepOrder === currentStepOrder - 1);
             if (fallbackByOrder) previousNodeId = fallbackByOrder.id;
         }
      }

      // 🌟 เคสที่ 1: ตีกลับจนสุดทาง คืนถึงมือคนขอเรื่อง
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
      } 
      // 🌟 เคสที่ 2: ถอยหลังไปโหนดก่อนหน้า (สร้าง PENDING ตรงๆ ไม่ผ่าน assignApprovers)
      else {
         const targetNode = allNodes.find(n => n.id === previousNodeId);

         await this.prisma.wfRequest.update({
           where: { id: request.id },
           data: { currentNodeId: previousNodeId, status: WorkflowStatus.IN_PROGRESS } 
         });

         // ค้นหาว่าใครมีสิทธิ์ในโหนดเป้าหมายบ้าง
         const rawApproverIds = await (this.wfRequestService as any).getApproversForNode(targetNode, request.requesterId, companyId);
         const uniqueUserIds = [...new Set(rawApproverIds)];
         
         // 🎯 สั่งแจกกล่อง PENDING ให้รายคนเลย เพื่อเลี่ยงลอจิก Auto-Approve ในไฟล์ Request
        if (uniqueUserIds.length > 0) {
            await this.prisma.wfAction.createMany({
               // 🌟 แก้ไขตรงนี้: ใช้ (uid: any) เพื่อหยุด Error TS2345
               data: uniqueUserIds.map((uid: any) => ({
                  requestId: request.id,
                  actorId: Number(uid), // 🌟 บังคับแปลงเป็นตัวเลขตรงนี้แทน
                  stepName: targetNode?.nodeName || `ขั้นตอนที่ ${targetNode?.stepOrder || 'ก่อนหน้า'}`,
                  action: 'PENDING',
                  comment: 'ตีกลับ: กรุณาแก้ไขข้อมูลและพิจารณาอนุมัติอีกครั้ง'
               }))
            });
         } else {
            // Fallback ถ้าระบบหาผู้อนุมัติไม่เจอ ให้โยนกลับหาผู้ขอ
            await this.prisma.wfAction.create({
               data: {
                  requestId: request.id, actorId: request.requesterId, 
                  stepName: 'ตีกลับให้ผู้ขอแก้ไขข้อมูล', action: 'PENDING',
                  comment: 'ระบบไม่พบผู้อนุมัติในขั้นตอนก่อนหน้า จึงตีกลับมายังผู้ขอรายการ'
               }
            });
         }
      }
    }

    return { message: 'ประมวลผลการกระทำสำเร็จ' };
  }

// =========================================================
  // 🛡️ Helper: ตรวจสอบสิทธิ์ว่ามี Inbox ค้างอยู่ไหม (รองรับ Delegation)
  // =========================================================
  private async validateApprover(userId: number, requestId: number, isSystemBot: boolean = false) {
    if (isSystemBot) return { pendingTask: null, actingOnBehalfOf: null };

    // 1. หาว่ามีงานค้างที่เป็นชื่อเราตรงๆ หรือไม่
    let pendingTask = await this.prisma.wfAction.findFirst({
      where: { requestId: requestId, actorId: userId, action: 'PENDING' }
    });

    let actingOnBehalfOf: number | null = null;
    let delegatorName: string | null = null;

    if (!pendingTask) {
      const now = new Date();
      const activeDelegations = await this.prisma.secUserDelegation.findMany({
        where: {
          delegateUserId: userId,
          startDate: { lte: now },
          endDate: { gte: now }
        },
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
      where: { userId: userId },
      select: { roleId: true }
    });
    const isSuperAdmin = userRoles.some(r => r.roleId === 1);

    if (!pendingTask && !isSuperAdmin) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์อนุมัติในขั้นตอนนี้ หรือคุณได้ทำการอนุมัติไปแล้ว');
    }

    return { pendingTask, actingOnBehalfOf, delegatorName };
  }

 // =========================================================
  // Helper: บันทึกประวัติ Action
  // =========================================================
  private async saveActionHistory(dto: CreateWfActionDto, userId: number, stepName?: string) {
    return this.prisma.wfAction.create({
      data: {
        requestId: dto.requestId,
        actorId: userId,
        action: dto.action,
        comment: dto.comment,
        stepName: stepName || 'Unknown Step'
      }
    });
  }

  // =========================================================
  // ดูประวัติ
  // =========================================================
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