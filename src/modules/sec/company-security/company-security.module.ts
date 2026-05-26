import { Module } from '@nestjs/common';
import { CompanySecurityService } from './company-security.service';
import { CompanySecurityController } from './company-security.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CompanySecurityController],
  providers: [CompanySecurityService],
  exports: [CompanySecurityService],
})
export class CompanySecurityModule {}