import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not } from 'typeorm';
import { ADMIN_ROLE, permissionsOf } from '../access/roles';
import { UserRole } from '../access/user-role.entity';
import { hashPassword } from '../auth/password';
import { Session } from '../auth/session.entity';
import { SessionUser } from '../auth/session-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { normalizeEmail } from './normalize-email';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list() {
    const users = await this.dataSource.manager.find(User, {
      relations: { roles: true },
      order: { name: 'ASC' },
    });
    return users.map((user) => toView(user, user.roles.map(({ role }) => role)));
  }

  async create(dto: CreateUserDto, actor: SessionUser) {
    assertCovers(actor, dto.roles);
    const email = normalizeEmail(dto.email);
    const passwordHash = await hashPassword(dto.password);

    return this.dataSource.transaction(async (manager) => {
      await assertEmailAvailable(manager, email);
      const user = await manager.save(
        manager.create(User, { name: dto.name.trim(), email, passwordHash }),
      );
      await manager.save(
        dto.roles.map((role) => manager.create(UserRole, { userId: user.id, role })),
      );
      return toView(user, dto.roles);
    });
  }

  async update(id: string, dto: UpdateUserDto, actor: SessionUser) {
    const passwordHash = dto.password ? await hashPassword(dto.password) : undefined;

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneBy(User, { id });
      if (!user) throw new NotFoundException('Usuário não encontrado');

      const assigned = await manager.findBy(UserRole, { userId: id });
      const currentRoles = assigned.map(({ role }) => role);
      const nextRoles = dto.roles ?? currentRoles;
      assertCovers(actor, [...currentRoles, ...nextRoles]);

      const active = dto.active ?? user.active;
      const wasAdmin = user.active && currentRoles.includes(ADMIN_ROLE);
      const isAdmin = active && nextRoles.includes(ADMIN_ROLE);
      if (wasAdmin && !isAdmin) await assertAnotherAdmin(manager, id);

      const email = dto.email ? normalizeEmail(dto.email) : user.email;
      if (email !== user.email) await assertEmailAvailable(manager, email);

      user.name = dto.name?.trim() ?? user.name;
      user.email = email;
      user.active = active;
      if (passwordHash) user.passwordHash = passwordHash;
      await manager.save(user);

      await manager.remove(assigned.filter(({ role }) => !nextRoles.includes(role)));
      await manager.save(
        nextRoles
          .filter((role) => !currentRoles.includes(role))
          .map((role) => manager.create(UserRole, { userId: id, role })),
      );

      if (passwordHash || !active) await manager.delete(Session, { userId: id });
      return toView(user, nextRoles);
    });
  }
}

// Quem gerencia usuários não pode conceder nem editar quem tem mais acesso que si.
function assertCovers(actor: SessionUser, roles: string[]) {
  const exceeds = permissionsOf(roles).some(
    (permission) => !actor.permissions.includes(permission),
  );
  if (exceeds) {
    throw new ForbiddenException('Você não pode gerenciar papéis acima do seu acesso');
  }
}

async function assertEmailAvailable(manager: EntityManager, email: string) {
  if (await manager.existsBy(User, { email })) {
    throw new ConflictException('Já existe um usuário com este e-mail');
  }
}

async function assertAnotherAdmin(manager: EntityManager, userId: string) {
  const others = await manager.countBy(UserRole, {
    role: ADMIN_ROLE,
    userId: Not(userId),
    user: { active: true },
  });
  if (!others) {
    throw new ConflictException('O sistema precisa de pelo menos um administrador ativo');
  }
}

function toView(user: User, roles: string[]) {
  const { id, name, email, active, createdAt } = user;
  return { id, name, email, active, roles, createdAt };
}
