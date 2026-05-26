// src/modules/sec/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MailModule } from '../../int/mail/mail.module'; // 🌟 1. นำเข้า MailModule

@Module({
  imports: [MailModule], // 🌟 2. เพิ่มลงใน imports
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}