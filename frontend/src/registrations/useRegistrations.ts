import { reactive, ref } from 'vue';
import { api, ApiError } from '../api/client';
import type { FieldChange, Registration, RegistrationType, Schema } from './types';

export interface Notice {
  kind: 'error' | 'info';
  text: string;
}

// Estado da tela de pré-cadastros: lista, filtros e gravação campo a campo.
export function useRegistrations() {
  const schema = ref<Schema | null>(null);
  const rows = ref<Registration[]>([]);
  const filters = reactive({ type: '', status: '', search: '' });
  const loading = ref(false);
  const loadError = ref('');
  const notice = ref<Notice | null>(null);
  const saving = ref(new Set<string>());
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  function notify(kind: Notice['kind'], text: string) {
    notice.value = { kind, text };
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice.value = null), kind === 'error' ? 8000 : 4000);
  }

  async function loadSchema() {
    schema.value ??= await api<Schema>('/registrations/schema');
  }

  async function load() {
    loading.value = true;
    loadError.value = '';
    try {
      await loadSchema();
      rows.value = await api<Registration[]>('/registrations', { query: { ...filters } });
    } catch (cause) {
      loadError.value = (cause as Error).message;
    } finally {
      loading.value = false;
    }
  }

  function replace(view: Registration) {
    const index = rows.value.findIndex(({ id }) => id === view.id);
    if (index >= 0) rows.value.splice(index, 1, view);
    return view;
  }

  async function refresh(id: string) {
    return replace(await api<Registration>(`/registrations/${id}`));
  }

  // Envia só os campos alterados, com o valor que a tela tinha antes.
  async function save(row: Registration, changes: { field: string; to: unknown }[]) {
    if (!changes.length) return true;
    const body: FieldChange[] = changes.map(({ field, to }) => ({
      field,
      from: row.values[field] ?? null,
      to,
    }));
    const keys = changes.map(({ field }) => `${row.id}:${field}`);
    keys.forEach((key) => saving.value.add(key));
    try {
      replace(await api<Registration>(`/registrations/${row.id}`, { method: 'PATCH', body: { changes: body } }));
      return true;
    } catch (cause) {
      notify('error', (cause as Error).message);
      if (cause instanceof ApiError && cause.status === 409) await refresh(row.id).catch(() => {});
      return false;
    } finally {
      keys.forEach((key) => saving.value.delete(key));
    }
  }

  async function create(type: RegistrationType) {
    try {
      const view = await api<Registration>('/registrations', { method: 'POST', body: { type } });
      rows.value.unshift(view);
      return view;
    } catch (cause) {
      notify('error', (cause as Error).message);
      return null;
    }
  }

  async function action(row: Registration, path: 'approve' | 'unapprove', success: string) {
    try {
      replace(await api<Registration>(`/registrations/${row.id}/${path}`, { method: 'POST' }));
      notify('info', success);
    } catch (cause) {
      notify('error', (cause as Error).message);
    }
  }

  async function remove(row: Registration) {
    try {
      await api(`/registrations/${row.id}`, { method: 'DELETE' });
      rows.value = rows.value.filter(({ id }) => id !== row.id);
      notify('info', 'Pré-cadastro excluído');
      return true;
    } catch (cause) {
      notify('error', (cause as Error).message);
      return false;
    }
  }

  return {
    schema,
    rows,
    filters,
    loading,
    loadError,
    notice,
    saving,
    notify,
    load,
    refresh,
    save,
    create,
    remove,
    approve: (row: Registration) => action(row, 'approve', 'Pré-cadastro aprovado'),
    unapprove: (row: Registration) => action(row, 'unapprove', 'Aprovação desfeita'),
  };
}
