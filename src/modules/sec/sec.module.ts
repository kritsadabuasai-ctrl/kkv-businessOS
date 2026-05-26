import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SysModulesModule } from './modules/modules.module';
import { MenusModule } from './menus/menus.module';
import { MenuConfigsModule } from './menu-configs/menu-configs.module'; // ✅ 1. นำเข้า Module ใหม่
import { SecLoginLogsModule } from './auth/sec-login-logs.module'; // ✅ นำเข้า Module สำหรับ Login Logs

@Module({
  imports: [
    UsersModule,
    RolesModule,
    PermissionsModule,
    SysModulesModule,
    MenusModule,
    MenuConfigsModule, // ✅ 2. ใส่ใน imports
    SecLoginLogsModule // ✅ 2. ใส่ใน imports
  ],
  exports: [
    UsersModule,
    RolesModule,
    PermissionsModule,
    SysModulesModule,
    MenusModule,
    MenuConfigsModule, // ✅ 3. ใส่ใน exports (เผื่อ module อื่นเรียกใช้)
    SecLoginLogsModule // ✅ 3. ใส่ใน exports (เผื่อ module อื่นเรียกใช้)
  ]
})
export class SecModule {}