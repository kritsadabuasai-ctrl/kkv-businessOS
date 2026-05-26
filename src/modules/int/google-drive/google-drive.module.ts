import { Module, Global } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveController } from './google-drive.controller';
import { PrismaModule } from '../../../prisma/prisma.module'; // ⚠️ ตรวจสอบ Path
import { CloudConfigsModule } from '../cloud-configs/cloud-configs.module'; // ⚠️ ตรวจสอบ Path

@Global() // ✅ ตั้งเป็น Global เพื่อให้เป็น Service กลาง
@Module({
  imports: [PrismaModule, CloudConfigsModule],
  controllers: [GoogleDriveController],
  providers: [GoogleDriveService],
  exports: [GoogleDriveService], // ✅ Export ให้ Module อื่นใช้ได้
})
export class GoogleDriveModule {}