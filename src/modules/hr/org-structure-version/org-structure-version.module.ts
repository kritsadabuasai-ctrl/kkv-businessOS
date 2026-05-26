import { Module, forwardRef } from '@nestjs/common';
import { OrgStructureVersionService } from './org-structure-version.service';
import { OrgStructureVersionController } from './org-structure-version.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
// 🌟 Import WfRequestModule เข้ามาเพื่อรองรับการใช้งานร่วมกันในอนาคต
import { WfRequestModule } from '../../workflow/requests/wf-request.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => WfRequestModule) // 🛡️ ป้องกันงูกินหางฝั่งขาเข้า
  ],
  controllers: [OrgStructureVersionController],
  providers: [OrgStructureVersionService],
  exports: [OrgStructureVersionService], // 👈 เพิ่มบรรทัดนี้ เพื่อปล่อยของออกไปให้ WfRequestService ใช้
})
export class OrgStructureVersionModule {}