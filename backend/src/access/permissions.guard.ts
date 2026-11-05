import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedRequest } from '../auth/session-user';
import { Permission } from './permissions';
import { REQUIRED_PERMISSIONS } from './require-permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const granted = request.user?.permissions ?? [];
    if (required.every((permission) => granted.includes(permission))) return true;

    await this.audit.record({
      action: 'access.denied',
      metadata: { method: request.method, path: request.originalUrl, required },
    });
    throw new ForbiddenException('Você não tem permissão para esta ação');
  }
}
