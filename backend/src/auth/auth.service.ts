import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';
import { permissionsOf } from '../access/roles';
import { AuditService } from '../audit/audit.service';
import { setActor } from '../common/request-context';
import { env } from '../config/env';
import { Administrator } from '../administrators/administrator.entity';
import { normalizeEmail } from '../administrators/normalize-email';
import { hashPassword, verifyPassword } from './password';
import { Session } from './session.entity';
import { SessionAdministrator } from './session-administrator';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Administrator) private readonly administrators: Repository<Administrator>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly audit: AuditService,
  ) {}

  async login(emailInput: string, password: string) {
    const email = normalizeEmail(emailInput);
    const administrator = await this.administrators.findOne({
      where: { email },
      relations: { roles: true },
    });

    const validPassword = await verifyPassword(password, administrator?.passwordHash);
    if (!administrator?.active || !validPassword) {
      await this.audit.record({ action: 'auth.login_failed', metadata: { email } });
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    await this.sessions.delete({ expiresAt: LessThan(new Date()) });

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000);
    await this.sessions.insert({ administratorId: administrator.id, tokenHash: hashToken(token), expiresAt });

    setActor(administrator);
    await this.audit.record({ action: 'auth.login', entity: 'administrator', entityId: administrator.id });
    return { token, expiresAt, administrator: toSessionAdministrator(administrator) };
  }

  // Lê o banco a cada requisição: desativar administrador ou trocar papel vale na hora.
  async resolveSession(token: string): Promise<SessionAdministrator | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: hashToken(token), expiresAt: MoreThan(new Date()) },
      relations: { administrator: { roles: true } },
    });
    return session?.administrator.active ? toSessionAdministrator(session.administrator) : null;
  }

  async logout(token: string) {
    await this.sessions.delete({ tokenHash: hashToken(token) });
    await this.audit.record({ action: 'auth.logout' });
  }

  async changePassword(
    administratorId: string,
    currentPassword: string,
    newPassword: string,
    token: string,
  ) {
    const administrator = await this.administrators.findOneByOrFail({ id: administratorId });

    if (!(await verifyPassword(currentPassword, administrator.passwordHash))) {
      throw new BadRequestException('Senha atual incorreta');
    }

    administrator.passwordHash = await hashPassword(newPassword);
    await this.administrators.save(administrator);
    await this.sessions.delete({ administratorId, tokenHash: Not(hashToken(token)) });
  }
}

// Só o hash fica no banco: um vazamento da tabela não entrega sessões válidas.
function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function toSessionAdministrator(administrator: Administrator): SessionAdministrator {
  const roles = administrator.roles.map(({ role }) => role);
  return {
    id: administrator.id,
    name: administrator.name,
    email: administrator.email,
    roles,
    permissions: permissionsOf(roles),
  };
}
