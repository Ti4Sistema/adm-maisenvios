<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../api/client';
import { actionLabel, auditActions, entityLabel, fieldLabel } from '../audit/labels';
import AppButton from '../components/AppButton.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import PageHeader from '../components/PageHeader.vue';
import TextField from '../components/TextField.vue';

interface AuditLog {
  id: string;
  occurredAt: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  actorEmail: string | null;
  ip: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
}

interface AuditPage {
  items: AuditLog[];
  total: number;
}

const LIMIT = 50;
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
});

const filters = reactive({ actorEmail: '', action: '', from: '', to: '' });
const logs = ref<AuditLog[]>([]);
const total = ref(0);
const page = ref(1);
const expanded = ref<string | null>(null);
const error = ref('');
const loading = ref(false);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / LIMIT)));

// As datas do filtro valem no fuso de quem consulta, do início ao fim do dia.
function dayBoundary(date: string, time: string) {
  return date ? new Date(`${date}T${time}`).toISOString() : undefined;
}

async function load(target = 1) {
  error.value = '';
  loading.value = true;
  try {
    const result = await api<AuditPage>('/audit', {
      query: {
        actorEmail: filters.actorEmail,
        action: filters.action,
        from: dayBoundary(filters.from, '00:00:00'),
        to: dayBoundary(filters.to, '23:59:59.999'),
        page: target,
        limit: LIMIT,
      },
    });
    logs.value = result.items;
    total.value = result.total;
    page.value = target;
    expanded.value = null;
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    loading.value = false;
  }
}

function actorLabel(log: AuditLog) {
  if (log.actorEmail) return log.actorEmail;
  return log.action === 'auth.login_failed' ? 'Não identificado' : 'Sistema';
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'vazio';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

onMounted(() => load());
</script>

<template>
  <PageHeader
    title="Auditoria"
    description="Tudo o que foi feito no sistema, por quem e quando. Os registros não podem ser alterados."
  />

  <form
    class="mb-4 grid items-end gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 xl:grid-cols-5"
    @submit.prevent="load()"
  >
    <TextField v-model="filters.actorEmail" label="Usuário (e-mail)" />
    <div>
      <label for="audit-action" class="mb-1 block text-sm font-medium">Ação</label>
      <select
        id="audit-action"
        v-model="filters.action"
        class="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
      >
        <option value="">Todas</option>
        <option v-for="action in auditActions" :key="action.value" :value="action.value">
          {{ action.label }}
        </option>
      </select>
    </div>
    <TextField v-model="filters.from" label="De" type="date" />
    <TextField v-model="filters.to" label="Até" type="date" />
    <AppButton type="submit" :loading="loading">Filtrar</AppButton>
  </form>

  <ErrorMessage :message="error" class="mb-4" />

  <div class="overflow-x-auto rounded-lg border border-line bg-white">
    <table class="w-full min-w-lg text-left text-sm">
      <thead class="border-b border-line text-xs text-muted">
        <tr>
          <th class="px-4 py-3 font-medium">Quando</th>
          <th class="px-4 py-3 font-medium">Quem</th>
          <th class="px-4 py-3 font-medium">Ação</th>
          <th class="px-4 py-3 font-medium">Item</th>
          <th class="px-4 py-3" />
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        <template v-for="log in logs" :key="log.id">
          <tr>
            <td class="px-4 py-3 whitespace-nowrap text-muted">
              {{ dateFormat.format(new Date(log.occurredAt)) }}
            </td>
            <td class="px-4 py-3">{{ actorLabel(log) }}</td>
            <td class="px-4 py-3">{{ actionLabel(log.action) }}</td>
            <td class="px-4 py-3">{{ log.entity ? entityLabel(log.entity) : '-' }}</td>
            <td class="px-4 py-3 text-right">
              <button
                type="button"
                class="text-sm font-medium text-brand hover:underline"
                :aria-expanded="expanded === log.id"
                @click="expanded = expanded === log.id ? null : log.id"
              >
                {{ expanded === log.id ? 'Ocultar' : 'Detalhes' }}
              </button>
            </td>
          </tr>
          <tr v-if="expanded === log.id">
            <td colspan="5" class="bg-surface px-4 py-3">
              <dl class="space-y-1 text-sm">
                <div v-if="log.entityId" class="flex gap-2">
                  <dt class="font-medium">Identificador:</dt>
                  <dd class="break-all">{{ log.entityId }}</dd>
                </div>
                <div v-if="log.ip" class="flex gap-2">
                  <dt class="font-medium">IP:</dt>
                  <dd>{{ log.ip }}</dd>
                </div>
                <div v-for="(change, field) in log.changes" :key="field" class="flex gap-2">
                  <dt class="font-medium">{{ fieldLabel(String(field)) }}:</dt>
                  <dd class="break-all">
                    {{ formatValue(change.from) }} → {{ formatValue(change.to) }}
                  </dd>
                </div>
                <div v-for="(value, key) in log.metadata" :key="key" class="flex gap-2">
                  <dt class="font-medium">{{ fieldLabel(String(key)) }}:</dt>
                  <dd class="break-all">{{ formatValue(value) }}</dd>
                </div>
              </dl>
            </td>
          </tr>
        </template>
        <tr v-if="!logs.length && !loading">
          <td colspan="5" class="px-4 py-8 text-center text-muted">
            Nenhum registro encontrado.
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
    <p>{{ total }} registro(s), página {{ page }} de {{ totalPages }}</p>
    <div class="flex gap-2">
      <AppButton variant="secondary" :disabled="page <= 1" @click="load(page - 1)">
        Anterior
      </AppButton>
      <AppButton variant="secondary" :disabled="page >= totalPages" @click="load(page + 1)">
        Próxima
      </AppButton>
    </div>
  </div>
</template>
