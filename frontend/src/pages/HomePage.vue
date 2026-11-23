<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api/client';
import { PERMISSIONS } from '../auth/permissions';
import { can, currentAdministrator } from '../auth/session';
import DailyChart from '../components/DailyChart.vue';
import NavIcon from '../components/NavIcon.vue';
import type { Registration, RegistrationType } from '../registrations/types';

const ROUTE_BY_TYPE: Record<RegistrationType, string> = {
  client: '/pre-cadastros/clientes',
  smart: '/pre-cadastros/smart',
};
const STATUS_LABEL: Record<string, string> = { draft: 'Rascunho', ready: 'Pronto', approved: 'Aprovado' };

const greeting = computed(() => {
  const hour = new Date().getHours();
  const word = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = currentAdministrator.value?.name?.split(' ')[0] ?? '';
  return `${word}, ${firstName}!`;
});

// Atalhos coloridos do topo, só os que o administrador pode abrir.
const shortcuts = computed(() =>
  [
    {
      to: '/pre-cadastros/clientes',
      label: 'Pré-cadastro de clientes',
      icon: 'users',
      color: 'bg-orange-500',
      allowed: can(PERMISSIONS.REGISTRATIONS_READ),
    },
    {
      to: '/pre-cadastros/smart',
      label: 'Pré-cadastro Smart',
      icon: 'store',
      color: 'bg-indigo-500',
      allowed: can(PERMISSIONS.REGISTRATIONS_READ),
    },
    {
      to: '/administradores',
      label: 'Administradores',
      icon: 'shield',
      color: 'bg-sky-500',
      allowed: can(PERMISSIONS.ADMINISTRATORS_READ),
    },
    {
      to: '/auditoria',
      label: 'Auditoria',
      icon: 'history',
      color: 'bg-emerald-500',
      allowed: can(PERMISSIONS.AUDIT_READ),
    },
  ].filter(({ allowed }) => allowed),
);

const rows = ref<Registration[] | null>(null);
const loadError = ref('');

onMounted(async () => {
  if (!can(PERMISSIONS.REGISTRATIONS_READ)) return;
  try {
    rows.value = await api<Registration[]>('/registrations');
  } catch (cause) {
    loadError.value = (cause as Error).message;
  }
});

function summary(type: RegistrationType) {
  const counts: Record<string, number> = { draft: 0, ready: 0, approved: 0 };
  for (const row of rows.value ?? []) if (row.type === type) counts[row.status] += 1;
  return counts;
}

const ready = computed(() => (rows.value ?? []).filter(({ status }) => status === 'ready'));
const subtitle = computed(() => {
  if (!rows.value) return 'Sistema administrativo da Mais Envios.';
  const count = ready.value.length;
  if (!count) return 'Nenhum pré-cadastro aguardando aprovação.';
  return `Você tem ${count} pré-cadastro${count > 1 ? 's' : ''} pronto${count > 1 ? 's' : ''} aguardando aprovação.`;
});

const maskDocument = (value: string) =>
  value.length === 14
    ? value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    : value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

const nameOf = (row: Registration) =>
  (row.values.tradeName as string) || (row.values.legalName as string) || 'Sem nome';
</script>

<template>
  <header class="mb-6 text-white">
    <h1 class="text-2xl font-bold tracking-tight md:text-3xl">{{ greeting }}</h1>
    <p class="mt-1 text-sm text-white/75">{{ subtitle }}</p>
  </header>

  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <RouterLink
      v-for="item in shortcuts"
      :key="item.to"
      :to="item.to"
      class="group flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
        :class="item.color"
      >
        <NavIcon :name="item.icon" />
      </span>
      <span class="font-semibold text-ink group-hover:text-brand">{{ item.label }}</span>
    </RouterLink>
  </div>

  <p v-if="loadError" class="mt-6 text-sm text-danger">{{ loadError }}</p>

  <div v-if="rows" class="mt-6 grid items-start gap-4 lg:grid-cols-3">
    <div class="grid gap-4 sm:grid-cols-2 lg:col-span-2">
      <section
        v-for="type in ['client', 'smart'] as RegistrationType[]"
        :key="type"
        class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold">{{ type === 'client' ? 'Clientes' : 'Smart' }}</h2>
          <RouterLink :to="ROUTE_BY_TYPE[type]" class="text-xs font-semibold text-brand hover:underline">
            Abrir
          </RouterLink>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div v-for="(count, status) in summary(type)" :key="status" class="rounded-xl bg-surface px-3 py-3">
            <p class="text-2xl font-bold">{{ count }}</p>
            <p class="mt-0.5 text-xs text-muted">{{ STATUS_LABEL[status] }}</p>
          </div>
        </div>
      </section>

      <DailyChart class="sm:col-span-2" />
    </div>

    <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-semibold">Prontos para aprovar</h2>
        <span
          v-if="ready.length"
          class="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-2 text-xs font-bold text-white"
        >
          {{ ready.length }}
        </span>
      </div>
      <p v-if="!ready.length" class="py-4 text-center text-sm text-muted">Nada pendente por aqui.</p>
      <ul v-else class="space-y-2">
        <li v-for="row in ready.slice(0, 5)" :key="row.id">
          <RouterLink
            :to="ROUTE_BY_TYPE[row.type]"
            class="block rounded-xl border border-transparent bg-surface px-3 py-2.5 text-center transition hover:border-brand/20 hover:bg-[#e9eefa]"
          >
            <span class="block truncate text-sm font-bold text-ink">{{ nameOf(row) }}</span>
            <span class="mt-1 flex items-center justify-center gap-2 text-xs text-muted">
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                :class="row.type === 'client' ? 'bg-orange-500' : 'bg-indigo-500'"
              >
                {{ row.type === 'client' ? 'Cliente' : 'Smart' }}
              </span>
              <span v-if="row.values.document">{{ maskDocument(String(row.values.document)) }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
      <p v-if="ready.length > 5" class="mt-3 text-center text-xs text-muted">e mais {{ ready.length - 5 }}…</p>
    </section>
  </div>
</template>
