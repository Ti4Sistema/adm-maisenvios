import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';
import { permissionsOf } from '../access/roles';
import { AuditService } from '../audit/audit.service';
import { setActor } from '../common/request-context';
import { env } from '../config/env';
import { User } from '../users/user.entity';
import { normalizeEmail } from '../users/normalize-email';
import { hashPassword, verifyPassword } from './password';
import { Session } from './session.entity';
import { SessionUser } from './session-user';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly audit: AuditService,
  ) {}

  async login(emailInput: string, password: string) {
    const email = normalizeEmail(emailInput);
    const user = await this.users.findOne({
      where: { email },
      relations: { roles: true },
    });

    const validPassword = await verifyPassword(password, user?.passwordHash);
    if (!user?.active || !validPassword) {
      await this.audit.record({ action: 'auth.login_failed', metadata: { email } });
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    await this.sessions.delete({ expiresAt: LessThan(new Date()) });

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000);
    await this.sessions.insert({ userId: user.id, tokenHash: hashToken(token), expiresAt });

    setActor(user);
    await this.audit.record({ action: 'auth.login', entity: 'user', entityId: user.id });
    return { token, expiresAt, user: toSessionUser(user) };
  }

  // Lê o banco a cada requisição: desativar usuário ou trocar papel vale na hora.
  async resolveSession(token: string): Promise<SessionUser | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: hashToken(token), expiresAt: MoreThan(new Date()) },
      relations: { user: { roles: true } },
    });
    return session?.user.active ? toSessionUser(session.user) : null;
  }

  async logout(token: string) {
    await this.sessions.delete({ tokenHash: hashToken(token) });
    await this.audit.record({ action: 'auth.logout' });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    token: string,
  ) {
    const user = await this.users.findOneByOrFail({ id: userId });

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Senha atual incorreta');
    }

    user.passwordHash = await hashPassword(newPassword);
    await this.users.save(user);
    await this.sessions.delete({ userId, tokenHash: Not(hashToken(token)) });
  }
}

// Só o hash fica no banco: um vazamento da tabela não entrega sessões válidas.
function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function toSessionUser(user: User): SessionUser {
  const roles = user.roles.map(({ role }) => role);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles,
    permissions: permissionsOf(roles),
  };
}
