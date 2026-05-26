import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Jimp } from 'jimp'; // 🌟 ใช้รูปแบบ import ใหม่ที่ถูกต้องของ Jimp v1.0+
import jsQR from 'jsqr';

@Injectable()
export class SlipVerificationsService {
  private readonly logger = new Logger(SlipVerificationsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  // =========================================================
  // 🎯 ฟังก์ชันหลัก: รับรูปภาพ -> อ่าน QR -> เช็คโควตา -> ตรวจสอบ -> บันทึกลง Log
  // =========================================================
  async verifySlip(companyId: number, fileBuffer: Buffer, source: 'INTERNAL_ORDER' | 'EXTERNAL_API') {
    // 🛡️ ด่านที่ 1: ตรวจสอบโควตาของบริษัท
    const quota = await this.prisma.intAiQuota.findUnique({ where: { companyId } });
    if (!quota || quota.slipVerifyUsed >= quota.slipVerifyLimit) {
      throw new BadRequestException('โควตาตรวจสอบสลิปของคุณหมดแล้ว กรุณาอัปเกรดแพ็กเกจ');
    }

    // 🔍 ด่านที่ 2: สกัด QR Code ออกมาจากรูปภาพ
    const payload = await this.extractQrFromImage(fileBuffer);
    if (!payload) {
      throw new BadRequestException('ไม่พบ QR Code มาตรฐานบนรูปภาพนี้ กรุณาอัปโหลดสลิปที่ชัดเจน');
    }

    // 🌐 ด่านที่ 3: ส่ง Payload ไปตรวจสอบกับธนาคาร (ผ่าน Third-Party Adapter)
    const bankData = await this.verifyWithThirdPartyAdapter(payload);
    
    // 🚨 ด่านที่ 4: ตรวจสอบการใช้ "สลิปซ้ำ" (Anti-Fraud)
    const existingSlip = await this.prisma.logSlipVerification.findUnique({
      where: { transRef: bankData.transRef }
    });

    if (existingSlip) {
      // ถ้ารูปนี้เคยถูกสแกนแล้ว ให้ตีกลับทันที! (ดักโจร)
      throw new BadRequestException(`สลิปนี้ถูกใช้งานไปแล้วเมื่อ ${existingSlip.createdAt.toLocaleString()} ไม่สามารถใช้ซ้ำได้`);
    }

    // ✅ ด่านที่ 5: ผ่านทุกด่าน -> บันทึกลง DB และตัดโควตา
    return this.prisma.$transaction(async (tx) => {
      // 5.1 ตัดโควตาบริษัท +1
      await tx.intAiQuota.update({
        where: { companyId },
        data: { slipVerifyUsed: { increment: 1 } }
      });

      // 5.2 บันทึกประวัติสลิปลงสมุดข่อยส่วนกลาง (ล็อก transRef ไว้ไม่ให้ใครใช้ได้อีก)
      const log = await tx.logSlipVerification.create({
        data: {
          companyId,
          transRef: bankData.transRef,
          senderBank: bankData.senderBank,
          senderName: bankData.senderName,
          receiverBank: bankData.receiverBank,
          receiverName: bankData.receiverName,
          amount: bankData.amount,
          transferDate: bankData.transferDate,
          status: 'SUCCESS',
          source: source
        }
      });

      return {
        success: true,
        message: 'ตรวจสอบสลิปสำเร็จ รูปแท้ 100%',
        data: log
      };
    });
  }

  // =========================================================
  // 🛠️ Helper 1: ระบบถอดรหัสรูปภาพเพื่อหา QR Code
  // =========================================================
  private async extractQrFromImage(fileBuffer: Buffer): Promise<string | null> {
    try {
      // 🌟 ใช้ Jimp.read ตามรูปแบบใหม่
      const image = await Jimp.read(fileBuffer);
      const imageData = new Uint8ClampedArray(image.bitmap.data);
      
      // ให้ jsQR ค้นหา QR Code จากเม็ดพิกเซล
      const code = jsQR(imageData, image.bitmap.width, image.bitmap.height);
      
      if (code) {
        return code.data; // ได้ String Payload กลับมา
      }
      return null;
    } catch (error: any) {
      this.logger.error(`Error reading image for QR: ${error.message}`);
      return null;
    }
  }

  // =========================================================
  // 🔌 Helper 2: Adapter เชื่อมต่อ Third-Party API
  // =========================================================
  private async verifyWithThirdPartyAdapter(payload: string): Promise<any> {
    
    // 🌟 ดึงค่าจากตัวแปร Environment (Cloud / .env) แบบไดนามิก
    const apiUrl = this.configService.get<string>('SLIP_VERIFICATION_API_URL');
    const apiKey = this.configService.get<string>('SLIP_VERIFICATION_API_KEY');

    // 🛡️ ดักจับกรณีที่แอดมินลืมตั้งค่า Environment บน Cloud
    if (!apiUrl || !apiKey) {
      this.logger.error('Missing Slip Verification API Config in Environment Variables');
      throw new BadRequestException('ระบบตรวจสอบสลิปขัดข้อง (ตั้งค่า API ไม่สมบูรณ์ กรุณาติดต่อผู้ดูแลระบบ)');
    }

    try {
      const response = await axios.post(
        apiUrl,
        { payload: payload },
        // หมายเหตุ: ชื่อ Header 'x-authorization' อาจเปลี่ยนไปตามผู้ให้บริการแต่ละเจ้า (เช่น SlipOK)
        { headers: { 'x-authorization': apiKey } } 
      );

      // โครงสร้าง data ด้านล่างนี้อิงจากโครงสร้างมาตรฐาน (ปรับเปลี่ยนได้ตาม API จริงที่เลือกใช้)
      const data = response.data.data; 

      // แปลงข้อมูลให้อยู่ใน Format มาตรฐานของเรา (Standardization)
      return {
        transRef: data.transRef,
        senderBank: data.sender?.bank || null,
        senderName: data.sender?.name || null,
        receiverBank: data.receiver?.bank || null,
        receiverName: data.receiver?.name || null,
        amount: data.amount,
        transferDate: new Date(data.transDate || Date.now()) 
      };
    } catch (error: any) {
      this.logger.error(`Third-Party Verification Failed: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
      throw new BadRequestException('ไม่สามารถตรวจสอบสลิปกับธนาคารได้ หรือสลิปปลอม');
    }
  }
}