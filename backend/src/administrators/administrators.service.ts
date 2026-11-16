import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not } from 'typeorm';
import { ADMIN_ROLE, permissionsOf } from '../access/roles';
import { AdministratorRole } from '../access/administrator-role.entity';
import { hashPassword } from '../auth/password';
import { Session } from '../auth/session.entity';
import { SessionAdministrator } from '../auth/session-administrator';
import { CreateAdministratorDto } from './dto/create-administrator.dto';
import { UpdateAdministratorDto } from './dto/update-administrator.dto';
import { normalizeEmail } from './normalize-email';
import { Administrator } from './administrator.entity';

@Injectable()
export class AdministratorsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list() {
    const administrators = await this.dataSource.manager.find(Administrator, {
      relations: { roles: true },
      order: { name: 'ASC' },
    });
    return administrators.map((administrator) => toView(administrator, administrator.roles.map(({ role }) => role)));
  }

  async create(dto: CreateAdministratorDto, actor: SessionAdministrator) {
    assertCovers(actor, dto.roles);
    const email = normalizeEmail(dto.email);
    const passwordHash = await hashPassword(dto.password);

    return this.dataSource.transaction(async (manager) => {
      await assertEmailAvailable(manager, email);
      const administrator = await manager.save(
        manager.create(Administrator, { name: dto.name.trim(), email, passwordHash }),
      );
      await manager.save(
        dto.roles.map((role) => manager.create(AdministratorRole, { administratorId: administrator.id, role })),
      );
      return toView(administrator, dto.roles);
    });
  }

  async update(id: string, dto: UpdateAdministratorDto, actor: SessionAdministrator) {
    const passwordHash = dto.password ? await hashPassword(dto.password) : undefined;

    return this.dataSource.transaction(async (manager) => {
      const administrator = await manager.findOneBy(Administrator, { id });
      if (!administrator) throw new NotFoundException('Administrador não encontrado');

      const assigned = await manager.findBy(AdministratorRole, { administratorId: id });
      const currentRoles = assigned.map(({ role }) => role);
      const nextRoles = dto.roles ?? currentRoles;
      assertCovers(actor, [...currentRoles, ...nextRoles]);

      const active = dto.active ?? administrator.active;
      const wasAdmin = administrator.active && currentRoles.includes(ADMIN_ROLE);
      const isAdmin = active && nextRoles.includes(ADMIN_ROLE);
      if (wasAdmin && !isAdmin) await assertAnotherAdmin(manager, id);

      const email = dto.email ? normalizeEmail(dto.email) : administrator.email;
      if (email !== administrator.email) await assertEmailAvailable(manager, email);

      administrator.name = dto.name?.trim() ?? administrator.name;
      administrator.email = email;
      administrator.active = active;
      if (passwordHash) administrator.passwordHash = passwordHash;
      await manager.save(administrator);

      await manager.remove(assigned.filter(({ role }) => !nextRoles.includes(role)));
      await manager.save(
        nextRoles
          .filter((role) => !currentRoles.includes(role))
          .map((role) => manager.create(AdministratorRole, { administratorId: id, role })),
      );

      if (passwordHash || !active) await manager.delete(Session, { administratorId: id });
      return toView(administrator, nextRoles);
    });
  }
}

// Quem gerencia administradores não pode conceder nem editar quem tem mais acesso que si.
function assertCovers(actor: SessionAdministrator, roles: string[]) {
  const exceeds = permissionsOf(roles).some(
    (permission) => !actor.permissions.includes(permission),
  );
  if (exceeds) {
    throw new ForbiddenException('Você não pode gerenciar papéis acima do seu acesso');
  }
}

async function assertEmailAvailable(manager: EntityManager, email: string) {
  if (await manager.existsBy(Administrator, { email })) {
    throw new ConflictException('Já existe um administrador com este e-mail');
  }
}

async function assertAnotherAdmin(manager: EntityManager, administratorId: string) {
  const others = await manager.countBy(AdministratorRole, {
    role: ADMIN_ROLE,
    administratorId: Not(administratorId),
    administrator: { active: true },
  });
  if (!others) {
    throw new ConflictException('O sistema precisa de pelo menos um administrador geral ativo');
  }
}

function toView(administrator: Administrator, roles: string[]) {
  const { id, name, email, active, createdAt } = administrator;
  return { id, name, email, active, roles, createdAt };
}
