<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '../api/client';
import AppButton from '../components/AppButton.vue';
import FieldEditor from './FieldEditor.vue';
import { cellValue, formatValue, isEditableMode, ruleOf, STATUS_STYLE } from './format';
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

const groups = computed(() =>
  props.schema.groups
    .map((group) => ({
      ...group,
      fields: props.schema.fields.filter(
        (field) => field.group === group.key && ruleOf(field, props.row).mode !== 'hidden',
      ),
    }))
    .filter((group) => group.fields.length),
);

function isRequired(field: SchemaField) {
  const rule = ruleOf(field, props.row);
  return rule.mode === 'required' || (rule.conditional && props.row.missing.includes(field.key));
}

function readonlyText(field: SchemaField) {
  const rule = ruleOf(field, props.row);
  if (rule.mode === 'send') return 'Escolhido no envio para a Mais Envios';
  const text = formatValue(field, cellValue(field, props.row).value);
  return `${text || '—'}${rule.mode === 'fixed' ? ' (fixo)' : rule.mode === 'calc' ? ' (calculado)' : ''}`;
}

function issueOf(key: string) {
  return (
    props.row.errors.find(({ field }) => field === key)?.message ??
    (props.row.missing.includes(key) ? 'Obrigatório' : undefined) ??
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
    <aside class="flex h-full w-full max-w-xl flex-col bg-white shadow-xl" role="dialog" aria-modal="true">
      <header class="border-b border-line p-4">
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2 text-xs text-muted">
              <span class="rounded px-1.5 py-0.5 font-medium" :class="STATUS_STYLE[row.status]">{{ statusLabel }}</span>
              {{ typeLabel }}
              <span v-if="row.approvedBy">· aprovado por {{ row.approvedBy.name }}</span>
            </p>
            <h2 class="mt-1 truncate text-lg font-semibold">
              {{ (row.values.tradeName as string) || 'Sem nome fantasia' }}
            </h2>
          </div>
          <button type="button" class="rounded px-2 text-xl text-muted hover:bg-surface" title="Fechar" @click="emit('close')">
            ×
          </button>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <AppButton v-if="canApprove && row.status === 'ready'" @click="emit('approve')">Aprovar</AppButton>
          <AppButton v-if="canApprove && row.status === 'approved'" variant="secondary" @click="emit('unapprove')">
            Desfazer aprovação
          </AppButton>
          <AppButton v-if="canEdit" variant="secondary" @click="confirmRemove">Excluir</AppButton>
        </div>

        <div v-if="row.missing.length || row.errors.length || row.warnings.length" class="mt-3 space-y-1 text-sm">
          <p v-if="row.missing.length" class="text-danger">
            <strong>Faltam {{ row.missing.length }}:</strong> {{ row.missing.map(label).join(', ') }}
          </p>
          <p v-for="issue in row.errors" :key="`e-${issue.field}`" class="text-danger">
            <strong>{{ label(issue.field) }}:</strong> {{ issue.message }}
          </p>
          <p v-for="issue in row.warnings" :key="`w-${issue.field}-${issue.message}`" class="text-amber-700">
            <strong>Atenção — {{ label(issue.field) }}:</strong> {{ issue.message }}
          </p>
        </div>
        <p v-else class="mt-3 text-sm text-success">Todos os campos obrigatórios estão preenchidos.</p>

        <nav class="mt-4 flex gap-4 text-sm">
          <button
            v-for="item in [
              { key: 'fields', label: 'Campos' },
              { key: 'history', label: 'Histórico' },
            ] as const"
            :key="item.key"
            type="button"
            class="border-b-2 pb-1"
            :class="tab === item.key ? 'border-brand font-medium text-brand' : 'border-transparent text-muted'"
            @click="tab = item.key"
          >
            {{ item.label }}
          </button>
        </nav>
      </header>

      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="tab === 'fields'" class="space-y-6">
          <section v-for="group in groups" :key="group.key">
            <h3 class="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{{ group.label }}</h3>
            <div class="space-y-3">
              <div v-for="field in group.fields" :key="field.key">
                <label class="mb-1 block text-sm font-medium">
                  {{ field.label }}<span v-if="isRequired(field)" class="text-danger"> *</span>
                </label>
                <ServicesEditor
                  v-if="field.input === 'services'"
                  :value="cellValue(field, row).value"
                  :known="schema.services"
                  :readonly="!canEdit || !isEditableMode(ruleOf(field, row))"
                  @save="emit('save', [{ field: field.key, to: $event }])"
                />
                <FieldEditor
                  v-else-if="isEditableMode(ruleOf(field, row))"
                  :field="field"
                  :value="row.values[field.key] ?? null"
                  :disabled="!canEdit"
                  @commit="(to) => commit(field, to)"
                />
                <p v-else class="rounded-md bg-surface px-3 py-1.5 text-sm text-muted">{{ readonlyText(field) }}</p>
                <p v-if="row.suggested[field.key] && row.values[field.key] === null" class="mt-1 text-xs text-muted">
                  Sugestão: {{ formatValue(field, row.suggested[field.key]) }}
                </p>
                <p
                  v-if="issueOf(field.key)"
                  class="mt-1 text-xs"
                  :class="row.warnings.some((w) => w.field === field.key) && !row.missing.includes(field.key) && !row.errors.some((e) => e.field === field.key) ? 'text-amber-700' : 'text-danger'"
                >
                  {{ issueOf(field.key) }}
                </p>
                <p v-else-if="field.hint" class="mt-1 text-xs text-muted">{{ field.hint }}</p>
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
                  <span class="font-medium">{{ key === 'status' ? 'Situação' : key === 'type' ? 'Tipo' : label(String(key)) }}:</span>
                  <template v-if="entry.action === 'update'">
                    {{ historyValue(String(key), change.from) }} → {{ historyValue(String(key), change.to) }}
                  </template>
                  <template v-else>{{ historyValue(String(key), entry.action === 'delete' ? change.from : change.to) }}</template>
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
