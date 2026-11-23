<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import NavIcon from '../components/NavIcon.vue';
import FieldEditor, { type Move } from './FieldEditor.vue';
import {
  cellValue,
  formatValue,
  isEditableMode,
  isShown,
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
  // Ações da linha: ocultar ou mostrar de novo, e excluir.
  hide: [row: Registration, hidden: boolean];
  remove: [row: Registration];
  // Linhas inteiras da planilha Smart coladas na grade.
  smartPaste: [text: string];
  // Texto de ficha de cliente colado na grade.
  formPaste: [text: string];
  notify: [text: string];
}>();

// Largura do conteúdo quando nenhuma linha preencheu a coluna ainda (espaço para digitar).
const EMPTY_WIDTH: Record<string, number> = {
  text: 120,
  longtext: 160,
  document: 125,
  email: 160,
  zip: 70,
  phone: 105,
  state: 30,
  integer: 50,
  money: 80,
  percent: 45,
  boolean: 30,
  select: 100,
  services: 140,
  login: 110,
  digits: 90,
};
const EMPTY_KEY_WIDTH: Record<string, number> = { mainNumber: 45, pickupNumber: 45 };
const STATUS_WIDTH = 150;

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

// Larguras escolhidas pelo administrador ao arrastar a borda do cabeçalho, como no
// Excel. Ficam guardadas neste navegador.
const WIDTHS_KEY = 'pre-cadastro:larguras';
const MIN_WIDTH = 48;
const MAX_WIDTH = 800;
const customWidths = ref<Record<string, number>>(readWidths());

function readWidths(): Record<string, number> {
  try {
    const saved = JSON.parse(localStorage.getItem(WIDTHS_KEY) ?? '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function storeWidths() {
  try {
    localStorage.setItem(WIDTHS_KEY, JSON.stringify(customWidths.value));
  } catch {
    // Sem armazenamento local, a largura vale só nesta visita.
  }
}

// Campos pouco usados (IE, IM, telefones fixos, site) começam recolhidos numa
// coluna estreita; um clique no cabeçalho abre. Coluna com algum valor fica aberta.
const OPEN_KEY = 'pre-cadastro:extras-abertos';
const COLLAPSED_WIDTH = 34;
const openRare = ref<string[]>(readOpenRare());

function readOpenRare(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function isCollapsed(column: SchemaField) {
  if (!column.rare || openRare.value.includes(column.key)) return false;
  return !props.rows.some((row) => row.values[column.key] !== null && row.values[column.key] !== undefined);
}

function setOpen(column: SchemaField, open: boolean) {
  openRare.value = open
    ? [...new Set([...openRare.value, column.key])]
    : openRare.value.filter((key) => key !== column.key);
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify(openRare.value));
  } catch {
    // Sem armazenamento local, vale só nesta visita.
  }
}

// Largura automática: o maior valor da coluna ou o cabeçalho quebrado em até três
// linhas, o que for maior. Cabeçalho comprido com resposta curta (Sim/Não) quebra
// a linha em vez de alargar a coluna.
const measurer = document.createElement('canvas').getContext('2d');
const FONT_FAMILY = getComputedStyle(document.body).fontFamily;
const CELL_FONT = `400 14px ${FONT_FAMILY}`;
// A primeira coluna (o nome) fica em negrito.
const NAME_FONT = `600 14px ${FONT_FAMILY}`;
const HEADER_FONT = `600 13px ${FONT_FAMILY}`;
// Preenchimento da célula (px-2), borda e uma folga para o itálico.
const CELL_PADDING = 30;
const MIN_AUTO = 44;
const MAX_AUTO = 320;

function textWidth(text: string, font: string) {
  if (!measurer) return text.length * 7.5;
  measurer.font = font;
  return measurer.measureText(text).width;
}

const autoWidths = computed(() => {
  const result: Record<string, number> = {};
  props.columns.forEach((column, index) => {
    const font = index === 0 ? NAME_FONT : CELL_FONT;
    let content = 0;
    for (const row of props.rows) {
      const { text } = display(row, column);
      if (text) content = Math.max(content, textWidth(text, font));
    }
    if (!content) content = EMPTY_KEY_WIDTH[column.key] ?? EMPTY_WIDTH[column.input] ?? 110;
    const longestWord = Math.max(...column.label.split(/\s+/).map((word) => textWidth(word, HEADER_FONT)));
    const header = Math.max(longestWord, textWidth(column.label, HEADER_FONT) / 2.5) + (column.rare ? 22 : 0);
    result[column.key] = Math.round(Math.min(MAX_AUTO, Math.max(MIN_AUTO, content + CELL_PADDING, header + 20)));
  });
  return result;
});

function widthOf(column: SchemaField) {
  if (isCollapsed(column)) return COLLAPSED_WIDTH;
  return customWidths.value[column.key] ?? autoWidths.value[column.key] ?? 120;
}

// Largura disponível no cartão. Se a soma passar dela, as colunas encolhem na
// mesma proporção para caber nela, sem rolagem para o lado (o texto longo fica com
// reticências e aparece inteiro ao passar o mouse).
const available = ref(0);
let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => (available.value = entry.contentRect.width));
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

const naturalWidth = computed(() => props.columns.reduce((total, column) => total + widthOf(column), STATUS_WIDTH));
const fit = computed(() => {
  if (!available.value || naturalWidth.value <= available.value) return 1;
  return Math.max(0.6, available.value / naturalWidth.value);
});
const statusWidth = computed(() => Math.floor(STATUS_WIDTH * fit.value));

function width(column: SchemaField) {
  return `${Math.floor(widthOf(column) * fit.value)}px`;
}

function setWidth(column: SchemaField, value: number) {
  customWidths.value = {
    ...customWidths.value,
    [column.key]: Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value))),
  };
}

// Arrastar a borda direita do cabeçalho muda a largura da coluna.
function startResize(event: PointerEvent, column: SchemaField) {
  const handle = event.currentTarget as HTMLElement;
  const startX = event.clientX;
  const startWidth = widthOf(column);
  handle.setPointerCapture(event.pointerId);
  document.body.style.cursor = 'col-resize';

  const onMove = (move: PointerEvent) => setWidth(column, startWidth + move.clientX - startX);
  const onUp = () => {
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onUp);
    document.body.style.cursor = '';
    storeWidths();
  };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);
}

// Duplo clique na borda devolve a coluna à largura automática.
function autoFit(column: SchemaField) {
  const rest = { ...customWidths.value };
  delete rest[column.key];
  customWidths.value = rest;
  storeWidths();
}

function resetWidths() {
  customWidths.value = {};
  storeWidths();
}

// Com table-layout fixed, a tabela precisa da largura total para respeitar cada coluna.
const tableWidth = computed(() => (fit.value < 1 ? '100%' : `max(100%, ${naturalWidth.value}px)`));

function editable(row: Registration, column: SchemaField) {
  return isEditableMode(ruleOf(column, row)) && isShown(column, row) && props.canEdit(row);
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
  if (!isShown(column, row)) {
    const flag = props.schema.fields.find(({ key }) => key === column.shownWhen);
    return { text: '', title: `Ligue "${flag?.label}" para preencher`, muted: true };
  }
  const { value, suggested } = cellValue(column, row);
  const text = formatValue(column, value);
  const issue = issueOf(row, column.key);
  const title = [text, suggested ? '(sugestão do sistema)' : '', issue?.message ?? ''].filter(Boolean).join(' · ');
  return { text, title, muted: suggested || mode === 'fixed' || mode === 'calc' };
}

function cellClass(rowIndex: number, colIndex: number) {
  const row = props.rows[rowIndex];
  const column = props.columns[colIndex];
  const { mode } = isShown(column, row) ? ruleOf(column, row) : { mode: 'hidden' };
  const issue = issueOf(row, column.key);
  const isSelected = selected.value?.row === rowIndex && selected.value?.col === colIndex;
  return [
    'relative h-11 max-w-0 truncate border-b border-line px-3 align-middle',
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
    colIndex === 0 ? 'sticky z-10 font-medium text-center' : 'text-center',
  ];
}

async function select(row: number, col: number, byMouse = false) {
  const maxRow = props.rows.length - 1;
  const maxCol = props.columns.length - 1;
  selected.value = { row: Math.max(0, Math.min(row, maxRow)), col: Math.max(0, Math.min(col, maxCol)) };
  // Clicar numa coluna recolhida abre a coluna; as setas só passam por ela.
  const column = props.columns[selected.value.col];
  if (byMouse && column && isCollapsed(column)) setOpen(column, true);
  await nextTick();
  root.value
    ?.querySelector(`[data-cell="${selected.value.row}-${selected.value.col}"]`)
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function startEdit(rowIndex: number, colIndex: number, initialText?: string) {
  const row = props.rows[rowIndex];
  const column = props.columns[colIndex];
  if (column && isCollapsed(column)) setOpen(column, true);
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
  // Ficha de cliente em texto ("Razão Social: ...", "CNPJ: ..."): vai para a leitura da ficha.
  if (text.split(/\r?\n/).filter((line) => /^[^:\t]{2,40}:\s*\S/.test(line.trim())).length >= 3) {
    emit('formPaste', text);
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

const hasCustomWidths = computed(() => Object.keys(customWidths.value).length > 0);

defineExpose({ focus: () => root.value?.focus(), resetWidths, hasCustomWidths });
</script>

<template>
  <div
    ref="root"
    tabindex="0"
    class="relative overflow-auto rounded-xl border border-line bg-white focus:outline-none"
    style="max-height: calc(100vh - 300px)"
    @keydown="onKeydown"
    @copy="onCopy"
    @paste="onPaste"
  >
    <table class="border-separate border-spacing-0 text-sm" :style="{ tableLayout: 'fixed', width: tableWidth }">
      <colgroup>
        <col :style="{ width: `${statusWidth}px` }" />
        <col v-for="column in columns" :key="column.key" :style="{ width: width(column) }" />
      </colgroup>
      <thead class="sticky top-0 z-20 bg-[#e9eefa] text-[13px]">
        <tr>
          <th
            class="sticky left-0 z-30 border-r border-b border-[#d3dcf2] px-3 py-3 bg-[#e9eefa] text-center align-middle leading-tight font-semibold break-words text-brand-dark"
          >
            Situação
          </th>
          <th
            v-if="columns[0]"
            class="sticky z-30 border-r border-b border-[#d3dcf2] px-3 py-3 bg-[#e9eefa] text-center align-middle leading-tight font-semibold break-words text-brand-dark"
            :style="{ left: `${statusWidth}px` }"
            :data-header="columns[0].key"
          >
            <span data-text>{{ columns[0].label }}</span>
            <span
              class="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize hover:bg-brand/40"
              title="Arraste para mudar a largura; duplo clique volta ao ajuste automático"
              @pointerdown.stop.prevent="startResize($event, columns[0])"
              @dblclick.stop="autoFit(columns[0])"
            />
          </th>
          <th
            v-for="column in columns.slice(1)"
            :key="column.key"
            class="relative border-r border-b border-[#d3dcf2] bg-[#e9eefa] text-center align-middle leading-tight font-semibold break-words text-brand-dark"
            :class="isCollapsed(column) ? 'p-0' : 'px-3 py-3'"
            :title="isCollapsed(column) ? undefined : (column.hint ?? column.label)"
            :data-header="column.key"
          >
            <button
              v-if="isCollapsed(column)"
              type="button"
              class="flex h-full w-full items-center justify-center py-2 text-muted hover:bg-neutral-100 hover:text-ink"
              :title="`Abrir ${column.label}`"
              :aria-label="`Abrir ${column.label}`"
              @click="setOpen(column, true)"
            >
              +
            </button>
            <template v-else>
              <span data-text>{{ column.label }}</span>
              <button
                v-if="column.rare"
                type="button"
                class="ml-1 rounded px-1 text-muted hover:bg-neutral-100 hover:text-ink"
                :title="`Recolher ${column.label}`"
                :aria-label="`Recolher ${column.label}`"
                @click="setOpen(column, false)"
              >
                −
              </button>
              <span
                class="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize hover:bg-brand/40"
                title="Arraste para mudar a largura; duplo clique volta ao ajuste automático"
                @pointerdown.stop.prevent="startResize($event, column)"
                @dblclick.stop="autoFit(column)"
              />
            </template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in rows" :key="row.id" class="group">
          <td class="sticky left-0 z-10 h-11 border-b border-line bg-white px-3 group-hover:bg-surface">
            <button
              type="button"
              class="flex w-full items-center justify-center"
              :title="`Abrir ${typeLabel[row.type]}: pendências, todos os campos e histórico`"
              @click="emit('open', row)"
            >
              <span class="rounded px-1.5 py-0.5 text-[11px] font-medium" :class="STATUS_STYLE[row.status]">
                {{ statusLabel[row.status] }}
              </span>
              <span
                v-if="row.missing.length + row.errors.length"
                class="absolute right-3 text-[11px] font-medium text-danger"
                :title="`${row.missing.length} campo(s) faltando, ${row.errors.length} com erro`"
              >
                {{ row.missing.length + row.errors.length }}
              </span>
            </button>
            <span
              v-if="canEdit(row)"
              class="absolute inset-y-0 right-1 hidden items-center gap-0.5 bg-surface pl-1 group-hover:flex"
            >
              <button
                type="button"
                class="rounded p-1 text-muted hover:bg-neutral-200 hover:text-ink"
                :title="row.hiddenAt ? 'Mostrar de novo na lista' : 'Ocultar da lista'"
                :aria-label="row.hiddenAt ? 'Mostrar de novo na lista' : 'Ocultar da lista'"
                @click="emit('hide', row, !row.hiddenAt)"
              >
                <NavIcon :name="row.hiddenAt ? 'show' : 'hide'" class="!h-4 !w-4" />
              </button>
              <button
                type="button"
                class="rounded p-1 text-muted hover:bg-red-50 hover:text-danger"
                title="Excluir"
                aria-label="Excluir"
                @click="emit('remove', row)"
              >
                <NavIcon name="trash" class="!h-4 !w-4" />
              </button>
            </span>
          </td>
          <td
            v-for="(column, colIndex) in columns"
            :key="column.key"
            :data-cell="`${rowIndex}-${colIndex}`"
            :data-col="colIndex"
            :class="cellClass(rowIndex, colIndex)"
            :style="colIndex === 0 ? { left: `${statusWidth}px` } : undefined"
            :title="editing ? undefined : display(row, column).title"
            @mousedown="!isEditing(rowIndex, colIndex) && select(rowIndex, colIndex, true)"
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
            <span v-else data-text :class="{ 'italic text-muted': display(row, column).muted }">
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
