// Espelha backend/src/access/permissions.ts. Aqui só controla o que aparece na tela:
// quem decide o acesso é sempre a API.
export const PERMISSIONS = {
  ADMINISTRATORS_READ: 'administrators.read',
  ADMINISTRATORS_MANAGE: 'administrators.manage',
  AUDIT_READ: 'audit.read',
  REGISTRATIONS_READ: 'registrations.read',
  REGISTRATIONS_EDIT: 'registrations.edit',
  REGISTRATIONS_EDIT_APPROVED: 'registrations.edit_approved',
  REGISTRATIONS_APPROVE: 'registrations.approve',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
