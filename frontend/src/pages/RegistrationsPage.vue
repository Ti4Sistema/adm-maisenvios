<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PERMISSIONS } from '../auth/permissions';
import { can } from '../auth/session';
import AppButton from '../components/AppButton.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import PageHeader from '../components/PageHeader.vue';
import ClientPasteDialog from '../registrations/ClientPasteDialog.vue';
import RegistrationCards from '../registrations/RegistrationCards.vue';
import RegistrationGrid from '../registrations/RegistrationGrid.vue';
import RegistrationPanel from '../registrations/RegistrationPanel.vue';
import SmartPasteDialog from '../registrations/SmartPasteDialog.vue';
import type { Registration, RegistrationType } from '../registrations/types';
import { useRegistrations } from '../registrations/useRegistrations';

// Clientes e Smart têm páginas próprias no menu; o tipo vem da rota.
const props = defineProps<{ type: RegistrationType }>();

const {
  schema,
  rows,
  filters,
  hiddenCount,
  loading,
  loadError,
  notice,
  saving,
  notify,
  load,
  save,
  create,
  remove,
  setHidden,
  approve,
  unapprove,
} = useRegistrations();
filters.type = props.type;

const pasteDialog = ref<InstanceType<typeof SmartPasteDialog>>();
const clientDialog = ref<InstanceType<typeof ClientPasteDialog>>();
const openId = ref<string | null>(null);

const canEditAny = computed(() => can(PERMISSIONS.REGISTRATIONS_EDIT));
const canApprove = computed(() => can(PERMISSIONS.REGISTRATIONS_APPROVE));
const openRow = computed(() => rows.value.find(({ id }) => id === openId.value) ?? null);

function canEdit(row: Registration) {
  if (row.status === 'approved') return can(PERMISSIONS.REGISTRATIONS_EDIT_APPROVED);
  return canEditAny.value;
}

// A lista mostra só o essencial; o resto se vê e se preenche clicando na linha.
const COLUMN_KEYS = ['tradeName', 'legalName', 'document', 'adminLogin'];
const columns = computed(() => {
  if (!schema.value) return [];
  const byKey = new Map(schema.value.fields.map((field) => [field.key, field]));
  return COLUMN_KEYS.map((key) => byKey.get(key)).filter((field) => field !== undefined);
});

const counts = computed(() => {
  const result: Record<string, number> = { draft: 0, ready: 0, approved: 0 };
  for (const row of rows.value) result[row.status] += 1;
  return result;
});

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => filters.search,
  () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 300);
  },
);
watch(() => [filters.type, filters.status, filters.hidden], load);
const showingHidden = computed(() => filters.hidden === 'true');

// Trocar entre Clientes e Smart no menu reaproveita esta página.
watch(
  () => props.type,
  (type) => {
    openId.value = null;
    filters.hidden = '';
    filters.type = type;
  },
);

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

function confirmRemove(row: Registration) {
  const name = (row.values.tradeName as string) || (row.values.legalName as string) || 'este pré-cadastro';
  if (window.confirm(`Excluir "${name}"? A exclusão não pode ser desfeita (fica só o registro na auditoria).`)) {
    remove(row);
  }
}

async function onHide(row: Registration, hidden: boolean) {
  if ((await setHidden(row, hidden)) && openId.value === row.id) openId.value = null;
}

function openPaste(text = '') {
  if (props.type !== 'smart') {
    notify('error', 'Para colar linhas da planilha Smart, abra Pré-cadastros › Smart no menu');
    return;
  }
  if (!canEditAny.value) {
    notify('error', 'Você não tem permissão para criar pré-cadastros');
    return;
  }
  pasteDialog.value?.open(text);
}

function openClientPaste(text = '') {
  if (props.type !== 'client') {
    notify('error', 'Para colar a ficha de um cliente, abra Pré-cadastros › Clientes no menu');
    return;
  }
  if (!canEditAny.value) {
    notify('error', 'Você não tem permissão para criar pré-cadastros');
    return;
  }
  clientDialog.value?.open(text);
}

// Depois de criar pela ficha, abre o painel para completar o que falta.
async function onClientCreated(id: string) {
  notify('info', 'Pré-cadastro criado a partir da ficha');
  await load();
  openId.value = id;
}

async function onCreated(count: number) {
  notify('info', `${count} pré-cadastro(s) criado(s)`);
  await load();
}

onMounted(load);
</script>

<template>
  <PageHeader
    :title="type === 'smart' ? 'Pré-cadastros Smart' : 'Pré-cadastros de clientes'"
    description="Preencha aos poucos: a linha fica Pronta quando todos os campos obrigatórios estiverem completos, e o Admin global aprova o envio."
  >
    <div v-if="canEditAny" class="flex flex-wrap gap-2">
      <template v-if="type === 'smart'">
        <AppButton variant="secondary" @click="openPaste()">Colar da planilha</AppButton>
        <AppButton @click="add('smart')">Novo Smart</AppButton>
      </template>
      <template v-else>
        <AppButton variant="secondary" @click="openClientPaste()">Colar ficha</AppButton>
        <AppButton @click="add('client')">Novo Cliente</AppButton>
      </template>
    </div>
  </PageHeader>

  <ErrorMessage :message="loadError" />

  <section v-if="schema" class="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 md:p-4">
    <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <select v-model="filters.status" class="rounded-lg border border-line bg-white px-2 py-1.5" aria-label="Situação">
        <option value="">Todas as situações</option>
        <option v-for="status in schema.statuses" :key="status.key" :value="status.key">
          {{ status.label }} ({{ counts[status.key] }})
        </option>
      </select>

      <input
        v-model="filters.search"
        type="search"
        :placeholder="type === 'smart' ? 'Buscar nome, CNPJ ou master' : 'Buscar nome ou CPF/CNPJ'"
        class="w-full rounded-lg border border-line bg-surface sm:w-64 px-3 py-1.5 focus:border-brand focus:bg-white focus:outline-none"
      />

      <span class="ml-auto text-muted">
        {{ rows.length }} cadastro(s) · {{ counts.ready }} pronto(s) · {{ counts.approved }} aprovado(s)
        <span v-if="loading"> · carregando…</span>
        <!-- Link discreto para a lista dos ocultados. -->
        <button
          v-if="!showingHidden && hiddenCount > 0"
          type="button"
          class="ml-2 text-xs text-muted underline decoration-dotted hover:text-ink"
          @click="filters.hidden = 'true'"
        >
          Ocultos ({{ hiddenCount }})
        </button>
      </span>
    </div>

    <div
      v-if="showingHidden"
      class="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
    >
      <span>
        <strong>Pré-cadastros ocultos.</strong> Eles não aparecem na lista principal. Passe o mouse na linha para
        mostrar de novo ou excluir.
      </span>
      <button type="button" class="ml-auto font-medium text-brand hover:underline" @click="filters.hidden = ''">
        Voltar para a lista
      </button>
    </div>

    <!-- No celular, cartões no lugar da grade. -->
    <RegistrationCards v-if="schema" class="md:hidden" :schema="schema" :rows="rows" @open="openId = $event.id" />

    <RegistrationGrid
      v-if="schema"
      :key="type"
      class="hidden md:block"
      :schema="schema"
      :rows="rows"
      :columns="columns"
      :saving="saving"
      :can-edit="canEdit"
      @save="onSave"
      @open="openId = $event.id"
      @hide="onHide"
      @remove="confirmRemove"
      @smart-paste="openPaste"
      @form-paste="openClientPaste"
      @notify="notify('info', $event)"
    />

    <p class="mt-2 hidden text-xs text-muted md:block">
      Clique na situação de uma linha para ver e preencher todos os dados do cadastro. Nas células, dá para digitar
      direto ou colar com Ctrl+V, como no Excel.
    </p>
  </section>

  <RegistrationPanel
    v-if="schema && openRow"
    :schema="schema"
    :row="openRow"
    :can-edit="canEdit(openRow)"
    :can-approve="canApprove"
    @save="onSave(openRow, $event)"
    @approve="approve(openRow)"
    @unapprove="unapprove(openRow)"
    @hide="onHide(openRow, $event)"
    @remove="onRemove"
    @close="openId = null"
  />

  <SmartPasteDialog v-if="schema" ref="pasteDialog" :schema="schema" @created="onCreated" />
  <ClientPasteDialog v-if="schema" ref="clientDialog" :schema="schema" @created="onClientCreated" />

  <div
    v-if="notice"
    role="status"
    class="fixed right-4 bottom-4 z-50 max-w-sm rounded-md px-4 py-3 text-sm text-white shadow-lg"
    :class="notice.kind === 'error' ? 'bg-danger' : 'bg-ink'"
  >
    {{ notice.text }}
  </div>
</template>
