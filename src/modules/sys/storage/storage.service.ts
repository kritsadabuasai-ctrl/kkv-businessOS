import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common'; 
import { PrismaService } from '../../../prisma/prisma.service'; 
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

// 🌟 1. Import ModuleRef เพิ่มเข้ามา
import { ModuleRef } from '@nestjs/core'; 
import { UploadService } from '../../int/upload/upload.service'; 

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  // 🌟 2. เอา @Inject(forwardRef(...)) ออก แล้วใส่ ModuleRef แทน
  constructor(
    private prisma: PrismaService,
    private moduleRef: ModuleRef 
  ) {}

 

  // 1. ตรวจสอบโควตา และตัดยอดพื้นที่ (เรียกใช้ตอนอัปโหลด)
  // =========================================
  async deductQuota(companyId: number, url: string, size: number, module: string) {
    return this.prisma.$transaction(async (tx) => {
      const quota = await tx.intAiQuota.findUnique({
        where: { companyId },
      });

      if (!quota) {
        throw new BadRequestException('ไม่พบข้อมูลแพ็กเกจพื้นที่จัดเก็บของบริษัท โปรดติดต่อแอดมิน');
      }

      // 🌟 เช็คขนาดไฟล์ต่อ 1 การอัปโหลด (maxSingleFileSize เป็น Int/Number ปกติ)
      if (size > quota.maxSingleFileSize) {
        throw new BadRequestException(
          `ขนาดไฟล์ใหญ่เกินไป! ระบบอนุญาตให้อัปโหลดสูงสุด ${this.formatBytes(quota.maxSingleFileSize)} ต่อครั้ง`
        );
      }

      // 🌟 เช็คพื้นที่รวมว่าเต็มหรือยัง (แปลง size เป็น BigInt ก่อนเอาไปบวก)
      const sizeBigInt = BigInt(size);
      if (quota.usedStorageBytes + sizeBigInt > quota.maxStorageBytes) {
        throw new BadRequestException(
          `พื้นที่จัดเก็บเต็ม! (ใช้ไป ${this.formatBytes(quota.usedStorageBytes)} / ${this.formatBytes(quota.maxStorageBytes)})`
        );
      }

      // บันทึกประวัติไฟล์ลงตารางส่วนกลาง
      await tx.sysMedia.create({
        data: {
          companyId,
          url,
          size, // Prisma เซฟเป็น Int
          module,
        },
      });

      // 🌟 อัปเดตยอดพื้นที่ใช้งานสะสม (ใช้ increment ด้วย BigInt)
      await tx.intAiQuota.update({
        where: { companyId },
        data: { usedStorageBytes: { increment: sizeBigInt } },
      });
    });
  }

// ==========================================
  // 3. ผูกไฟล์เข้ากับข้อมูล (Link Media) ป้องกันการถูกกวาดลบทิ้งตอนเที่ยงคืน
  // ==========================================
  async linkMedia(companyId: number, url: string, moduleName: string, refId: number) {
    try {
      // 1. ค้นหาไฟล์จาก URL
      const file = await this.prisma.sysMedia.findUnique({
        where: { url },
      });

      // 2. ถ้าเจอไฟล์ ให้ทำการอัปเดต refId เพื่อบอกระบบว่า "ไฟล์นี้มีเจ้าของแล้วนะ ห้ามลบ!"
      if (file) {
        await this.prisma.sysMedia.update({
          where: { id: file.id },
          data: { refId }, 
        });
        this.logger.log(`🔗 ผูกไฟล์สำเร็จ: ${url} ผูกกับ ${moduleName} ID: ${refId}`);
      }
    } catch (error: any) {
      this.logger.error(`❌ ไม่สามารถผูกไฟล์ได้: ${error.message}`);
    }
  }

  // ==========================================
  // 3. ลบไฟล์และคืนโควตา (เรียกใช้ตอนลบข้อมูล หรือเปลี่ยนรูป)
  // ==========================================
  async restoreQuota(companyId: number, url: string) {
    return this.prisma.$transaction(async (tx) => {
      const file = await tx.sysMedia.findUnique({
        where: { url },
      });

      if (!file) {
        this.logger.warn(`ไม่พบไฟล์ URL: ${url} ในระบบ SysMedia อาจถูกลบไปแล้ว`);
        return;
      }

      // คืนพื้นที่ให้บริษัท
      const sizeBigInt = BigInt(file.size);
      await tx.intAiQuota.update({
        where: { companyId },
        data: { usedStorageBytes: { decrement: sizeBigInt } },
      });

      // ลบข้อมูลไฟล์ออกจาก DB
      await tx.sysMedia.delete({
        where: { id: file.id },
      });

      // 🌟 3. เรียกใช้ UploadService เฉพาะตอนที่จะลบไฟล์ (Lazy Load) แบบนี้จะไม่ Error ชนกัน
      const uploadService = this.moduleRef.get(UploadService, { strict: false });
      await uploadService.deleteFromCloud(url);
    });
  }

  async deleteFile(mediaId: number, companyId: number) {
    // 1. ดึงข้อมูลไฟล์จาก sysMedia
    const media = await this.prisma.sysMedia.findUnique({
      where: { id: mediaId },
    });

    if (!media || media.companyId !== companyId) {
      throw new NotFoundException('ไม่พบไฟล์ที่ต้องการลบ หรือคุณไม่มีสิทธิ์ในไฟล์นี้');
    }

    const employeeCount = await this.prisma.hrEmployee.count({
    where: {
      companyId,
      profileMediaId: media.id, // ใช้ ID เช็คจะแม่นยำและตรงตามมาตรฐาน Relation มากกว่าครับ
    },
  });

  if (employeeCount > 0) {
    throw new BadRequestException('ไม่สามารถลบได้ เนื่องจากไฟล์นี้ถูกใช้งานเป็นรูปโปรไฟล์พนักงาน');
  }
    // 3. ลบไฟล์จริงออกจาก Disk
    try {
      // ปรับ path ตามโครงสร้างการเก็บไฟล์จริงของคุณ
      const filePath = path.join(__dirname, '../../..', media.url); 
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); 
      }
    } catch (error) {
      console.error('Physical file delete error:', error);
    }

    // 4. Transaction: คืนพื้นที่ใน intAiQuota และลบข้อมูลใน sysMedia
    await this.prisma.$transaction([
      
      // คืนพื้นที่โดยใช้ชื่อฟิลด์ usedStorageBytes ตาม Schema
      this.prisma.intAiQuota.update({
        where: { companyId: companyId },
        data: {
          usedStorageBytes: {
            // media.size เป็น Int/BigInt จะถูกนำไปหักออกจาก usedStorageBytes
            decrement: media.size, 
          },
        },
      }),

      // ลบรายการออกจากตาราง sysMedia
      this.prisma.sysMedia.delete({
        where: { id: mediaId },
      }),
      
    ]);

    return { 
      success: true, 
      message: 'ลบไฟล์และคืนพื้นที่โควต้าเรียบร้อยแล้ว' 
    };
  }


  // =========================================================
  // 🧹 กวาดขยะอัตโนมัติ (Garbage Collector) ทำงานทุกๆ เที่ยงคืน
  // =========================================================
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOrphanedMedia() {
    this.logger.log('🧹 เริ่มต้นกระบวนการลบไฟล์ขยะ (Garbage Collection)...');

    // 1. หาไฟล์ทั้งหมดที่ "ไม่มีการผูกใช้งาน" (refType เป็น null หรือ refId เป็น null)
    // และ "เก่ากว่า 24 ชั่วโมง" (เผื่อ User กำลังอัปโหลดอยู่ จะได้ไม่ไปลบของเขา)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const orphanedFiles = await this.prisma.sysMedia.findMany({
      where: {
        refId: null, // 🌟 เช็คแค่ refId เป็น null ตัวเดียวก็พอครับ
        createdAt: { lt: yesterday }
      }
    });

    if (orphanedFiles.length === 0) {
      this.logger.log('✨ ไม่มีไฟล์ขยะตกค้าง');
      return;
    }

    // 2. วนลูปคืนโควตาและลบออกจากระบบ
    for (const file of orphanedFiles) {
      try {
        // คืนพื้นที่ (MB) ให้บริษัท
        await this.restoreQuota(file.companyId, file.url);
        // (ฟังก์ชัน restoreQuota มีลอจิกสั่งลบไฟล์ออกจาก Google Cloud และลบบรรทัดใน DB ให้แล้ว)
      } catch (error: any) { // 🌟 เติม : any ตรงนี้ครับ
        this.logger.error(`❌ ลบไฟล์ขยะล้มเหลว URL: ${file.url} - ${error.message}`);
      }
    }

    this.logger.log(`✅ ลบไฟล์ขยะและคืนพื้นที่สำเร็จจำนวน ${orphanedFiles.length} ไฟล์`);
  }

  // ==========================================
  // 🛠️ Helper: ฟังก์ชันแปลงตัวเลข Bytes ให้แสดงผลสวยงาม (KB, MB, GB)
  // ==========================================
  private formatBytes(bytes: number | bigint, decimals = 2) {
    const numBytes = Number(bytes); // แปลง BigInt ให้เป็น Number ก่อนคำนวณ
    if (!numBytes || numBytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(numBytes) / Math.log(k));
    return parseFloat((numBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}