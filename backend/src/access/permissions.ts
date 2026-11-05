// Toda permissão do sistema nasce aqui e é exigida com @RequirePermission.
export const PERMISSIONS = {
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  AUDIT_READ: 'audit.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
