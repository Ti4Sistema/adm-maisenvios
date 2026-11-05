// Espelha backend/src/access/permissions.ts. Aqui só controla o que aparece na tela:
// quem decide o acesso é sempre a API.
export const PERMISSIONS = {
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  AUDIT_READ: 'audit.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
