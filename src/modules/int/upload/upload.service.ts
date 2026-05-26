import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import * as path from 'path';
import 'multer';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private storage: Storage;
  private bucketName: string;

  constructor() {
    this.storage = new Storage(); 
    this.bucketName = 'kkvbusiness_buckets'; // ✅ ชื่อ Bucket ของคุณ
  }

  // 1. อัปโหลดไฟล์ขึ้น GCS
  async saveToCloud(file: Express.Multer.File, companyId: any, type: string): Promise<string> {
    try {
      const cleanType = type.replace(/[^a-zA-Z0-9_-]/g, '') || 'others';
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(originalName);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      
      const filePath = `co_${companyId}/${cleanType}/${uniqueSuffix}${ext}`;

      const bucket = this.storage.bucket(this.bucketName);
      const fileUpload = bucket.file(filePath);

      await fileUpload.save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
      });

      return `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

    } catch (error) {
      this.logger.error(`GCS Upload Error: ${error}`);
      throw new InternalServerErrorException('Upload to Google Cloud failed');
    }
  }

  // 2. ดาวน์โหลดไฟล์จาก Cloud เป็น Buffer (เผื่อให้ AI อ่าน)
  async downloadFromCloud(fileUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error: any) {
      this.logger.error(`Download Error: ${error.message}`);
      throw new Error(`ไม่สามารถดาวน์โหลดไฟล์จากคลาวด์ได้: ${error.message}`);
    }
  }

  // 3. ลบไฟล์ออกจาก Google Cloud 
  async deleteFromCloud(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    try {
      // URL: https://storage.googleapis.com/BUCKET_NAME/co_1/knowledge/file.pdf
      const prefix = `https://storage.googleapis.com/${this.bucketName}/`;
      
      if (fileUrl.startsWith(prefix)) {
        const filePath = fileUrl.replace(prefix, ''); // ตัด Prefix ออกจะได้ Path ใน Bucket
        await this.storage.bucket(this.bucketName).file(filePath).delete();
        this.logger.log(`Deleted file from GCS: ${filePath}`);
      }
    } catch (error: any) {
      // ถ้าไม่เจอไฟล์ใน GCS ให้ข้ามไป ไม่ต้อง Throw Error ให้ระบบหยุดทำงาน
      if (error.code === 404) {
        this.logger.warn(`File not found on GCS for deletion: ${fileUrl}`);
      } else {
        this.logger.error(`GCS Delete Error: ${error.message}`);
      }
    }
  }
}