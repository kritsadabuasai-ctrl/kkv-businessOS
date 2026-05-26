import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { Prisma, RmaStatus } from '@prisma/client'; 
import { RunningNumbersService } from '../../cfg/running-numbers/running-numbers.service';

@Injectable()
export class ReturnRequestsService {
  constructor(
    private prisma: PrismaService,
    private runningService: RunningNumbersService
  ) {}

// =========================================================
  // 📝 1. สร้างคำขอคืนสินค้า (RMA) + ผูก DMS + ผูก Workflow + 🛡️ Defensive Code
  // =========================================================
  async create(userId: number, companyId: number, memberId: number, dto: CreateReturnRequestDto) {
    const order = await this.prisma.comOrder.findFirst({
      where: { id: dto.orderId, memberId: memberId },
      include: { items: true } 
    });

    if (!order) throw new NotFoundException('ไม่พบคำสั่งซื้อ หรือคุณไม่มีสิทธิ์เข้าถึง');

    // 🛡️ ด่านตรวจ 1: ป้องกัน "งูกินหาง" การยื่นเคลมซ้ำซ้อนจนเกินจำนวนที่ซื้อจริง
    for (const item of dto.items) {
      const originalItem = order.items.find(i => i.id === item.orderItemId);
      if (!originalItem) throw new BadRequestException(`ไม่พบรายการสินค้า ID ${item.orderItemId} ในออเดอร์นี้`);
      
      const pastReturns = await this.prisma.comReturnItem.aggregate({
        where: {
          orderItemId: item.orderItemId,
          returnRequest: {
            status: { notIn: ['REJECTED', 'CANCELLED'] } 
          }
        },
        _sum: { qty: true }
      });

      const alreadyReturnedQty = pastReturns._sum.qty || 0;
      
      if (alreadyReturnedQty + item.qty > originalItem.qty) {
        throw new BadRequestException(`จำนวนที่คืนเกินสิทธิ์ (สั่งซื้อไป ${originalItem.qty} ชิ้น, เคยยื่นเคลมแล้ว ${alreadyReturnedQty} ชิ้น, คุณกำลังพยายามยื่นเพิ่มอีก ${item.qty} ชิ้น)`);
      }
    }

    // เจนเลขที่เอกสาร RMA
    const docNo = await this.runningService.generateNextNumber(companyId, 'RMA');

    return this.prisma.$transaction(async (tx) => {
      
      // 🌟 [Defensive Code] กรองเอกสารที่มีอยู่จริงใน SysMedia ก่อน
      let validDocuments: typeof dto.documents = [];
      if (dto.documents && dto.documents.length > 0) {
        const mediaIds = dto.documents.map(d => d.mediaId);
        const existingMedias = await tx.sysMedia.findMany({
          where: { id: { in: mediaIds } },
          select: { id: true }
        });
        
        const validMediaIds = new Set(existingMedias.map(m => m.id));
        validDocuments = dto.documents.filter(doc => validMediaIds.has(doc.mediaId));

        if (validDocuments.length !== dto.documents.length) {
          console.warn(`⚠️ [Create RMA] พบไฟล์หลักฐานบางรายการสูญหาย ข้ามการผูกไฟล์ที่ไม่มีอยู่จริง`);
        }
      }

      // 2. สร้าง RMA พร้อมผูกรายการสินค้า และเอกสารหลักฐานที่คัดกรองแล้ว
      const rma = await tx.comReturnRequest.create({
        data: {
          companyId,
          shopId: dto.shopId,
          orderId: dto.orderId,
          memberId,
          docNo: docNo, 
          type: dto.type,
          reason: dto.reason,
          description: dto.description,
          status: RmaStatus.PENDING, 
          
          // 📦 บันทึกรายการสินค้า
          items: {
            create: dto.items.map(item => ({
              companyId: companyId,
              qty: item.qty,
              condition: item.condition,
              orderItem: { connect: { id: item.orderItemId } }, 
              ...(item.targetProductId && { 
                targetProduct: { connect: { id: item.targetProductId } } 
              })
            }))
          },

          // 📂 บันทึกหลักฐานแนบเฉพาะไฟล์ที่ตรวจแล้วว่ามีอยู่จริง
          ...(validDocuments.length > 0 && {
            documents: {
              create: validDocuments.map(doc => ({
                companyId,
                mediaId: doc.mediaId,
                docType: doc.docType
              }))
            }
          })
        }
      });

      // 3. ค้นหาสายอนุมัติ (Workflow) ที่ตั้งค่าไว้ผ่านตาราง WfModuleMapping
      const moduleMapping = await tx.wfModuleMapping.findFirst({
        where: { 
          companyId, 
          moduleCode: 'ECOM_RMA', 
          isActive: true 
        },
      });

      if (moduleMapping) {
        const existingWf = await tx.wfRequest.findFirst({
          where: { businessId: rma.docNo, businessType: 'RETURN_REQUEST', companyId }
        });

        if (!existingWf) {
          const wfRequest = await tx.wfRequest.create({
            data: {
              companyId,
              workflowId: moduleMapping.workflowId, 
              requesterId: userId,
              businessId: rma.docNo,
              businessType: 'RETURN_REQUEST', 
              topic: `คำขอคืนสินค้า ${rma.docNo} - ${dto.reason}`,
              status: 'PENDING', 
            }
          });

          await tx.comReturnRequest.update({
            where: { id: rma.id },
            data: { wfRequestId: wfRequest.id }
          });
        }
      }

      // 4. ส่งคืนข้อมูลฉบับเต็มให้หน้าบ้าน
      return tx.comReturnRequest.findUnique({
        where: { id: rma.id },
        include: {
          items: { include: { orderItem: { include: { product: true } } } },
          documents: { include: { media: true } }, 
          wfRequest: true
        }
      });
    });
  }
  
  // =========================================================
  // 🔍 2. ดูรายละเอียด RMA
  // =========================================================
  async findOne(id: number, companyId: number) {
    const rma = await this.prisma.comReturnRequest.findFirst({
      where: { id, companyId },
      include: {
        items: { include: { orderItem: true, targetProduct: true } },
        documents: { include: { media: true } }, 
        wfRequest: { include: { currentNode: true } }
      }
    });
    if (!rma) throw new NotFoundException('ไม่พบข้อมูลคำขอเคลมสินค้านี้');
    return rma;
  }

  // =========================================================
  // 🚚 3. อัปเดตเลขพัสดุจากลูกค้า
  // =========================================================
  async updateTracking(id: number, trackingNo: string, courier: string, userId: number) {
    return this.prisma.comReturnRequest.update({
      where: { id },
      data: {
        customerTrackingNo: trackingNo,
        customerCourier: courier,
        status: RmaStatus.SHIPPING 
      }
    });
  }

  // =========================================================
  // 👮 4. แอดมินเปลี่ยนสถานะการเคลม (Update Status)
  // =========================================================
  async updateStatus(id: number, status: RmaStatus, userId: number, companyId: number) {
    await this.findOne(id, companyId); 

    return this.prisma.comReturnRequest.update({
      where: { id },
      data: { status }
    });
  }
}