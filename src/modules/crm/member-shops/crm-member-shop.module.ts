import { Module } from '@nestjs/common';
import { CrmMemberShopService } from './crm-member-shop.service';
import { CrmMemberShopController } from './crm-member-shop.controller';

@Module({
  controllers: [CrmMemberShopController],
  providers: [CrmMemberShopService],
  exports: [CrmMemberShopService],
})
export class CrmMemberShopModule {}