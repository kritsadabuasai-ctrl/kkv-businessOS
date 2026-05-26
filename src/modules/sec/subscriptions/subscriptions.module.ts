import { Module } from '@nestjs/common';
import { OrgSubscriptionsService } from './subscriptions.service'; // เปลี่ยนชื่อ Import ให้ตรงกัน
import { OrgSubscriptionsController } from './subscriptions.controller'; // เปลี่ยนชื่อ Import ให้ตรงกัน

@Module({
  controllers: [OrgSubscriptionsController], // อัปเดตชื่อใน controllers
  providers: [OrgSubscriptionsService],      // อัปเดตชื่อใน providers
  exports: [OrgSubscriptionsService]         // อัปเดตชื่อใน exports (ถ้ามี)
})
export class SubscriptionsModule {}