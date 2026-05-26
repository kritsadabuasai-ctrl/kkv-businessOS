// src/modules/rpt/rpt.module.ts
import { Module } from '@nestjs/common';
import { RptController } from './rpt.controller';

@Module({
  controllers: [RptController],
  providers: [], // ยังไม่ต้องมี Service ก็ได้
})
export class RptModule {}