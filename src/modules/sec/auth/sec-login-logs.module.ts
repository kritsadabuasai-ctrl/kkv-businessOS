import { Module } from '@nestjs/common';
import { SecLoginLogController } from './sec-login-log.controller';

@Module({
  // นำ Controller ที่เราเพิ่งสร้างมาลงทะเบียนที่นี่
  controllers: [SecLoginLogController], 
  // ถ้าในอนาคตคุณสร้าง sec-login-log.service.ts แยก ก็ค่อยเอามาใส่ตรง providers ครับ
  providers: [], 
})
export class SecLoginLogsModule {}