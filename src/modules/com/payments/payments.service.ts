import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  // =========================================================
  // 💸 1. แจ้งชำระเงิน พร้อมผูกไฟล์สลิปเข้า DMS (ลูกค้าเป็นคนทำ) + 🛡️ Defensive Code
  // =========================================================
  async create(userId: number, companyId: number, dto: CreatePaymentDto) {
    const order = await this.prisma.comOrder.findFirst({
      where: { id: dto.orderId, companyId }
    });

    if (!order) {
      throw new NotFoundException('ไม่พบคำสั่งซื้อนี้ในระบบ');
    }

    if (order.memberId !== userId) {
      throw new BadRequestException('คุณไม่มีสิทธิ์แจ้งชำระเงินสำหรับคำสั่งซื้อของผู้อื่น');
    }
    
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('ไม่สามารถแจ้งโอนเงินสำหรับออเดอร์ที่ถูกยกเลิกไปแล้ว');
    }

    const { mediaIds, ...paymentData } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1.1 สร้างรายการแจ้งชำระเงินหลักลงฐานข้อมูล
      const payment = await tx.comPayment.create({
        data: {
          companyId,
          orderId: dto.orderId,
          methodId: dto.methodId,
          amount: dto.amount,
          transferredAt: new Date(dto.transferredAt),
          slipUrl: dto.slipUrl || null,
          refNo: dto.refNo || null,
          status: 'PENDING'
        }
      });

      // 🛡️ 1.2 [Defensive Code] คัดกรองเฉพาะ Media ID ของสลิปที่มีอยู่จริงในตาราง SysMedia
      let validMediaIds: number[] = [];
      if (mediaIds && mediaIds.length > 0) {
        // ค้นหา ID ที่มีอยู่จริงรวดเดียว ประหยัดทรัพยากร DB
        const existingMedias = await tx.sysMedia.findMany({
          where: { id: { in: mediaIds } },
          select: { id: true }
        });
        
        validMediaIds = existingMedias.map(m => m.id);

        if (validMediaIds.length !== mediaIds.length) {
           console.warn(`⚠️ [Create Payment] พบรูปภาพสลิปบางรายการสูญหาย ข้ามการผูกรูปที่ไม่มีอยู่จริง`);
        }
      }

      // 1.3 วนลูปบันทึกผูกไฟล์สลิปโอนเงินเฉพาะตัวที่ถูกต้อง (validMediaIds) เข้าตาราง DMS
      if (validMediaIds.length > 0) {
        for (const mediaId of validMediaIds) {
          await tx.ecomPaymentSlip.create({
            data: {
              companyId,
              paymentId: payment.id,
              mediaId: mediaId
            }
          });
        }
      }

      return tx.comPayment.findUnique({
        where: { id: payment.id },
        include: {
          slips: { include: { media: true } }
        }
      });
    });
  }

  // =========================================================
  // 🔍 2. ดูรายการรอตรวจสอบ (สำหรับ Admin Backoffice)
  // =========================================================
  async findAllPending(companyId: number) {
    return this.prisma.comPayment.findMany({
      where: { companyId, status: 'PENDING' },
      include: {
        order: true,
        method: true,
        slips: { include: { media: true } } // ✅ รวมข้อมูลประวัติและรูปภาพไฟล์สลิปจาก DMS ไปด้วย
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  // =========================================================
  // ✅ 3. Admin ตรวจสอบและอนุมัติ/ปฏิเสธยอดสลิปโอนเงิน
  // =========================================================
  async verifyPayment(paymentId: number, companyId: number, adminId: number, dto: VerifyPaymentDto) {
    const payment = await this.prisma.comPayment.findFirst({
      where: { id: paymentId, companyId },
      include: { order: true }
    });

    if (!payment) throw new NotFoundException('ไม่พบรายการชำระเงินนี้ในระบบ');
    if (payment.status !== 'PENDING') throw new BadRequestException('รายการชำระเงินนี้ได้รับการตรวจสอบไปแล้ว');

    return this.prisma.$transaction(async (tx) => {
      // 3.1 บันทึกผลการตรวจสอบของแอดมิน
      const updatedPayment = await tx.comPayment.update({
        where: { id: paymentId },
        data: {
          status: dto.status,
          verifiedBy: adminId,
          verifiedAt: new Date(),
          rejectReason: dto.status === 'REJECTED' ? dto.rejectReason : null
        },
        include: {
          slips: { include: { media: true } }
        }
      });

      // 3.2 หากแอดมินกดยืนยัน APPROVED ยอดเงิน จะปรับปรุงยอดเงินออเดอร์ปลายทางทันที
      if (dto.status === 'APPROVED') {
        const currentPaid = Number(payment.order.paidAmount);
        const newPaymentAmount = Number(payment.amount);
        const totalPaid = currentPaid + newPaymentAmount;
        const grandTotal = Number(payment.order.totalAmount);

        let newPaymentStatus = payment.order.paymentStatus;
        let newOrderStatus = payment.order.status;
        
        if (totalPaid >= grandTotal) {
          newPaymentStatus = 'FULLY_PAID';
        } else if (totalPaid > 0) {
          newPaymentStatus = 'DEPOSIT_PAID';
        }

        // หากสถานะออเดอร์หลักยังเป็น PENDING ให้ปรับเป็น CONFIRMED เพื่อเริ่มขั้นตอนแพ็คของจัดส่ง
        if (payment.order.status === 'PENDING') {
          newOrderStatus = 'CONFIRMED'; 
        }

        await tx.comOrder.update({
          where: { id: payment.orderId },
          data: {
            paidAmount: totalPaid,
            paymentStatus: newPaymentStatus,
            status: newOrderStatus
          }
        });
      }

      return updatedPayment;
    });
  }

  // =========================================================
  // 🔍 4. เรียกดูประวัติการชำระเงินรายตัว
  // =========================================================
  async findOne(id: number, companyId: number) {
    const payment = await this.prisma.comPayment.findFirst({
      where: { id, companyId },
      include: {
        order: true,
        method: true,
        slips: { include: { media: true } }
      }
    });
    if (!payment) throw new NotFoundException('ไม่พบข้อมูลการชำระเงินรายการนี้');
    return payment;
  }
}