// src/modules/crm/members/members.module.ts
import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { PrismaModule } from '../../../prisma/prisma.module'; 
import { SystemConfigsModule } from '../../cfg/system-configs/system-configs.module'; 
import { StorageService } from '../../sys/storage/storage.service'; // 🌟 1. นำเข้า StorageService

@Module({
  imports: [
    PrismaModule,        
    SystemConfigsModule, 
  ],
  controllers: [MembersController],
  providers: [MembersService, StorageService], // 🌟 2. เพิ่ม StorageService เข้าไปให้บริการ
  exports: [MembersService], 
})
export class MembersModule {}