import { Permission, PERMISSIONS } from './permissions';

export interface RoleDefinition {
  name: string;
  permissions: Permission[];
}

export const ADMIN_ROLE = 'admin';

// Novos papéis entram aqui: a chave fica gravada em administrator_roles.role.
export const ROLES: Record<string, RoleDefinition> = {
  [ADMIN_ROLE]: {
    name: 'Admin global',
    permissions: Object.values(PERMISSIONS),
  },
  editor: {
    name: 'Editor',
    permissions: [PERMISSIONS.REGISTRATIONS_READ, PERMISSIONS.REGISTRATIONS_EDIT],
  },
  reader: {
    name: 'Leitura',
    permissions: [PERMISSIONS.REGISTRATIONS_READ],
  },
};

export function permissionsOf(roles: string[]): Permission[] {
  return [...new Set(roles.flatMap((role) => ROLES[role]?.permissions ?? []))];
}
