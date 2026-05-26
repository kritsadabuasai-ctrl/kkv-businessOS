import { Module } from '@nestjs/common';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';

// ถ้า PrismaService ของคุณไม่ได้ถูกตั้งค่าเป็น Global Module 
// อย่าลืม Import PrismaModule เข้ามาใน array imports: [] ด้วยนะครับ
@Module({
  controllers: [CopilotController],
  providers: [CopilotService],
  exports: [CopilotService], // เผื่ออนาคตมี Module อื่นอยากเรียกใช้สมอง AI ตัวนี้
})
export class CopilotModule {}