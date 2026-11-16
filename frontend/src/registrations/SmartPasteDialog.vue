<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '../api/client';
import AppButton from '../components/AppButton.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import { formatValue, parseTsv, STATUS_STYLE } from './format';
import type { FieldValue, Issue, Schema } from './types';

interface PreviewItem {
  line: number;
  skipped?: string;
  status?: string;
  values?: Record<string, FieldValue>;
  missing?: string[];
  errors?: Issue[];
  warnings: string[];
}

const props = defineProps<{ schema: Schema }>();
const emit = defineEmits<{ created: [count: number] }>();

const dialog = ref<HTMLDialogElement>();
const text = ref('');
const rows = ref<{ line: number; cells: string[] }[]>([]);
const preview = ref<PreviewItem[]>([]);
const chosen = ref(new Set<number>());
const error = ref('');
const loading = ref(false);

const label = (key: string) => props.schema.fields.find((field) => field.key === key)?.label ?? key;
const field = (key: string) => props.schema.fields.find((item) => item.key === key)!;
const statusLabel = (key?: string) => props.schema.statuses.find((status) => status.key === key)?.label;
const importable = computed(() => preview.value.filter((item) => !item.skipped));

async function analyze(source: string) {
  text.value = source;
  error.value = '';
  rows.value = parseTsv(source).map((cells, index) => ({ line: index + 1, cells }));
  preview.value = [];
  if (!rows.value.length) return;
  loading.value = true;
  try {
    const result = await api<{ items: PreviewItem[] }>('/registrations/import/smart', {
      method: 'POST',
      body: { rows: rows.value, dryRun: true },
    });
    preview.value = result.items;
    // Possíveis duplicados começam desmarcados.
    chosen.value = new Set(
      result.items
        .filter((item) => !item.skipped && !item.warnings.some((w) => /Já existe|repetido/.test(w)))
        .map((item) => item.line),
    );
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    loading.value = false;
  }
}

function onPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData('text/plain');
  if (!pasted) return;
  event.preventDefault();
  analyze(pasted);
}

function toggle(line: number) {
  const next = new Set(chosen.value);
  if (next.has(line)) next.delete(line);
  else next.add(line);
  chosen.value = next;
}

async function confirm() {
  loading.value = true;
  error.value = '';
  try {
    const result = await api<{ created: number }>('/registrations/import/smart', {
      method: 'POST',
      body: { rows: rows.value.filter((row) => chosen.value.has(row.line)), dryRun: false },
    });
    dialog.value?.close();
    emit('created', result.created);
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    loading.value = false;
  }
}

function open(initial = '') {
  text.value = '';
  rows.value = [];
  preview.value = [];
  error.value = '';
  dialog.value?.showModal();
  if (initial) analyze(initial);
}

defineExpose({ open });
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[calc(100%-2rem)] max-w-5xl rounded-lg border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-black/40"
  >
    <div class="space-y-4 p-6">
      <div>
        <h2 class="text-lg font-semibold">Colar linhas da planilha Smart</h2>
        <p class="mt-1 text-sm text-muted">
          Na planilha, selecione as linhas inteiras (da coluna A até a Z), copie e cole aqui com Ctrl+V. Cada linha vira
          um pré-cadastro Smart; o que faltar pode ser completado depois na grade.
        </p>
      </div>

      <ErrorMessage :message="error" />

      <textarea
        v-if="!preview.length"
        :value="text"
        rows="6"
        placeholder="Cole aqui (Ctrl+V)"
        class="w-full rounded-md border border-line px-3 py-2 font-mono text-xs focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
        @paste="onPaste"
      />

      <p v-if="loading" class="text-sm text-muted">Analisando…</p>

      <div v-if="preview.length" class="max-h-[55vh] overflow-auto rounded-md border border-line">
        <table class="w-full text-left text-sm">
          <thead class="sticky top-0 bg-surface text-xs text-muted">
            <tr>
              <th class="w-8 px-2 py-2" />
              <th class="px-2 py-2 font-medium">Linha</th>
              <th class="px-2 py-2 font-medium">Nome Fantasia</th>
              <th class="px-2 py-2 font-medium">CNPJ</th>
              <th class="px-2 py-2 font-medium">Master</th>
              <th class="px-2 py-2 font-medium">Endereço</th>
              <th class="px-2 py-2 font-medium">Situação</th>
              <th class="px-2 py-2 font-medium">Pendências e avisos</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="item in preview" :key="item.line" :class="{ 'text-muted': item.skipped }">
              <td class="px-2 py-2 align-top">
                <input
                  v-if="!item.skipped"
                  type="checkbox"
                  :checked="chosen.has(item.line)"
                  :aria-label="`Importar linha ${item.line}`"
                  @change="toggle(item.line)"
                />
              </td>
              <td class="px-2 py-2 align-top">{{ item.line }}</td>
              <template v-if="item.skipped">
                <td colspan="6" class="px-2 py-2 align-top">Ignorada: {{ item.skipped }}</td>
              </template>
              <template v-else>
                <td class="px-2 py-2 align-top font-medium">{{ item.values?.tradeName }}</td>
                <td class="px-2 py-2 align-top whitespace-nowrap">
                  {{ formatValue(field('document'), item.values?.document ?? null) }}
                </td>
                <td class="px-2 py-2 align-top">{{ item.values?.masterLicense }}</td>
                <td class="px-2 py-2 align-top">
                  {{ item.values?.mainStreet }}, {{ item.values?.mainNumber || 's/ nº' }}
                  <span v-if="item.values?.mainComplement" class="text-muted">— {{ item.values?.mainComplement }}</span>
                  <br />
                  <span class="text-xs text-muted">
                    {{ formatValue(field('mainZip'), item.values?.mainZip ?? null) }} {{ item.values?.mainCity }}
                  </span>
                </td>
                <td class="px-2 py-2 align-top">
                  <span class="rounded px-1.5 py-0.5 text-xs font-medium" :class="STATUS_STYLE[item.status ?? 'draft']">
                    {{ statusLabel(item.status) }}
                  </span>
                </td>
                <td class="px-2 py-2 align-top text-xs">
                  <p v-if="item.missing?.length" class="text-danger">Faltam: {{ item.missing.map(label).join(', ') }}</p>
                  <p v-for="issue in item.errors" :key="issue.field" class="text-danger">
                    {{ label(issue.field) }}: {{ issue.message }}
                  </p>
                  <p v-for="warning in item.warnings" :key="warning" class="text-amber-700">{{ warning }}</p>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          v-if="preview.length"
          type="button"
          class="mr-auto text-sm font-medium text-brand hover:underline"
          @click="preview = []"
        >
          Colar outras linhas
        </button>
        <AppButton variant="secondary" @click="dialog?.close()">Cancelar</AppButton>
        <AppButton v-if="importable.length" :loading="loading" :disabled="!chosen.size" @click="confirm">
          Criar {{ chosen.size }} pré-cadastro(s)
        </AppButton>
      </div>
    </div>
  </dialog>
</template>
