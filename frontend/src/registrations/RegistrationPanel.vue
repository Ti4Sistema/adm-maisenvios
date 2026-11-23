<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '../api/client';
import AppButton from '../components/AppButton.vue';
import NavIcon from '../components/NavIcon.vue';
import FieldEditor from './FieldEditor.vue';
import { cellValue, formatValue, isEditableMode, isShown, ruleOf, STATUS_STYLE } from './format';
import ServicesEditor from './ServicesEditor.vue';
import type { FieldValue, Registration, Schema, SchemaField } from './types';

interface HistoryEntry {
  id: string;
  occurredAt: string;
  action: string;
  actorEmail: string | null;
  changes: Record<string, { from: FieldValue; to: FieldValue }> | null;
}

const props = defineProps<{
  schema: Schema;
  row: Registration;
  canEdit: boolean;
  canApprove: boolean;
}>();

const emit = defineEmits<{
  save: [changes: { field: string; to: unknown }[]];
  approve: [];
  unapprove: [];
  hide: [hidden: boolean];
  remove: [];
  close: [];
}>();

const tab = ref<'fields' | 'history'>('fields');
const history = ref<HistoryEntry[]>([]);
const historyError = ref('');
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const fieldsByKey = computed(() => new Map(props.schema.fields.map((field) => [field.key, field])));
const label = (key: string) => fieldsByKey.value.get(key)?.label ?? key;
const statusLabel = computed(() => props.schema.statuses.find(({ key }) => key === props.row.status)?.label);
const typeLabel = computed(() => props.schema.types.find(({ key }) => key === props.row.type)?.label);

// Campos pouco usados ficam atrás de um botão "+", a não ser que já tenham valor.
const openRare = ref(new Set<string>());
watch(
  () => props.row.id,
  () => {
    openRare.value = new Set();
    openStandard.value = new Set();
    editingAddress.value = new Set();
  },
);

// Campos com valor padrão (WhatsApp = Sim, Beneficiário etc.): enquanto estiverem
// no padrão, ficam no resumo compacto junto dos fixos; clicar abre para alterar.
// Ficam de fora as escolhas que mudam o cadastro (tipo, coleta, malha, serviços).
// Endereço principal e de coleta já completos (vêm da ficha) aparecem como texto;
// "Editar" abre os campos daquele endereço.
const editingAddress = ref(new Set<string>());
const ADDRESS_PREFIX: Record<string, 'main' | 'pickup'> = { mainAddress: 'main', pickupAddress: 'pickup' };
const ADDRESS_SUFFIXES = ['Zip', 'Street', 'Number', 'Complement', 'District', 'City', 'State'];

function showsAddressText(groupKey: string) {
  const prefix = ADDRESS_PREFIX[groupKey];
  if (!prefix || editingAddress.value.has(groupKey)) return false;
  if (prefix === 'pickup' && props.row.values.hasPickupAddress !== true) return false;
  const value = (suffix: string) => props.row.values[`${prefix}${suffix}`];
  const hasIssue = ADDRESS_SUFFIXES.map((suffix) => `${prefix}${suffix}`).some(
    (key) => props.row.missing.includes(key) || props.row.errors.some(({ field }) => field === key),
  );
  return !hasIssue && Boolean(value('Zip') && value('Street') && value('City'));
}

function addressText(groupKey: string) {
  const prefix = ADDRESS_PREFIX[groupKey];
  const value = (suffix: string) => (props.row.values[`${prefix}${suffix}`] as string | null) || '';
  const zipField = fieldsByKey.value.get(`${prefix}Zip`);
  const zip = zipField ? formatValue(zipField, props.row.values[`${prefix}Zip`] ?? null) : value('Zip');
  const street = [value('Street'), value('Number')].filter(Boolean).join(', ');
  const complement = value('Complement');
  const place = [value('City'), value('State')].filter(Boolean).join('/');
  return [complement ? `${street} – ${complement}` : street, value('District'), place, zip && `CEP ${zip}`]
    .filter(Boolean)
    .join(' · ');
}

function editAddress(groupKey: string) {
  editingAddress.value = new Set([...editingAddress.value, groupKey]);
  const prefix = ADDRESS_PREFIX[groupKey];
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`#field-${prefix}Zip input`)?.focus());
}

function finishAddress(groupKey: string) {
  editingAddress.value = new Set([...editingAddress.value].filter((key) => key !== groupKey));
}

const KEEP_VISIBLE = ['customerType', 'billingType', 'hasPickupAddress', 'usesMalha', 'services'];
const openStandard = ref(new Set<string>());

// Campo que dá para alterar no painel: os editáveis e também os fixos (que já vêm
// com o valor da regra, mas podem ser trocados quando preciso).
function canChange(field: SchemaField) {
  const rule = ruleOf(field, props.row);
  return isEditableMode(rule) || rule.mode === 'fixed';
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Fica no resumo compacto (com o lápis para alterar) enquanto estiver no valor da regra.
function isStandard(field: SchemaField) {
  const rule = ruleOf(field, props.row);
  if (openStandard.value.has(field.key) || issueOf(field.key)) return false;
  const stored = props.row.values[field.key] ?? null;
  if (rule.mode === 'fixed') return stored === null || sameValue(stored, rule.value);
  return (
    rule.default !== undefined && rule.default !== null && !KEEP_VISIBLE.includes(field.key) && stored === rule.default
  );
}

// Valor que o editor mostra: no fixo, o da regra enquanto ninguém alterou.
function editorValue(field: SchemaField) {
  return ruleOf(field, props.row).mode === 'fixed'
    ? cellValue(field, props.row).value
    : (props.row.values[field.key] ?? null);
}

function openStandardField(key: string) {
  openStandard.value = new Set([...openStandard.value, key]);
  requestAnimationFrame(() => {
    document.getElementById(`field-${key}`)?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  });
}

const groups = computed(() =>
  props.schema.groups
    .map((group) => {
      const all = props.schema.fields.filter(
        (field) => field.group === group.key && ruleOf(field, props.row).mode !== 'hidden' && isShown(field, props.row),
      );
      const collapsed = all.filter(
        (field) => field.rare && props.row.values[field.key] == null && !openRare.value.has(group.key),
      );
      const visible = all.filter((field) => !collapsed.includes(field));
      // Fixos e com valor padrão ficam num resumo compacto (lápis para alterar); calculados e
      // escolhidos no envio também, só para leitura.
      const editable = visible.filter((field) => canChange(field) || field.input === 'services');
      const fixed = visible.filter((field) => !editable.includes(field));
      const standard = props.canEdit ? editable.filter(isStandard) : [];
      const fields = editable.filter((field) => !standard.includes(field));
      // Ordem de leitura do painel (ex.: CEP, Rua, Número, Complemento / Bairro, Cidade, UF).
      fields.sort((a, b) => panelOrder(a.key) - panelOrder(b.key));
      return { ...group, fields, standard, fixed, collapsed };
    })
    .filter((group) => group.fields.length || group.standard.length || group.fixed.length || group.collapsed.length),
);

const MAIN_ORDER = ['tradeName', 'legalName', 'customerType', 'document', 'masterLicense'];
const ADDRESS_ORDER = ['Zip', 'Street', 'Number', 'Complement', 'District', 'City', 'State'];
function panelOrder(key: string) {
  if (MAIN_ORDER.includes(key)) return MAIN_ORDER.indexOf(key);
  const index = ADDRESS_ORDER.findIndex((suffix) => /^(main|pickup)/.test(key) && key.endsWith(suffix));
  return index < 0 ? -1 : index;
}

// Seções do painel: juntam grupos do mesmo assunto e viram os atalhos (âncoras) do topo.
const SECTIONS = [
  { key: 'company', label: 'Empresa', groups: ['main', 'fiscal'] },
  { key: 'address', label: 'Endereços', groups: ['mainAddress', 'pickupAddress'] },
  { key: 'billing', label: 'Financeiro', groups: ['billing', 'contract'] },
  { key: 'services', label: 'Serviços e malha', groups: ['services', 'malha'] },
  { key: 'contacts', label: 'Contatos e acesso', groups: ['contacts', 'portal', 'notes'] },
];

const sections = computed(() => {
  const known = SECTIONS.flatMap((section) => section.groups);
  const others = {
    key: 'others',
    label: 'Outros',
    groups: groups.value.map((g) => g.key).filter((k) => !known.includes(k)),
  };
  return [...SECTIONS, others]
    .map((section) => {
      const list = groups.value.filter((group) => section.groups.includes(group.key));
      return { ...section, groups: list };
    })
    .filter((section) => section.groups.length);
});

const scroller = ref<HTMLElement | null>(null);
const activeSection = ref('company');

function goTo(id: string, focus = false) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (focus) target.querySelector<HTMLElement>('input, select, textarea, button')?.focus({ preventScroll: true });
}

// Clicar numa seção volta para os campos (se estava no histórico) e rola até ela.
function openSection(key: string) {
  tab.value = 'fields';
  activeSection.value = key;
  pinnedUntil = Date.now() + 1000;
  requestAnimationFrame(() => goTo(`section-${key}`));
}

// Marca no topo a seção que está na tela.
// Logo depois de clicar num atalho, vale a seção clicada (as do fim não chegam ao topo).
let pinnedUntil = 0;

function onScroll() {
  if (!scroller.value || Date.now() < pinnedUntil) return;
  const { scrollTop, scrollHeight, clientHeight } = scroller.value;
  const top = scroller.value.getBoundingClientRect().top + 80;
  let current = sections.value[0]?.key ?? '';
  for (const section of sections.value) {
    const element = document.getElementById(`section-${section.key}`);
    if (element && element.getBoundingClientRect().top <= top) current = section.key;
  }
  // No fim da tela, a última seção é a que está à vista.
  if (scrollTop + clientHeight >= scrollHeight - 4) current = sections.value[sections.value.length - 1]?.key ?? current;
  activeSection.value = current;
}

function openGroupExtras(key: string) {
  openRare.value = new Set([...openRare.value, key]);
}

// Largura de cada campo numa grade de 12 colunas, pelo tamanho do que cabe nele.
// Um número vale para todas as telas; um par é [telas médias, telas grandes].
// Ex.: Nome Fantasia tem no máximo 30 letras e o CNPJ tem tamanho fixo, então ficam
// estreitos e cabem na mesma linha que Razão Social e Tipo Cliente.
type Span = number | [number, number];
const SPAN_BY_KEY: Record<string, Span> = {
  tradeName: [4, 3],
  legalName: [3, 5],
  customerType: 2,
  document: [3, 2],
  packageTable: 5,
  reverseTable: 4,
  creditLimit: 3,
  mainZip: 2,
  pickupZip: 2,
  mainStreet: 6,
  pickupStreet: 6,
  mainNumber: 2,
  pickupNumber: 2,
  mainComplement: 2,
  pickupComplement: 2,
  mainDistrict: 4,
  pickupDistrict: 4,
  mainCity: 6,
  pickupCity: 6,
  mainState: 2,
  pickupState: 2,
  contactName: 4,
  website: 4,
  stateRegistration: 4,
  municipalRegistration: 4,
};
const SPAN_BY_INPUT: Record<string, Span> = {
  integer: 2,
  percent: 2,
  services: 12,
  longtext: 12,
  text: 6,
};
// Classes escritas por extenso para o Tailwind encontrar.
const SM_SPAN = [
  '',
  'sm:col-span-1',
  'sm:col-span-2',
  'sm:col-span-3',
  'sm:col-span-4',
  'sm:col-span-5',
  'sm:col-span-6',
  'sm:col-span-7',
  'sm:col-span-8',
  'sm:col-span-9',
  'sm:col-span-10',
  'sm:col-span-11',
  'sm:col-span-12',
];
const XL_SPAN = [
  '',
  'xl:col-span-1',
  'xl:col-span-2',
  'xl:col-span-3',
  'xl:col-span-4',
  'xl:col-span-5',
  'xl:col-span-6',
  'xl:col-span-7',
  'xl:col-span-8',
  'xl:col-span-9',
  'xl:col-span-10',
  'xl:col-span-11',
  'xl:col-span-12',
];
function spanClass(field: SchemaField) {
  const span = SPAN_BY_KEY[field.key] ?? SPAN_BY_INPUT[field.input] ?? 4;
  const [medium, large] = Array.isArray(span) ? span : [span, span];
  return `${SM_SPAN[medium]} ${XL_SPAN[large]}`;
}

function isRequired(field: SchemaField) {
  const rule = ruleOf(field, props.row);
  return rule.mode === 'required' || (rule.conditional && props.row.missing.includes(field.key));
}

function readonlyText(field: SchemaField) {
  const rule = ruleOf(field, props.row);
  if (rule.mode === 'send') return 'Escolhido no envio para a Mais Envios';
  const text = formatValue(field, cellValue(field, props.row).value);
  return `${text || '—'}${rule.mode === 'calc' ? ' (calculado)' : ''}`;
}

function issueOf(key: string) {
  return (
    props.row.errors.find(({ field }) => field === key)?.message ??
    props.row.warnings.find(({ field }) => field === key)?.message
  );
}

function commit(field: SchemaField, to: unknown) {
  if (to !== undefined) emit('save', [{ field: field.key, to }]);
}

async function loadHistory() {
  historyError.value = '';
  try {
    history.value = await api<HistoryEntry[]>(`/registrations/${props.row.id}/history`);
  } catch (cause) {
    historyError.value = (cause as Error).message;
  }
}

function historyValue(key: string, value: FieldValue) {
  const field = fieldsByKey.value.get(key);
  if (value === null || value === '') return 'vazio';
  if (key === 'type') return props.schema.types.find((type) => type.key === value)?.label ?? String(value);
  if (key === 'status') return props.schema.statuses.find((status) => status.key === value)?.label ?? String(value);
  if (key === 'hiddenAt') return value ? 'oculto' : 'na lista';
  return field ? formatValue(field, value) || 'vazio' : String(value);
}

const HISTORY_ACTIONS: Record<string, string> = { create: 'Criou', update: 'Alterou', delete: 'Excluiu' };
const HIDDEN_HISTORY = ['approvedById', 'createdById', 'approvedAt'];

watch(
  () => [props.row.id, props.row.updatedAt, tab.value],
  () => tab.value === 'history' && loadHistory(),
  { immediate: true },
);

function confirmRemove() {
  if (window.confirm('Excluir este pré-cadastro? A exclusão fica registrada na auditoria.')) emit('remove');
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')" @keydown.esc="emit('close')">
    <aside
      class="flex h-full w-full flex-col bg-white shadow-xl md:max-w-3xl xl:max-w-5xl"
      role="dialog"
      aria-modal="true"
    >
      <!-- Cabeçalho enxuto: uma linha com nome e ações, outra com as seções. -->
      <header class="border-b border-line px-4 pt-2.5 sm:px-6">
        <div class="flex items-center gap-2">
          <span
            class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
            :class="STATUS_STYLE[row.status]"
            :title="`${typeLabel}${row.approvedBy ? ` · aprovado por ${row.approvedBy.name}` : ''}${row.hiddenAt ? ' · oculto' : ''}`"
          >
            {{ statusLabel }}
          </span>
          <h2 class="min-w-0 flex-1 truncate text-base font-semibold">
            {{ (row.values.tradeName as string) || 'Sem nome fantasia' }}
          </h2>
          <AppButton v-if="canApprove && row.status === 'ready'" class="!px-3 !py-1 !text-xs" @click="emit('approve')">
            Aprovar
          </AppButton>
          <button
            v-if="canApprove && row.status === 'approved'"
            type="button"
            class="shrink-0 rounded px-2 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-ink"
            @click="emit('unapprove')"
          >
            Desfazer aprovação
          </button>
          <button
            v-if="canEdit"
            type="button"
            class="rounded p-1.5 text-muted hover:bg-surface hover:text-ink"
            :title="row.hiddenAt ? 'Mostrar de novo na lista' : 'Ocultar da lista'"
            :aria-label="row.hiddenAt ? 'Mostrar de novo na lista' : 'Ocultar da lista'"
            @click="emit('hide', !row.hiddenAt)"
          >
            <NavIcon :name="row.hiddenAt ? 'show' : 'hide'" class="!h-4 !w-4" />
          </button>
          <button
            v-if="canEdit"
            type="button"
            class="rounded p-1.5 text-muted hover:bg-red-50 hover:text-danger"
            title="Excluir"
            aria-label="Excluir"
            @click="confirmRemove"
          >
            <NavIcon name="trash" class="!h-4 !w-4" />
          </button>
          <button
            type="button"
            class="rounded p-1.5 text-muted hover:bg-surface hover:text-ink"
            title="Fechar"
            aria-label="Fechar"
            @click="emit('close')"
          >
            <NavIcon name="close" class="!h-4 !w-4" />
          </button>
        </div>

        <!-- Atalhos das seções; o Histórico fica no fim da mesma linha. -->
        <nav class="-mx-4 flex gap-1 overflow-x-auto px-4 py-2 sm:-mx-6 sm:px-6" aria-label="Seções">
          <button
            v-for="section in sections"
            :key="section.key"
            type="button"
            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
            :class="
              tab === 'fields' && activeSection === section.key
                ? 'bg-ink text-white'
                : 'text-muted hover:bg-surface hover:text-ink'
            "
            @click="openSection(section.key)"
          >
            {{ section.label }}
          </button>
          <span class="flex-1" />
          <button
            type="button"
            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
            :class="tab === 'history' ? 'bg-ink text-white' : 'text-muted hover:bg-surface hover:text-ink'"
            @click="tab = tab === 'history' ? 'fields' : 'history'"
          >
            Histórico
          </button>
        </nav>
      </header>

      <div ref="scroller" class="flex-1 overflow-y-auto px-4 py-3 sm:px-6" @scroll.passive="onScroll">
        <div v-if="tab === 'fields'" class="space-y-6">
          <section v-for="section in sections" :id="`section-${section.key}`" :key="section.key" class="scroll-mt-4">
            <!-- Títulos das seções em destaque (faixa azul com barra laranja) para achar rápido cada parte. -->
            <h3
              class="mb-3 flex items-center gap-2 rounded-lg border-l-4 border-accent bg-brand/10 px-3 py-2 text-base font-bold text-brand"
            >
              {{ section.label }}
            </h3>
            <div class="space-y-4">
              <div v-for="group in section.groups" :key="group.key">
                <!-- Grupo só com resumo (ex.: dados fiscais) não leva título: sobe junto do anterior. -->
                <h4
                  v-if="(section.groups.length > 1 || ADDRESS_PREFIX[group.key]) && group.fields.length"
                  class="mb-2 flex items-center gap-2 text-[13px] font-bold tracking-wide text-brand-dark uppercase"
                >
                  <span class="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  {{ group.label }}
                  <button
                    v-if="
                      ADDRESS_PREFIX[group.key] &&
                      canEdit &&
                      (editingAddress.has(group.key) || showsAddressText(group.key))
                    "
                    type="button"
                    class="text-xs font-medium tracking-normal text-brand normal-case hover:underline"
                    @click="editingAddress.has(group.key) ? finishAddress(group.key) : editAddress(group.key)"
                  >
                    {{ editingAddress.has(group.key) ? 'Concluir' : 'Editar' }}
                  </button>
                </h4>
                <p v-if="showsAddressText(group.key)" class="text-sm">{{ addressText(group.key) }}</p>
                <div v-else class="grid grid-flow-row-dense gap-x-3 gap-y-3 sm:grid-cols-12">
                  <div
                    v-for="field in group.fields"
                    :id="`field-${field.key}`"
                    :key="field.key"
                    class="scroll-mt-4"
                    :class="spanClass(field)"
                  >
                    <label
                      class="mb-1 block truncate text-sm font-medium"
                      :class="row.missing.includes(field.key) ? 'text-danger' : ''"
                      :title="field.hint ?? field.label"
                    >
                      {{ field.label }}<span v-if="isRequired(field)" class="text-danger"> *</span>
                    </label>
                    <ServicesEditor
                      v-if="field.input === 'services'"
                      :value="cellValue(field, row).value"
                      :known="schema.services"
                      :locked="schema.fixedServices[row.type]"
                      :no-spread="schema.noSpreadServices"
                      :malha-codes="schema.malhaServices"
                      :readonly="!canEdit || !canChange(field)"
                      @save="emit('save', [{ field: field.key, to: $event }])"
                    />
                    <FieldEditor
                      v-else-if="canChange(field)"
                      :field="field"
                      :value="editorValue(field)"
                      :disabled="!canEdit"
                      @commit="(to) => commit(field, to)"
                    />
                    <p v-else class="rounded-md bg-surface px-3 py-1.5 text-sm text-muted">
                      {{ readonlyText(field) }}
                    </p>
                    <p
                      v-if="
                        row.suggested[field.key] && row.values[field.key] === null && isEditableMode(ruleOf(field, row))
                      "
                      class="mt-1 text-xs text-muted"
                    >
                      Sugestão:
                      {{ formatValue(field, row.suggested[field.key]) }}
                    </p>
                    <p
                      v-if="issueOf(field.key)"
                      class="mt-1 text-xs"
                      :class="
                        row.warnings.some((w) => w.field === field.key) &&
                        !row.missing.includes(field.key) &&
                        !row.errors.some((e) => e.field === field.key)
                          ? 'text-amber-700'
                          : 'text-danger'
                      "
                    >
                      {{ issueOf(field.key) }}
                    </p>
                  </div>
                  <button
                    v-if="group.collapsed.length"
                    type="button"
                    class="self-start text-left text-sm font-medium text-brand hover:underline sm:col-span-12"
                    @click="openGroupExtras(group.key)"
                  >
                    +
                    {{ group.collapsed.map((field) => field.label).join(', ') }}
                  </button>
                </div>
                <!-- Resumo compacto: fixos e padrões (lápis para alterar) e calculados (só leitura). -->
                <dl
                  v-if="group.standard.length || group.fixed.length"
                  class="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-md bg-surface px-3 py-2 text-xs"
                >
                  <div
                    v-for="field in group.standard"
                    :id="`field-${field.key}`"
                    :key="field.key"
                    class="max-w-full min-w-0"
                  >
                    <button
                      type="button"
                      class="group/std flex max-w-full min-w-0 items-center gap-1 rounded text-left hover:text-brand"
                      :title="`Clique para alterar ${field.label}`"
                      @click="openStandardField(field.key)"
                    >
                      <dt class="shrink-0 text-muted group-hover/std:text-brand">{{ field.label }}:</dt>
                      <dd class="truncate">{{ formatValue(field, cellValue(field, row).value) || '—' }}</dd>
                      <NavIcon
                        name="edit"
                        class="!h-3.5 !w-3.5 shrink-0 text-muted opacity-60 group-hover/std:text-brand group-hover/std:opacity-100"
                      />
                    </button>
                  </div>
                  <div
                    v-for="field in group.fixed"
                    :id="`field-${field.key}`"
                    :key="field.key"
                    class="flex max-w-full min-w-0 gap-1"
                  >
                    <dt class="shrink-0 text-muted">{{ field.label }}:</dt>
                    <dd class="truncate" :title="readonlyText(field)">
                      {{ readonlyText(field) }}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        </div>

        <div v-else class="space-y-4 text-sm">
          <p v-if="historyError" class="text-danger">{{ historyError }}</p>
          <article v-for="entry in history" :key="entry.id" class="border-b border-line pb-3">
            <p class="text-xs text-muted">
              {{ dateFormat.format(new Date(entry.occurredAt)) }} · {{ entry.actorEmail ?? 'Sistema' }} ·
              {{ HISTORY_ACTIONS[entry.action] ?? entry.action }}
            </p>
            <ul class="mt-1 space-y-0.5">
              <template v-for="(change, key) in entry.changes ?? {}" :key="key">
                <li v-if="!HIDDEN_HISTORY.includes(String(key)) && (entry.action !== 'create' || change.to !== null)">
                  <span class="font-medium"
                    >{{
                      key === 'status'
                        ? 'Situação'
                        : key === 'type'
                          ? 'Tipo'
                          : key === 'hiddenAt'
                            ? 'Visibilidade'
                            : label(String(key))
                    }}:</span
                  >
                  <template v-if="entry.action === 'update'">
                    {{ historyValue(String(key), change.from) }} →
                    {{ historyValue(String(key), change.to) }}
                  </template>
                  <template v-else>{{
                    historyValue(String(key), entry.action === 'delete' ? change.from : change.to)
                  }}</template>
                </li>
              </template>
            </ul>
          </article>
          <p v-if="!history.length && !historyError" class="text-muted">Sem alterações registradas.</p>
        </div>
      </div>
    </aside>
  </div>
</template>
