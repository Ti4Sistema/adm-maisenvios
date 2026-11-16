import { readonly, ref } from 'vue';
import { api } from '../api/client';
import type { Permission } from './permissions';

export interface SessionAdministrator {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: Permission[];
}

const administrator = ref<SessionAdministrator | null>(null);
let restoring: Promise<void> | null = null;

export const currentAdministrator = readonly(administrator);

export function can(permission: Permission) {
  return administrator.value?.permissions.includes(permission) ?? false;
}

export function restoreSession() {
  restoring ??= api<SessionAdministrator>('/auth/me', { expectUnauthorized: true })
    .then((me) => {
      administrator.value = me;
    })
    .catch(() => {
      administrator.value = null;
    });
  return restoring;
}

export async function login(email: string, password: string) {
  administrator.value = await api<SessionAdministrator>('/auth/login', {
    method: 'POST',
    body: { email, password },
    expectUnauthorized: true,
  });
}

export async function logout() {
  await api('/auth/logout', { method: 'POST', expectUnauthorized: true });
  clearSession();
}

export function clearSession() {
  administrator.value = null;
}
