import { readonly, ref } from 'vue';
import { api } from '../api/client';
import type { Permission } from './permissions';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: Permission[];
}

const user = ref<SessionUser | null>(null);
let restoring: Promise<void> | null = null;

export const currentUser = readonly(user);

export function can(permission: Permission) {
  return user.value?.permissions.includes(permission) ?? false;
}

export function restoreSession() {
  restoring ??= api<SessionUser>('/auth/me', { expectUnauthorized: true })
    .then((me) => {
      user.value = me;
    })
    .catch(() => {
      user.value = null;
    });
  return restoring;
}

export async function login(email: string, password: string) {
  user.value = await api<SessionUser>('/auth/login', {
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
  user.value = null;
}
