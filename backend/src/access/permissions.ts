// Toda permissão do sistema nasce aqui e é exigida com @RequirePermission.
export const PERMISSIONS = {
  ADMINISTRATORS_READ: 'administrators.read',
  ADMINISTRATORS_MANAGE: 'administrators.manage',
  AUDIT_READ: 'audit.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
