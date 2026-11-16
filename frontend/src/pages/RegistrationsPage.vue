<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PERMISSIONS } from '../auth/permissions';
import { can } from '../auth/session';
import AppButton from '../components/AppButton.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import PageHeader from '../components/PageHeader.vue';
import { isEditableMode } from '../registrations/format';
import RegistrationGrid from '../registrations/RegistrationGrid.vue';
import RegistrationPanel from '../registrations/RegistrationPanel.vue';
import SmartPasteDialog from '../registrations/SmartPasteDialog.vue';
import type { Registration, RegistrationType } from '../registrations/types';
import { useRegistrations } from '../registrations/useRegistrations';

const GROUPS_KEY = 'pre-cadastro:grupos-ocultos';

const {
  schema,
  rows,
  filters,
  loading,
  loadError,
  notice,
  saving,
  notify,
  load,
  save,
  create,
  remove,
  approve,
  unapprove,
} = useRegistrations();

const pasteDialog = ref<InstanceType<typeof SmartPasteDialog>>();
const openId = ref<string | null>(null);
const hiddenGroups = ref<string[]>(readHiddenGroups());

const canEditAny = computed(() => can(PERMISSIONS.REGISTRATIONS_EDIT));
const canApprove = computed(() => can(PERMISSIONS.REGISTRATIONS_APPROVE));
const openRow = computed(() => rows.value.find(({ id }) => id === openId.value) ?? null);

function canEdit(row: Registration) {
  if (row.status === 'approved') return can(PERMISSIONS.REGISTRATIONS_EDIT_APPROVED);
  return canEditAny.value;
}

// Só mostra colunas que alguém precisa preencher no tipo filtrado: campos fixos,
// calculados ou escolhidos no envio ficam só no painel da linha.
const columns = computed(() => {
  if (!schema.value) return [];
  const visible = fillableFields.value.filter((field) => !hiddenGroups.value.includes(field.group));
  const name = schema.value.fields.find(({ key }) => key === 'tradeName')!;
  return [name, ...visible.filter(({ key }) => key !== 'tradeName')];
});

const fillableFields = computed(() => {
  if (!schema.value) return [];
  const types: RegistrationType[] = filters.type ? [filters.type as RegistrationType] : ['client', 'smart'];
  return schema.value.fields.filter((field) => types.some((type) => isEditableMode(field[type])));
});

// Na lista de "Colunas", só os grupos que têm algo para preencher no tipo filtrado.
const groupOptions = computed(() =>
  (schema.value?.groups ?? []).filter((group) => fillableFields.value.some((field) => field.group === group.key)),
);

const counts = computed(() => {
  const result: Record<string, number> = { draft: 0, ready: 0, approved: 0 };
  for (const row of rows.value) result[row.status] += 1;
  return result;
});

function readHiddenGroups(): string[] {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

watch(hiddenGroups, (groups) => {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch {
    // Sem armazenamento local, a preferência vale só nesta visita.
  }
});

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => filters.search,
  () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 300);
  },
);
watch(() => [filters.type, filters.status], load);

async function add(type: RegistrationType) {
  const view = await create(type);
  if (view) openId.value = view.id;
}

async function onSave(row: Registration, changes: { field: string; to: unknown }[]) {
  await save(row, changes);
}

async function onRemove() {
  if (openRow.value && (await remove(openRow.value))) openId.value = null;
}

function openPaste(text = '') {
  if (!canEditAny.value) {
    notify('error', 'Você não tem permissão para criar pré-cadastros');
    return;
  }
  pasteDialog.value?.open(text);
}

async function onCreated(count: number) {
  notify('info', `${count} pré-cadastro(s) criado(s)`);
  await load();
}

onMounted(load);
</script>

<template>
  <PageHeader
    title="Pré-cadastros"
    description="Preencha aos poucos: a linha fica Pronta quando todos os campos obrigatórios estiverem completos, e o Admin global aprova o envio."
  >
    <div v-if="canEditAny" class="flex flex-wrap gap-2">
      <AppButton variant="secondary" @click="openPaste()">Colar da planilha Smart</AppButton>
      <AppButton variant="secondary" @click="add('smart')">Novo Smart</AppButton>
      <AppButton @click="add('client')">Novo Cliente</AppButton>
    </div>
  </PageHeader>

  <ErrorMessage :message="loadError" />

  <div v-if="schema" class="mb-3 flex flex-wrap items-center gap-2 text-sm">
    <div class="inline-flex overflow-hidden rounded-md border border-line bg-white">
      <button
        v-for="option in [{ key: '', label: 'Todos' }, ...schema.types]"
        :key="option.key"
        type="button"
        class="px-3 py-1.5"
        :class="filters.type === option.key ? 'bg-brand text-white' : 'hover:bg-surface'"
        @click="filters.type = option.key"
      >
        {{ option.label }}
      </button>
    </div>

    <select v-model="filters.status" class="rounded-md border border-line bg-white px-2 py-1.5" aria-label="Situação">
      <option value="">Todas as situações</option>
      <option v-for="status in schema.statuses" :key="status.key" :value="status.key">
        {{ status.label }} ({{ counts[status.key] }})
      </option>
    </select>

    <input
      v-model="filters.search"
      type="search"
      placeholder="Buscar nome, CNPJ ou master"
      class="w-64 rounded-md border border-line bg-white px-3 py-1.5 focus:border-brand focus:outline-none"
    />

    <details class="relative">
      <summary class="cursor-pointer list-none rounded-md border border-line bg-white px-3 py-1.5 hover:bg-surface">
        Colunas{{ hiddenGroups.length ? ` (${hiddenGroups.length} oculta${hiddenGroups.length > 1 ? 's' : ''})` : '' }}
      </summary>
      <div class="absolute z-30 mt-1 w-60 rounded-md border border-line bg-white p-2 shadow-lg">
        <label v-for="group in groupOptions" :key="group.key" class="flex items-center gap-2 px-1 py-1">
          <input
            type="checkbox"
            :checked="!hiddenGroups.includes(group.key)"
            @change="
              hiddenGroups = hiddenGroups.includes(group.key)
                ? hiddenGroups.filter((key) => key !== group.key)
                : [...hiddenGroups, group.key]
            "
          />
          {{ group.label }}
        </label>
      </div>
    </details>

    <span class="ml-auto text-muted">
      {{ rows.length }} cadastro(s) · {{ counts.ready }} pronto(s) · {{ counts.approved }} aprovado(s)
      <span v-if="loading"> · carregando…</span>
    </span>
  </div>

  <RegistrationGrid
    v-if="schema"
    :schema="schema"
    :rows="rows"
    :columns="columns"
    :saving="saving"
    :can-edit="canEdit"
    @save="onSave"
    @open="openId = $event.id"
    @smart-paste="openPaste"
    @notify="notify('info', $event)"
  />

  <p v-if="schema" class="mt-2 text-xs text-muted">
    Clique numa célula e digite, ou use Enter para editar. Setas e Tab navegam, Delete apaga, Ctrl+C/Ctrl+V copiam e
    colam blocos como no Excel. Células cinza são fixas ou calculadas; em vermelho, obrigatórias.
  </p>

  <RegistrationPanel
    v-if="schema && openRow"
    :schema="schema"
    :row="openRow"
    :can-edit="canEdit(openRow)"
    :can-approve="canApprove"
    @save="onSave(openRow, $event)"
    @approve="approve(openRow)"
    @unapprove="unapprove(openRow)"
    @remove="onRemove"
    @close="openId = null"
  />

  <SmartPasteDialog v-if="schema" ref="pasteDialog" :schema="schema" @created="onCreated" />

  <div
    v-if="notice"
    role="status"
    class="fixed right-4 bottom-4 z-50 max-w-sm rounded-md px-4 py-3 text-sm text-white shadow-lg"
    :class="notice.kind === 'error' ? 'bg-danger' : 'bg-ink'"
  >
    {{ notice.text }}
  </div>
</template>
