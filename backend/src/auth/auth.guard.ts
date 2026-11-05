import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { setActor } from '../common/request-context';
import { AuthService } from './auth.service';
import { IS_PUBLIC } from './public.decorator';
import { readSessionToken } from './session-cookie';
import { AuthenticatedRequest } from './session-user';

// Aplicado a todas as rotas: só fica sem sessão o que tiver @Public().
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionToken(request.headers.cookie);
    const user = token ? await this.auth.resolveSession(token) : null;
    if (!user) throw new UnauthorizedException('Sessão inválida ou expirada');

    request.user = user;
    setActor(user);
    return true;
  }
}
