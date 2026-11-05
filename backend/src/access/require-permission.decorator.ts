import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const REQUIRED_PERMISSIONS = 'requiredPermissions';

export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
