import { Module } from '@nestjs/common'; // ✅ แก้ Error: เพิ่มการ Import Module
import { PrismaModule } from '../../../prisma/prisma.module'; // ✅ ตรวจสอบ Path ให้ถูกต้อง
import { GroupsController } from './groups.controller'; // ✅ เพิ่มการอ้างอิงไฟล์
import { DataController } from './data.controller';
import { GroupsService } from './groups.service';
import { MasterDataService } from './data.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    GroupsController, 
    DataController
  ],
  providers: [
    GroupsService, 
    MasterDataService
  ],
  exports: [
    GroupsService,
    MasterDataService // ✅ Export เพื่อให้ Module อื่น (เช่น HR) มาดึงค่าคำนำหน้าชื่อหรือประเภทพนักงานไปใช้
  ],
})
export class MasterModule {}