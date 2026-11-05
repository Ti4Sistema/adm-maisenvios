import dataSource from './data-source';
import { ADMIN_ROLE } from '../access/roles';
import { UserRole } from '../access/user-role.entity';
import { hashPassword } from '../auth/password';
import { normalizeEmail } from '../users/normalize-email';
import { User } from '../users/user.entity';

async function seedAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD');
  }
  if (ADMIN_PASSWORD.length < 10) {
    throw new Error('ADMIN_PASSWORD deve ter pelo menos 10 caracteres');
  }

  await dataSource.initialize();
  try {
    const email = normalizeEmail(ADMIN_EMAIL);
    if (await dataSource.manager.existsBy(User, { email })) {
      console.log(`Usuário ${email} já existe, nada a fazer`);
      return;
    }

    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    await dataSource.transaction(async (manager) => {
      const user = await manager.save(
        manager.create(User, { name: ADMIN_NAME ?? 'Administrador', email, passwordHash }),
      );
      await manager.save(manager.create(UserRole, { userId: user.id, role: ADMIN_ROLE }));
    });
    console.log(`Administrador ${email} criado`);
  } finally {
    await dataSource.destroy();
  }
}

seedAdmin();
