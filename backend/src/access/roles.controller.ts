import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from './permissions';
import { RequirePermission } from './require-permission.decorator';
import { ROLES } from './roles';

@Controller('roles')
export class RolesController {
  @Get()
  @RequirePermission(PERMISSIONS.ADMINISTRATORS_READ)
  list() {
    return Object.entries(ROLES).map(([key, role]) => ({ key, ...role }));
  }
}
