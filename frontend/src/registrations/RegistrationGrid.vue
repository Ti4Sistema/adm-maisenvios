<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import FieldEditor, { type Move } from './FieldEditor.vue';
import {
  cellValue,
  formatValue,
  isEditableMode,
  parseTsv,
  ruleOf,
  servicesFromText,
  STATUS_STYLE,
} from './format';
import type { Registration, Schema, SchemaField } from './types';

const props = defineProps<{
  schema: Schema;
  rows: Registration[];
  columns: SchemaField[];
  saving: Set<string>;
  canEdit: (row: Registration) => boolean;
}>();

const emit = defineEmits<{
  save: [row: Registration, changes: { field: string; to: unknown }[]];
  open: [row: Registration];
  // Linhas inteiras da planilha Smart coladas na grade.
  smartPaste: [text: string];
  notify: [text: string];
}>();

const WIDTH: Record<string, number> = {
  text: 180, longtext: 240, document: 160, email: 210, zip: 100, phone: 140, state: 70,
  integer: 100, money: 130, percent: 90, boolean: 90, select: 150, services: 190, login: 160, digits: 130,
};
const STATUS_WIDTH = 132;

const root = ref<HTMLDivElement>();
const selected = ref<{ row: number; col: number } | null>(null);
// A edição guarda o id da linha: se a lista recarregar e mudar de ordem, o valor
// continua indo para o pré-cadastro certo.
const editing = ref<{ rowId: string; col: number; initialText?: string } | null>(null);

function isEditing(rowIndex: number, colIndex: number) {
  return editing.value?.rowId === props.rows[rowIndex]?.id && editing.value?.col === colIndex;
}

const statusLabel = computed(() => Object.fromEntries(props.schema.statuses.map(({ key, label }) => [key, label])));
const typeLabel = computed(() => Object.fromEntries(props.schema.types.map(({ key, label }) => [key, label])));

// Cabeçalho de grupos: colunas vizinhas do mesmo grupo viram uma célula só.
const groupHeaders = computed(() => {
  const labels = Object.fromEntries(props.schema.groups.map(({ key, label }) => [key, label]));
  const result: { key: string; label: string; span: number }[] = [];
  props.columns.slice(1).forEach((column) => {
    const last = result[result.length - 1];
    if (last?.key === column.group) last.span += 1;
    else result.push({ key: column.group, label: labels[column.group], span: 1 });
  });
  return result;
});

function width(column: SchemaField) {
  return `${WIDTH[column.input] ?? 160}px`;
}

// Com table-layout fixed, a tabela precisa da largura total para respeitar cada coluna.
const tableWidth = computed(
  () => `${props.columns.reduce((total, column) => total + (WIDTH[column.input] ?? 160), STATUS_WIDTH)}px`,
);

function editable(row: Registration, column: SchemaField) {
  return isEditableMode(ruleOf(column, row)) && props.canEdit(row);
}

function issueOf(row: Registration, key: string) {
  const error = row.errors.find(({ field }) => field === key);
  if (error) return { kind: 'error', message: error.message };
  if (row.missing.includes(key)) return { kind: 'missing', message: 'Obrigatório' };
  const warning = row.warnings.find(({ field }) => field === key);
  if (warning) return { kind: 'warning', message: warning.message };
  return null;
}

function display(row: Registration, column: SchemaField) {
  const { mode } = ruleOf(column, row);
  if (mode === 'hidden') return { text: '', title: 'Não se aplica a este tipo', muted: true };
  if (mode === 'send') return { text: 'No envio', title: 'Escolhido na integração com a Mais Envios', muted: true };
  const { value, suggested } = cellValue(column, row);
  const text = formatValue(column, value);
  const issue = issueOf(row, column.key);
  const title = [text, suggested ? '(sugestão do sistema)' : '', mode === 'fixed' ? '(fixo)' : '', issue?.message ?? '']
    .filter(Boolean)
    .join(' · ');
  return { text, title, muted: suggested || mode === 'fixed' || mode === 'calc' };
}

function cellClass(rowIndex: number, colIndex: number) {
  const row = props.rows[rowIndex];
  const column = props.columns[colIndex];
  const { mode } = ruleOf(column, row);
  const issue = issueOf(row, column.key);
  const isSelected = selected.value?.row === rowIndex && selected.value?.col === colIndex;
  return [
    'relative h-9 max-w-0 truncate border-r border-b border-line px-2 align-middle',
    mode === 'hidden' || mode === 'send'
      ? 'bg-surface/80 text-muted/70'
      : mode === 'fixed' || mode === 'calc'
        ? 'bg-surface text-muted'
        : issue?.kind === 'missing'
          ? 'bg-red-50'
          : 'bg-white',
    issue?.kind === 'error' ? 'text-danger font-medium' : '',
    isSelected ? 'outline-2 -outline-offset-2 outline-brand z-[1]' : '',
    props.saving.has(`${row.id}:${column.key}`) ? 'animate-pulse' : '',
    colIndex === 0 ? 'sticky z-10 font-medium' : '',
  ];
}

async function select(row: number, col: number) {
  const maxRow = props.rows.length - 1;
  const maxCol = props.columns.length - 1;
  selected.value = { row: Math.max(0, Math.min(row, maxRow)), col: Math.max(0, Math.min(col, maxCol)) };
  await nextTick();
  root.value
    ?.querySelector(`[data-cell="${selected.value.row}-${selected.value.col}"]`)
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function startEdit(rowIndex: number, colIndex: number, initialText?: string) {
  const row = props.rows[rowIndex];
  const column = props.columns[colIndex];
  if (!row || !column) return;
  if (!editable(row, column)) {
    const { mode } = ruleOf(column, row);
    if (!props.canEdit(row)) emit('notify', 'Você não pode alterar este pré-cadastro');
    else if (mode === 'fixed') emit('notify', `${column.label} é fixo neste tipo de cadastro`);
    else if (mode === 'send') emit('notify', `${column.label} é escolhido no envio para a Mais Envios`);
    return;
  }
  if (column.input === 'boolean' && initialText === undefined) {
    const current = row.values[column.key];
    emit('save', row, [{ field: column.key, to: current === true ? false : true }]);
    return;
  }
  editing.value = { rowId: row.id, col: colIndex, initialText };
}

function onCommit(to: unknown, move: Move) {
  const target = editing.value;
  editing.value = null;
  if (!target) return;
  const rowIndex = props.rows.findIndex(({ id }) => id === target.rowId);
  const row = props.rows[rowIndex];
  const column = props.columns[target.col];
  if (!row || !column) return;
  if (to !== undefined) emit('save', row, [{ field: column.key, to }]);
  if (move === 'down') select(rowIndex + 1, target.col);
  else if (move === 'right') select(rowIndex, target.col + 1);
  else if (move === 'left') select(rowIndex, target.col - 1);
  root.value?.focus();
}

function onCancel() {
  editing.value = null;
  root.value?.focus();
}

function onKeydown(event: KeyboardEvent) {
  if (editing.value || !selected.value || event.altKey) return;
  const { row, col } = selected.value;
  const moves: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  if (moves[event.key]) {
    event.preventDefault();
    select(row + moves[event.key][0], col + moves[event.key][1]);
  } else if (event.key === 'Tab') {
    event.preventDefault();
    select(row, col + (event.shiftKey ? -1 : 1));
  } else if (event.key === 'Enter' || event.key === 'F2') {
    event.preventDefault();
    startEdit(row, col);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    const target = props.rows[row];
    const column = props.columns[col];
    if (editable(target, column) && target.values[column.key] !== null) {
      emit('save', target, [{ field: column.key, to: null }]);
    }
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
    const column = props.columns[col];
    if (column.input === 'boolean' || column.input === 'select' || column.input === 'state') return;
    event.preventDefault();
    startEdit(row, col, event.key);
  }
}

function onCopy(event: ClipboardEvent) {
  if (editing.value || !selected.value) return;
  const row = props.rows[selected.value.row];
  const column = props.columns[selected.value.col];
  event.preventDefault();
  event.clipboardData?.setData('text/plain', display(row, column).text);
}

// Ctrl+V de um bloco de células preenche a partir da célula selecionada, como no
// Excel. Linhas inteiras da planilha Smart (20 colunas ou mais) viram importação.
function onPaste(event: ClipboardEvent) {
  if (editing.value) return;
  const text = event.clipboardData?.getData('text/plain') ?? '';
  const matrix = parseTsv(text);
  if (!matrix.length) return;
  event.preventDefault();

  if (matrix[0].length >= 20) {
    emit('smartPaste', text);
    return;
  }
  if (!selected.value) {
    emit('notify', 'Selecione a célula onde a colagem deve começar');
    return;
  }

  let skipped = 0;
  matrix.forEach((cells, i) => {
    const row = props.rows[selected.value!.row + i];
    if (!row) {
      skipped += cells.length;
      return;
    }
    const changes: { field: string; to: unknown }[] = [];
    cells.forEach((cell, j) => {
      const column = props.columns[selected.value!.col + j];
      if (!column || !editable(row, column)) {
        skipped += 1;
        return;
      }
      const to = column.input === 'services' ? servicesFromText(cell, row.values[column.key]) : cell;
      changes.push({ field: column.key, to });
    });
    if (changes.length) emit('save', row, changes);
  });
  if (skipped) emit('notify', `${skipped} célula(s) ignorada(s): fora da grade ou não editáveis`);
}

defineExpose({ focus: () => root.value?.focus() });
</script>

<template>
  <div
    ref="root"
    tabindex="0"
    class="relative overflow-auto rounded-lg border border-line bg-white focus:outline-none"
    style="max-height: calc(100vh - 250px)"
    @keydown="onKeydown"
    @copy="onCopy"
    @paste="onPaste"
  >
    <table class="border-separate border-spacing-0 text-sm" :style="{ tableLayout: 'fixed', width: tableWidth }">
      <colgroup>
        <col :style="{ width: `${STATUS_WIDTH}px` }" />
        <col v-for="column in columns" :key="column.key" :style="{ width: width(column) }" />
      </colgroup>
      <thead class="sticky top-0 z-20 bg-white text-left text-xs text-muted">
        <tr>
          <th
            rowspan="2"
            class="sticky left-0 z-30 border-r border-b border-line bg-white px-2 py-2 font-medium"
          >
            Situação
          </th>
          <th
            rowspan="2"
            class="sticky z-30 border-r border-b border-line bg-white px-2 py-2 font-medium text-ink"
            :style="{ left: `${STATUS_WIDTH}px` }"
          >
            {{ columns[0]?.label }}
          </th>
          <th
            v-for="group in groupHeaders"
            :key="group.key + group.span"
            :colspan="group.span"
            class="truncate border-r border-b border-line bg-surface px-2 py-1 font-semibold uppercase tracking-wide"
          >
            {{ group.label }}
          </th>
        </tr>
        <tr>
          <th
            v-for="column in columns.slice(1)"
            :key="column.key"
            class="truncate border-r border-b border-line bg-white px-2 py-2 font-medium text-ink"
            :title="column.hint ?? column.label"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in rows" :key="row.id" class="group">
          <td
            class="sticky left-0 z-10 h-9 border-r border-b border-line bg-white px-2 group-hover:bg-surface"
          >
            <button
              type="button"
              class="flex w-full items-center gap-1.5 text-left"
              :title="`Abrir ${typeLabel[row.type]}: pendências, todos os campos e histórico`"
              @click="emit('open', row)"
            >
              <span class="rounded px-1.5 py-0.5 text-[11px] font-medium" :class="STATUS_STYLE[row.status]">
                {{ statusLabel[row.status] }}
              </span>
              <span class="text-[11px] text-muted">{{ typeLabel[row.type] }}</span>
              <span
                v-if="row.missing.length + row.errors.length"
                class="ml-auto text-[11px] font-medium text-danger"
                :title="`${row.missing.length} campo(s) faltando, ${row.errors.length} com erro`"
              >
                {{ row.missing.length + row.errors.length }}
              </span>
            </button>
          </td>
          <td
            v-for="(column, colIndex) in columns"
            :key="column.key"
            :data-cell="`${rowIndex}-${colIndex}`"
            :class="cellClass(rowIndex, colIndex)"
            :style="colIndex === 0 ? { left: `${STATUS_WIDTH}px` } : undefined"
            :title="editing ? undefined : display(row, column).title"
            @mousedown="!isEditing(rowIndex, colIndex) && select(rowIndex, colIndex)"
            @dblclick="startEdit(rowIndex, colIndex)"
          >
            <FieldEditor
              v-if="isEditing(rowIndex, colIndex)"
              class="absolute inset-0"
              compact
              :field="column"
              :value="row.values[column.key] ?? null"
              :initial-text="editing?.initialText"
              @commit="onCommit"
              @cancel="onCancel"
            />
            <span v-else :class="{ 'italic text-muted': display(row, column).muted }">
              {{ display(row, column).text }}
            </span>
            <span
              v-if="issueOf(row, column.key)?.kind === 'warning'"
              class="absolute top-0 right-0 border-t-[7px] border-l-[7px] border-t-accent border-l-transparent"
            />
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td :colspan="columns.length + 1" class="px-4 py-10 text-center text-muted">
            Nenhum pré-cadastro. Crie uma linha ou cole as linhas da planilha Smart (Ctrl+V).
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
