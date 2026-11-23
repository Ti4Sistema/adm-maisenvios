// Toda permissão do sistema nasce aqui e é exigida com @RequirePermission.
export const PERMISSIONS = {
  ADMINISTRATORS_READ: 'administrators.read',
  ADMINISTRATORS_MANAGE: 'administrators.manage',
  AUDIT_READ: 'audit.read',
  REGISTRATIONS_READ: 'registrations.read',
  REGISTRATIONS_EDIT: 'registrations.edit',
  // Editar ou excluir um pré-cadastro que já foi aprovado.
  REGISTRATIONS_EDIT_APPROVED: 'registrations.edit_approved',
  REGISTRATIONS_APPROVE: 'registrations.approve',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
