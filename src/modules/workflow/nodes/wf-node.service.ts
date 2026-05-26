import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; 
import { CreateWfNodeDto, UpdateWfNodeDto } from './wf-node.dto';

@Injectable()
export class WfNodeService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 🛡️ Helper: ตรวจสอบสิทธิ์ก่อนทำรายการ
  // =========================================================
  private async verifyNodeAccess(nodeId: number, companyId: number) {
    const node = await this.prisma.wfNode.findUnique({
      where: { id: nodeId },
    });
    if (!node) throw new NotFoundException(`Node ID ${nodeId} not found`);

    const wf = await this.prisma.wfDefinition.findUnique({
      where: { id: node.workflowId }
    });

    if (!wf || wf.companyId !== companyId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงข้อมูล Node ของบริษัทอื่น');
    }

    return node;
  }

  // =========================================================
  // 1. สร้าง Node
  // =========================================================
  async create(dto: CreateWfNodeDto, companyId: number) {
    // 1. ตรวจสอบความถูกต้องของ Workflow หลัก
    const wf = await this.prisma.wfDefinition.findUnique({
      where: { id: dto.workflowId }
    });
    
    if (!wf) throw new NotFoundException('Workflow Definition not found');
    if (wf.companyId !== companyId) throw new ForbiddenException('ไม่สามารถเพิ่ม Node ลงใน Workflow ของบริษัทอื่นได้');

    // 2. ตรวจสอบความถูกต้องของเงื่อนไขต่างๆ
    if (dto.timeoutHours && !dto.timeoutAction) {
       throw new BadRequestException('Timeout Action is required when Timeout Hours is set');
    }

    if (dto.nodeType === 'CONDITION' && !dto.conditionLogic) {
      throw new BadRequestException('โหนดประเภททางแยก (CONDITION) จำเป็นต้องระบุเงื่อนไข (conditionLogic)');
    }

    // 🌟 1. ดักจับ Error ถ้าลืมใส่เปอร์เซ็นต์
    if (dto.voteRule === 'CUSTOM_PERCENTAGE' && !dto.voteThreshold) {
      throw new BadRequestException('ต้องระบุเปอร์เซ็นต์ (voteThreshold) เมื่อใช้กติกาโหวตแบบกำหนดเปอร์เซ็นต์');
    }

    // ==================================================================
    // 🖋️ LOGIC: ตรวจสอบสิทธิ์การใช้งานฟีเจอร์ลายเซ็นดิจิทัล (Upsell)
    // ==================================================================
    if (dto.requireSignature === true) {
      // 🌟 [FIXED] เปลี่ยนรหัสโมดูลให้ตรงกับฐานข้อมูลและหน้าบ้าน
      const hasESignModule = await this.prisma.orgSubscription.findFirst({
        where: {
          companyId: companyId,
          module: { code: 'MOD_DOC_SIGN' }, 
          status: 'ACTIVE'
        }
      });

      // ถ้าไม่มีสิทธิ์ (ไม่ได้ซื้อหรือหมดอายุ) ให้ปฏิเสธการบันทึก
      if (!hasESignModule) {
        throw new ForbiddenException(
          'ฟีเจอร์ "ลายเซ็นดิจิทัล" สงวนสิทธิ์สำหรับแพ็กเกจ Enterprise หรือผู้ที่ซื้อ Add-on เพิ่มเท่านั้น กรุณาติดต่อฝ่ายขาย'
        );
      }
    }
    // ==================================================================

    // 3. บันทึกข้อมูลลงฐานข้อมูล
    return this.prisma.wfNode.create({
      data: {
        workflowId: dto.workflowId,
        nodeName: dto.nodeName,
        stepOrder: dto.stepOrder,
        
        nodeType: dto.nodeType || 'APPROVAL',
        voteThreshold: dto.voteThreshold,
        conditionLogic: dto.conditionLogic ?? undefined,

        // 🌟 บันทึกสถานะการบังคับเซ็น (ซึ่งผ่านด่านเช็คสิทธิ์มาแล้ว)
        requireSignature: dto.requireSignature || false,
        webhookUrl: dto.webhookUrl,
        webhookPayload: dto.webhookPayload ?? undefined,

        // เคลียร์ค่าคนอนุมัติทิ้ง ถ้าโหนดนี้คือเงื่อนไข (เพื่อความสะอาดของข้อมูล)
        approverRoleId: dto.nodeType === 'CONDITION' ? null : dto.approverRoleId,
        approverPositionId: dto.nodeType === 'CONDITION' ? null : dto.approverPositionId,
        dynamicApprover: dto.nodeType === 'CONDITION' ? null : dto.dynamicApprover,
        
        voteRule: dto.voteRule || 'ANY_APPROVE',
        timeoutHours: dto.timeoutHours,
        timeoutAction: dto.timeoutAction,
      },
    });
  }

  // =========================================================
  // 2. ดู Node ทั้งหมดของ Workflow นี้
  // =========================================================
  async findAllByWorkflow(workflowId: number, companyId: number) {
    const wf = await this.prisma.wfDefinition.findUnique({
      where: { id: workflowId }
    });
    
    if (!wf || wf.companyId !== companyId) {
      throw new ForbiddenException('You cannot access nodes of this workflow');
    }

    return this.prisma.wfNode.findMany({
      where: { workflowId },
      orderBy: { stepOrder: 'asc' },
    });
  }

  // =========================================================
  // 3. ดูรายละเอียด Node เดียว
  // =========================================================
  async findOne(id: number, companyId: number) {
    return this.verifyNodeAccess(id, companyId);
  }

  // =========================================================
  // 4. แก้ไขข้อมูล Node
  // =========================================================
async update(id: number, companyId: number, dto: UpdateWfNodeDto) {
    const currentNode = await this.verifyNodeAccess(id, companyId);

    // ตรวจสอบการ Link ข้าม Node
    if (dto.nextApproveId !== undefined || dto.nextRejectId !== undefined) {
      if (dto.nextApproveId === id || dto.nextRejectId === id) {
        throw new BadRequestException('Cannot link node to itself');
      }

      const targetIds = [dto.nextApproveId, dto.nextRejectId].filter(x => x != null) as number[];
      
      const targets = await this.prisma.wfNode.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, workflowId: true }
      });

      if (targets.length !== targetIds.length) {
        throw new BadRequestException('Target node not found');
      }
      const isSameWorkflow = targets.every(t => t.workflowId === currentNode.workflowId);
      if (!isSameWorkflow) {
        throw new BadRequestException('Cannot link to node in different workflow');
      }
    }
    
    if (dto.timeoutHours && !dto.timeoutAction && !currentNode.timeoutAction) {
        throw new BadRequestException('Timeout Action is required when Timeout Hours is set');
    }

    if (dto.nodeType === 'CONDITION' && !dto.conditionLogic && !currentNode.conditionLogic) {
      throw new BadRequestException('โหนดประเภททางแยก (CONDITION) จำเป็นต้องระบุเงื่อนไข');
    }

    // 🌟 3. ดักจับ Error ตอนกดอัปเดต
    const isCustomVote = dto.voteRule === 'CUSTOM_PERCENTAGE' || (!dto.voteRule && currentNode.voteRule === 'CUSTOM_PERCENTAGE');
    if (isCustomVote && !dto.voteThreshold && !currentNode.voteThreshold) {
       throw new BadRequestException('ต้องระบุเปอร์เซ็นต์ (voteThreshold) เมื่อใช้กติกาโหวตแบบกำหนดเปอร์เซ็นต์');
    }

    // ==================================================================
    // 🖋️ LOGIC: ตรวจสอบสิทธิ์การใช้งานฟีเจอร์ลายเซ็นดิจิทัล (Upsell)
    // ==================================================================
    if (dto.requireSignature === true) {
      // เช็คว่าบริษัทนี้มี Subscription ของโมดูล 'E_SIGN' ที่ยัง Active อยู่หรือไม่[cite: 1]
      const hasESignModule = await this.prisma.orgSubscription.findFirst({
        where: {
          companyId: companyId,
          module: { code: 'MOD_DOC_SIGN' },
          status: 'ACTIVE' 
        }
      });

      // ถ้าไม่มีสิทธิ์ (ไม่ได้ซื้อหรือหมดอายุ) ให้ปฏิเสธการบันทึกแก้ไข
      if (!hasESignModule) {
        throw new ForbiddenException(
          'ฟีเจอร์ "ลายเซ็นดิจิทัล" สงวนสิทธิ์สำหรับแพ็กเกจ Enterprise หรือผู้ที่ซื้อ Add-on เพิ่มเท่านั้น กรุณาติดต่อฝ่ายขาย'
        );
      }
    }
    // ==================================================================

    // 🌟 รองรับ undefined สำหรับ Prisma Json
    const conditionLogicData = dto.conditionLogic !== undefined ? dto.conditionLogic : undefined;
    const webhookPayloadData = dto.webhookPayload !== undefined ? dto.webhookPayload : undefined;

    return this.prisma.wfNode.update({
      where: { id },
      data: {
        ...dto,
        conditionLogic: conditionLogicData,
        webhookPayload: webhookPayloadData // 🌟 ป้องกัน Error แจ้งเตือน JSON Null
      }, 
    });
  }

  // =========================================================
  // 5. ลบ Node
  // =========================================================
  async remove(id: number, companyId: number) {
    await this.verifyNodeAccess(id, companyId);
    
    await this.prisma.wfNode.updateMany({
      where: { nextApproveId: id },
      data: { nextApproveId: null }
    });

    await this.prisma.wfNode.updateMany({
      where: { nextRejectId: id },
      data: { nextRejectId: null }
    });

    return this.prisma.wfNode.delete({
      where: { id },
    });
  }
}