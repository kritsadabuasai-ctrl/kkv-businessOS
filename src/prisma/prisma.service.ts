import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly cls: ClsService) {
    super({
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();

    // 🔥 ระบบ Auto Audit Log Middleware (พร้อมระบบป้องกันตอน Seed) 🔥
    this.$use(async (params, next) => {
      // 1. ตรวจสอบว่าคำสั่งมี Model หรือไม่
      if (!params.model) {
        return next(params);
      }

      const modelName = params.model;

      // 2. ดึงข้อมูลจาก CLS (กระเป๋าเป้)
      const user = this.cls.get('user');
      const ipAddress = this.cls.get('ip'); // 🌟 ดึงค่า IP 
      const userAgent = this.cls.get('userAgent'); // 🌟 ดึงค่า User Agent

      // 🛡️ ป้องกันตอน Seed หรือระบบทำงานเบื้องหลัง: ถ้าไม่มีข้อมูล User หรือ CompanyId
      if (!user || !user.companyId) {
        return next(params);
      }

      // 3. กรองเฉพาะ Action ที่มีการแก้ไขข้อมูล และยกเว้นตาราง Log ต่างๆ เพื่อป้องกัน Loop
      const isMutating = ['create', 'update', 'delete', 'upsert'].includes(params.action);
      
      // 🌟 ยกเว้นตารางจำพวก Log เพื่อไม่ให้เกิด Infinite Loop หรือเก็บ Log ซ้อน Log
      const ignoredModels = [
        'LogAudit', 
        'IntAiUsageLog', 
        'ComMessageLog', 
        'ComStockLog', 
        'HrEmployeeSchedule', 
        'SecLoginLog', // ยกเว้น Login Log ด้วย
        'SecAuditLog'  // ยกเว้นเผื่อยังมีค้างในระบบ
      ];

      if (!isMutating || ignoredModels.includes(modelName)) {
        return next(params);
      }

      const companyId = user.companyId;
      const userId = user.userId || user.sub; // รองรับทั้ง userId และ sub

      // 4. เก็บข้อมูลเก่า (Old Data) สำหรับกรณี Update หรือ Delete
      let oldData = null;
      if (params.action === 'update' || params.action === 'delete') {
        try {
          oldData = await (this[modelName as any] as any).findUnique({
            where: params.args.where,
          });
        } catch (e) {
          this.logger.debug(`Could not fetch old data for ${modelName}`);
        }
      }

      // 5. ดำเนินการคำสั่งหลักลง Database
      const result = await next(params);

      // 6. บันทึกประวัติลงตาราง LogAudit 
      if (result) {
        try {
          const recordId = String(result.id || params.args.where?.id || '0');

          // ใช้คำสั่งบันทึกแบบ Fire-and-forget (ไม่ใช้ await เพื่อไม่ให้ระบบหลักทำงานช้าลง)
          (this as any).logAudit.create({
            data: {
              companyId: companyId,
              userId: userId || null,
              tableName: modelName,
              action: params.action.toUpperCase(),
              recordId: recordId,
              oldValues: oldData ? JSON.parse(JSON.stringify(oldData)) : undefined,
              newValues: params.action === 'delete' ? undefined : JSON.parse(JSON.stringify(result)),
              ipAddress: ipAddress || null, // 🌟 บันทึก IP ลง Database
              userAgent: userAgent || null, // 🌟 บันทึก User Agent ลง Database
            },
          }).catch((err: any) => this.logger.error(`Audit Log Create Error: ${err.message}`));
        } catch (logErr: any) {
          this.logger.error(`Failed to trigger Audit Log: ${logErr.message}`);
        }
      }

      return result;
    });
  }

  // 🔴 เมื่อปิดแอป (Deploy ใหม่ หรือ แอปแครช): ให้เตะท่อเชื่อมต่อทิ้งอย่างปลอดภัย
  async onModuleDestroy() {
    this.logger.log('🔌 [Graceful Shutdown] กำลังคืน Connection ให้ Cloud SQL เพื่อป้องกันปัญหาท่อเต็ม (Too many connections)...');
    try {
      await this.$disconnect();
      this.logger.log('✅ คืน Connection Database สำเร็จ!');
    } catch (e: any) {
      this.logger.error(`❌ เกิดข้อผิดพลาดตอน Disconnect: ${e.message}`);
    }
  }
}