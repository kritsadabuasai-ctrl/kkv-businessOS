import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import { PrismaService } from '../../../prisma/prisma.service'; 
import { CloudConfigsService } from '../cloud-configs/cloud-configs.service'; 

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  constructor(
    private prisma: PrismaService,
    private cloudConfigsService: CloudConfigsService,
  ) {}

  private async getDriveForCompany(companyId: number): Promise<drive_v3.Drive> {
    const configs = await this.cloudConfigsService.findAll(companyId);
    const driveConfig = configs.find(c => c.provider === 'GOOGLE_DRIVE' && c.isActive);

    if (!driveConfig) {
      throw new NotFoundException('ไม่พบการตั้งค่า Google Drive สำหรับบริษัทนี้');
    }

    try {
      // 1. อ่านข้อมูล Token จาก Database (ที่มาจากหน้าเว็บ Lovable)
      const tokens = JSON.parse(driveConfig.configData);
      
      // 2. เปลี่ยนมาใช้ OAuth2 Client แทน GoogleAuth (Service Account)
      const auth = new google.auth.OAuth2();
      
      // 3. เซ็ต Token ใส่เข้าไป (รองรับการตั้งชื่อตัวแปรทั้ง 2 แบบเผื่อหน้าบ้านส่งมา)
      auth.setCredentials({
        access_token: tokens.access_token || tokens.accessToken,
        refresh_token: tokens.refresh_token || tokens.refreshToken,
      });

      // 4. คืนค่า Drive Service ที่พร้อมใช้งาน
      return google.drive({ version: 'v3', auth });
    } catch (error: any) {
      this.logger.error(`❌ OAuth Token Error: ${error.message}`);
      throw new NotFoundException('ข้อมูล Token ของ Google Drive ไม่ถูกต้องหรือไม่สามารถอ่านได้');
    }
  }

  async getFileWithAccessToken(fileId: string, accessToken: string) {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const drive = google.drive({ version: 'v3', auth });

      const metadata = await drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, webViewLink, thumbnailLink, iconLink, size',
      });

      const res = await drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      return {
        id: metadata.data.id,
        name: metadata.data.name,
        mimetype: metadata.data.mimeType,
        webViewLink: metadata.data.webViewLink,
        thumbnailLink: metadata.data.thumbnailLink,
        iconLink: metadata.data.iconLink,
        size: metadata.data.size,
        buffer: Buffer.from(res.data as ArrayBuffer),
      };
    } catch (error: any) {
      this.logger.error(`❌ Google Drive Token Error: ${error.message}`);
      throw new NotFoundException(`ไม่สามารถดาวน์โหลดไฟล์ด้วย Token ได้: ${error.message}`);
    }
  }

  async getFile(companyId: number, fileId: string) {
    const drive = await this.getDriveForCompany(companyId);
    try {
      const metadata = await drive.files.get({
        fileId: fileId,
        fields: 'name, mimeType',
      });

      const res = await drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      return {
        name: metadata.data.name,
        mimetype: metadata.data.mimeType,
        buffer: Buffer.from(res.data as ArrayBuffer),
      };
    } catch (error: any) {
      this.logger.error(`❌ Google Drive getFile Error: ${error.message}`);
      throw new NotFoundException(`ไม่สามารถดึงข้อมูลไฟล์จาก Google Drive ได้: ${error.message}`);
    }
  }

  async listSubfolders(companyId: number, folderId: string) {
    const drive = await this.getDriveForCompany(companyId);
    try {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, mimeType)',
      });
      return res.data.files || [];
    } catch (error: any) {
      this.logger.error(`❌ listSubfolders Error: ${error.message}`);
      throw new NotFoundException('ไม่สามารถดึงข้อมูลโฟลเดอร์ได้');
    }
  }

  async getFileInfo(companyId: number, fileId: string) {
    const drive = await this.getDriveForCompany(companyId);
    try {
      const res = await drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size',
      });
      return res.data;
    } catch (error: any) {
      throw new NotFoundException('ไม่พบไฟล์ที่ระบุ');
    }
  }

  async getFileStream(companyId: number, fileId: string) {
    const drive = await this.getDriveForCompany(companyId);
    try {
      const res = await drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      return res.data;
    } catch (error: any) {
      throw new NotFoundException('ไม่สามารถดึง Stream ไฟล์ได้');
    }
  }

  /**
   * ✅ [FIXED] เปลี่ยนชื่อให้ตรงกับ Controller และรองรับการดึงข้อมูลเจาะลึกแบบ Recursive
   */
  async listMediaInFolderRecursive(companyId: number, folderId?: string) {
    const drive = await this.getDriveForCompany(companyId);
    const allMedia: any[] = [];

    const traverse = async (currentFolderId: string) => {
      const res = await drive.files.list({
        q: `'${currentFolderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, webViewLink, thumbnailLink, size)',
      });

      const files = res.data.files || [];
      for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          await traverse(file.id!);
        } 
        else if (
          file.mimeType?.startsWith('image/') || 
          file.mimeType?.startsWith('video/') ||
          file.mimeType === 'application/pdf' || 
          file.mimeType === 'text/plain' || 
          file.mimeType?.includes('wordprocessingml') || 
          file.mimeType?.includes('spreadsheetml') 
        ) {
          allMedia.push({
            fileId: file.id,
            fileName: file.name,
            mimeType: file.mimeType,
            proxyUrl: `/api/int/google-drive/proxy/${file.id}?cid=${companyId}`,
            webViewLink: file.webViewLink, 
            thumbnailLink: file.thumbnailLink,
            size: file.size
          });
        }
      }
    };

    await traverse(folderId || 'root');
    return allMedia;
  }
}