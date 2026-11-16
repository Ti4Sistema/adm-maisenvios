import { Permission, PERMISSIONS } from './permissions';

export interface RoleDefinition {
  name: string;
  permissions: Permission[];
}

export const ADMIN_ROLE = 'admin';

// Novos papéis entram aqui: a chave fica gravada em administrator_roles.role.
export const ROLES: Record<string, RoleDefinition> = {
  [ADMIN_ROLE]: {
    name: 'Administrador geral',
    permissions: Object.values(PERMISSIONS),
  },
};

export function permissionsOf(roles: string[]): Permission[] {
  return [...new Set(roles.flatMap((role) => ROLES[role]?.permissions ?? []))];
}
