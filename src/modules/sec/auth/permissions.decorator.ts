import { SetMetadata } from '@nestjs/common';

// รับค่าเป็น array ของ string เช่น @RequirePermissions('user.create', 'user.view')
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) => 
  SetMetadata(PERMISSIONS_KEY, permissions);