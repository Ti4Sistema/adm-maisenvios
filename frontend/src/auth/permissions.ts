// Espelha backend/src/access/permissions.ts. Aqui só controla o que aparece na tela:
// quem decide o acesso é sempre a API.
export const PERMISSIONS = {
  ADMINISTRATORS_READ: 'administrators.read',
  ADMINISTRATORS_MANAGE: 'administrators.manage',
  AUDIT_READ: 'audit.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
