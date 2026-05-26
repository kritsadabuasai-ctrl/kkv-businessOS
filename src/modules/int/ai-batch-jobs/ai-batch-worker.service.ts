import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiBatchJobService } from './ai-batch-job.service';

@Injectable()
export class AiBatchWorkerService implements OnModuleInit {
  private readonly logger = new Logger(AiBatchWorkerService.name);
  private isProcessing = false;

  constructor(private readonly batchService: AiBatchJobService) {}

  onModuleInit() {
    this.logger.log('🚀 AI Batch Worker Ready (Knowledge & Product Mode)...');
    this.runWorkerLoop();
  }

  private async runWorkerLoop() {
    while (true) {
      try {
        if (!this.isProcessing) {
          await this.processNextJob();
        }
      } catch (error : any) {
        this.logger.error(`❌ Worker Loop Error: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  private async processNextJob() {
    const job = await this.batchService.pickPendingJob();
    if (!job) return;

    this.isProcessing = true;
    try {
      // 🌟 1. แกะซองเอกสาร (Payload) ให้ปลอดภัย
      let payload = job.payload as any;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload); // แปลง String เป็น JSON Object
        } catch (e) {
          throw new Error('ไม่สามารถอ่านข้อมูล Payload ได้ (Invalid JSON format)');
        }
      }

      // 🌟 2. ดักจับกรณีไม่มีเอกสารแนบมาเลย
      if (!payload) {
        throw new Error('ข้อมูลรูปภาพ/สินค้า ว่างเปล่า (Payload is null)');
      }

      // ✅ 1. งานประเภท KNOWLEDGE BASE
      if (job.jobType.startsWith('KNOWLEDGE_')) {
        try {
          await this.batchService.processSingleItem(job.companyId, payload, job.jobType);
          await this.batchService.updateProgress(job.id, 1, 0); 
        } catch (itemError : any) {
          this.logger.error(`⚠️ Knowledge Item Error: ${itemError.message}`);
          await this.batchService.updateProgress(job.id, 0, 1); 
          throw itemError; 
        }
      } 
      // ✅ 2. งานประเภทรูปภาพสินค้า
      else if (job.jobType === 'PRODUCT_IMAGE_PROCESSING' || job.jobType === 'PRODUCT_IMAGE_TAG') {
        try {
          // กรณีส่งมาหลายรูป (Array)
          if (Array.isArray(payload.images)) {
            for (const img of payload.images) {
              const imgPayload = {
                productId: payload.productId,
                imageId: img.id || img.imageId,
                imageUrl: img.url,
                fileId: img.fileId,
                isGoogleDrive: img.source === 'GOOGLE_DRIVE' || img.isGoogleDrive
              };
              await this.batchService.processProductImage(job.companyId, imgPayload);
              await this.batchService.updateProgress(job.id, 1, 0);
            }
          } 
          // กรณีส่งมาทีละรูป
          else {
            // 🌟 เช็คให้ชัวร์ว่ามี productId ก่อนโยนให้ฟังก์ชันข้างในทำงาน
            if (!payload.productId) {
              throw new Error('ไม่พบข้อมูล productId ใน Payload');
            }
            await this.batchService.processProductImage(job.companyId, payload);
            await this.batchService.updateProgress(job.id, 1, 0);
          }
        } catch (itemError : any) {
          this.logger.error(`⚠️ Product Image Error: ${itemError.message}`);
          await this.batchService.updateProgress(job.id, 0, 1);
          throw itemError;
        }
      }
      // ✅ 3. สำหรับงานอื่นๆ (Fallback)
      else {
        const files = payload?.files || [];
        for (const file of files) {
          try {
            await this.batchService.processSingleItem(job.companyId, file, job.jobType);
            await this.batchService.updateProgress(job.id, 1, 0);
          } catch (fileError : any) {
            this.logger.error(`⚠️ General Item Error: ${fileError.message}`);
            await this.batchService.updateProgress(job.id, 0, 1);
          }
        }
      }

      await this.batchService.completeJob(job.id, `Finished processing job: ${job.jobType}`);
    } catch (error : any) {
      await this.batchService.failJob(job.id, error.message);
    } finally {
      this.isProcessing = false;
    }
  }
}