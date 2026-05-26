import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config'; 
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './modules/sec/auth/auth.module';
import { JwtAuthGuard } from './modules/sec/auth/jwt-auth.guard';
import { SecModule } from './modules/sec/sec.module';
import { SubscriptionsModule} from "./modules/sec/subscriptions/subscriptions.module";
import { AuthConfigsModule } from './modules/sec/auth-configs/auth-configs.module';
import { CompanySecurityModule } from './modules/sec/company-security/company-security.module';
import { SecUserDelegationModule } from './modules/sec/delegations/sec-user-delegation.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { CompaniesModule } from './modules/org/companies/companies.module';
import { OnboardingModule} from './modules/org/onboarding/onboarding.module';
import { LogAuditModule } from './modules/sys/log-audit/log-audit.module';
import { MessageLogModule } from './modules/sys/message-log/message-log.module';
import { NotificationsModule } from './modules/sys/notifications/notifications.module';
import { ComTemplateModule } from './modules/sys/templates/com-template.module';
import { MasterModule } from './modules/cfg/master/master.module';
import { RunningNumbersModule } from './modules/cfg/running-numbers/running-numbers.module';
import { SystemConfigsModule } from './modules/cfg/system-configs/system-configs.module';
import { RoundingRulesModule } from './modules/cfg/rounding-rules/rounding-rules.module';
import { PackagesModule} from "./modules/sec/packages/packages.module";
import { PackageModulesModule } from './modules/sec/package-modules/package-modules.module';
import { MessageQueueModule } from './modules/int/message-queue/message-queue.module';
import { MasterDataModule } from './modules/master-data/master-data.module'; 

import { AiModelConfigModule } from './modules/sys/ai-model-config/ai-model-config.module';
import { AiBotsModule } from './modules/int/ai-bots/ai-bots.module';
import { AiBatchJobModule } from './modules/int/ai-batch-jobs/ai-batch-job.module';
import { SocialModule } from './modules/int/social/social.module';
import { GoogleDriveModule} from "./modules/int/google-drive/google-drive.module";
import { UploadModule } from './modules/int/upload/upload.module';
import { SmtpConfigModule } from './modules/int/smtp-config/smtp-config.module';
import { MailModule } from './modules/int/mail/mail.module';
import { WfModuleMappingModule } from './modules/workflow/wf-mapping/wf-module-mapping.module';

import { AddressesModule } from './modules/crm/addresses/addresses.module';
import { CompanyConfigsModule } from './modules/crm/company-configs/company-configs.module';
import { MembersModule } from './modules/crm/members/members.module';
import { CrmMemberShopModule } from './modules/crm/member-shops/crm-member-shop.module';
import { PointLogsModule } from './modules/crm/point-logs/point-logs.module';
import { RedemptionsModule } from './modules/crm/redemptions/redemptions.module';
import { RewardsModule} from "./modules/crm/rewards/rewards.module";
import { WishlistsModule } from './modules/crm/wishlists/wishlists.module';
import { PasswordPolicyModule } from './modules/sec/password-policies/password-policy.module';

import { ShopProfilesModule} from "./modules/com/shop-profiles/shop-profiles.module";
import { AnnouncementsModule } from './modules/com/announcements/announcements.module';
import { BankAccountsModule} from "./modules/com/bank-accounts/bank-accounts.module";
import { DiscountsModule} from "./modules/com/discounts/discounts.module";
import { PaymentMethodsModule} from "./modules/com/payment-methods/payment-methods.module";
import { ProductsModule } from './modules/com/products/products.module';
import { TagsModule } from './modules/com/tags/tags.module';
import { ShopProductsModule } from './modules/com/shop-products/shop-products.module';
import { CartModule } from './modules/com/cart/cart.module';
import { ChatModule } from './modules/int/chat/chat.module';

import { SuppliersModule } from './modules/pro/suppliers/suppliers.module';
import { ShippingMethodsModule } from './modules/com/shipping-methods/shipping-methods.module';
import { ShippingRulesModule } from './modules/com/shipping-rules/shipping-rules.module';
import { PaymentsModule } from './modules/com/payments/payments.module';
import { OrdersModule } from './modules/com/orders/orders.module';
import { PurchaseItemsModule } from './modules/pro/purchase-items/purchase-items.module';
import { PurchaseOrdersModule } from './modules/pro/purchase-orders/purchase-orders.module';
import { StockLogsModule } from './modules/com/stock-logs/stock-logs.module';
import { ReturnItemsModule} from "./modules/com/return-items/return-items.module";
import { ReturnRequestsModule } from './modules/com/return-requests/return-requests.module';
import { ReviewsModule } from './modules/com/reviews/reviews.module';
import { WarehouseModule } from './modules/com/warehouse/warehouse.module';
import { CopilotModule } from './modules/int/copilot/copilot.module';

import { DepartmentModule } from './modules/hr/departments/department.module';
import { PositionModule } from './modules/hr/positions/position.module';
import { PositionSeatModule } from './modules/hr/position-seat/position-seat.module';
import { ManpowerRequestModule } from './modules/hr/manpower-requests/manpower-request.module';
import { HrCalendarModule } from './modules/hr/calendar/hr-calendar.module';
import { HrHolidayModule } from './modules/hr/holiday/hr-holiday.module';
import { HrShiftModule } from './modules/hr/shift/hr-shift.module';
import { HrTimeBreakModule } from './modules/hr/time-break/hr-time-break.module';
import { HrWorkPatternModule } from './modules/hr/work-pattern/hr-work-pattern.module';
import { RosterModule } from './modules/hr/roster/roster.module';
import { WorkflowSimulationModule } from './modules/workflow/simulation/workflow-simulation.module';
import { OrgStructureVersionModule } from './modules/hr/org-structure-version/org-structure-version.module';
import { SlipVerificationsModule } from './modules/int/slip-verifications/slip-verifications.module'; // 🌟 นำเข้า SlipVerificationsModule มาไว้ที่นี่เลย เพื่อให้ทุก Module ที่ต้องการใช้สามารถเรียกใช้ได้ทันที โดยไม่ต้อง Import ซ้ำในแต่ละ Module อีกทีครับ
import { StorageModule } from './modules/sys/storage/storage.module'; // 🌟 นำเข้า StorageModule มาไว้ที่นี่เลย เพื่อให้ทุก Module ที่ต้องการใช้สามารถเรียกใช้ได้ทันที โดยไม่ต้อง Import ซ้ำในแต่ละ Module อีกทีครับ
import { DocumentModule } from './modules/document/document.module'; // 🌟 นำเข้า DocumentModule มาไว้ที่นี่เลย เพื่อให้ทุก Module ที่ต้องการใช้สามารถเรียกใช้ได้ทันที โดยไม่ต้อง Import ซ้ำในแต่ละ Module อีกทีครับ
import { EmployeeModule } from './modules/hr/employees/employee.module';
import { EmploymentPeriodModule } from './modules/hr/employment-periods/employment-period.module';
import { JobHistoryModule } from './modules/hr/job-histories/job-history.module';
import { CmsModule } from './modules/int/cms/cms.module';
import { CmsMenusModule } from './modules/int/cms/menus/cmsmenus.module'; // 🌟 นำเข้า CmsMenusModule มาไว้ที่นี่เลย เพื่อให้ทุก Module ที่ต้องการใช้สามารถเรียกใช้ได้ทันที โดยไม่ต้อง Import ซ้ำในแต่ละ Module อีกทีครับ
import { LandingRegistrationModule } from './modules/org/per-resister/landing-registration.module';
import { DisciplinaryModule } from './modules/hr/disciplinary/disciplinary.module';
import { TrainingModule } from './modules/hr/training/training.module';
import { MeetingRoomModule } from './modules/hr/AdmMeetingRoom/meeting-room.module';
import { DecorationModule}  from './modules/hr/decoration/decoration.module';
import { WelfareModule } from './modules/hr/welfare/welfare.module';
import { GrievanceModule } from './modules/hr/grievance/grievance.module';
import { AssetModule } from './modules/adm/asset/asset.module';


@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    // ✅ System Module พื้นฐาน
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot([{
      ttl: 60000, 
      limit: 60,
    }]),

   

    // ✅ เปิด AuthModule ไว้ (จำเป็นต้องใช้คู่กับ Guard)
    AuthModule,
    SecModule,
    AuthConfigsModule,
    CompanySecurityModule,
    SecUserDelegationModule,
    WorkflowModule,
    SubscriptionsModule,
    PasswordPolicyModule,
    MasterDataModule,
    OnboardingModule,

    MasterModule,
    RunningNumbersModule,
    SystemConfigsModule,
    RoundingRulesModule,
    PackagesModule,
    PackageModulesModule,
    MessageQueueModule,

    CompaniesModule,
    LogAuditModule,
    MessageLogModule,
    NotificationsModule,
    ComTemplateModule,
    AiModelConfigModule,
    AiBotsModule,
    AiBatchJobModule,
    SocialModule,
    GoogleDriveModule,
    UploadModule,
    StorageModule,
    DocumentModule,
    CmsModule,
    CmsMenusModule,
    SmtpConfigModule,
    MailModule,
    ChatModule,
    WarehouseModule,

    AddressesModule,
    CompanyConfigsModule,
    MembersModule,
    CrmMemberShopModule,
    PointLogsModule,
    RedemptionsModule,
    RewardsModule,
    WishlistsModule,

    CopilotModule,

    ShopProfilesModule,
    AnnouncementsModule,
    BankAccountsModule,
    DiscountsModule,
    PaymentMethodsModule,
    ProductsModule,
    TagsModule,
    ShopProductsModule,
    SlipVerificationsModule,

    SuppliersModule,
    ShippingMethodsModule,
    ShippingRulesModule,
    PaymentsModule,
    OrdersModule,
    CartModule,
    PurchaseItemsModule,
    PurchaseOrdersModule,
    StockLogsModule,
    ReturnItemsModule,
    ReturnRequestsModule,
    ReviewsModule,

    // HR Modules
    DepartmentModule,
    PositionModule,
    EmployeeModule,
    EmploymentPeriodModule,
    ManpowerRequestModule,
    JobHistoryModule,
    HrCalendarModule,
    HrHolidayModule,
    HrShiftModule,
    HrTimeBreakModule,
    HrWorkPatternModule,
    RosterModule,
    OrgStructureVersionModule,
    PositionSeatModule,
    LandingRegistrationModule,
    WfModuleMappingModule, // เพิ่มโมดูลนี้เข้ามาใน AppModule
    WorkflowSimulationModule, // เพิ่มโมดูลนี้เข้ามาใน AppModule
    DisciplinaryModule, // เพิ่มโมดูลนี้เข้ามาใน AppModule
    TrainingModule, // เพิ่มโมดูลนี้เข้ามาใน AppModule
    MeetingRoomModule, // เพิ่มโมดูลนี้เข้ามาใน AppModule
    DecorationModule, // เพิ่มโมดูลนี้เข้ามาใน AppModule
    WelfareModule, // เพิ่มโมดูลนี้เข้ามาใน AppModule
    GrievanceModule, // เพิ่มโมดูลนี้เข้ามาใน AppModule
    AssetModule, // เพิ่มโมดูลนี้เข้ามาใน AppModule
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}