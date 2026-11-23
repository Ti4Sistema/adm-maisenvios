<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppButton from '../components/AppButton.vue';
import NavIcon from '../components/NavIcon.vue';
import type { FieldValue, ServiceItem } from './types';

const props = defineProps<{
  value: FieldValue;
  known: { code: string; name: string }[];
  // Serviços padrão do tipo: vêm travados; o lápis destrava a linha para trocar ou tirar.
  locked?: string[];
  // Serviços que não aceitam spread (os padrão): só a malha fica editável.
  noSpread?: string[];
  // Únicos serviços que aceitam Malha % (os outros ficam sem o campo).
  malhaCodes?: string[];
  readonly?: boolean;
}>();

const codeOf = (line: Line) => line.code.trim().padStart(5, '0');
const allowsSpread = (line: Line) => !(props.noSpread ?? []).includes(codeOf(line));
const allowsMalha = (line: Line) => !props.malhaCodes || props.malhaCodes.includes(codeOf(line));
// A coluna Spread só aparece se algum serviço da lista aceitar spread.
const showSpread = computed(() => lines.value.some(allowsSpread));

// Serviço padrão vem travado; o lápis destrava a linha para trocar o código ou tirar.
const unlocked = ref(new Set<Line>());
const isLocked = (line: Line) => (props.locked?.includes(line.code) ?? false) && !unlocked.value.has(line);
function unlock(line: Line) {
  unlocked.value = new Set([...unlocked.value, line]);
}

const emit = defineEmits<{ save: [items: ServiceItem[]] }>();

interface Line {
  code: string;
  spread: string;
  malha: string;
}

const lines = ref<Line[]>([]);

function reset() {
  const items = Array.isArray(props.value) ? props.value : [];
  lines.value = items.map(({ code, spread, malha }) => ({
    code,
    spread: spread === null ? '' : String(spread),
    malha: malha === null ? '' : String(malha),
  }));
}

watch(
  () => props.value,
  () => {
    unlocked.value = new Set();
    reset();
  },
  { immediate: true },
);

function nameOf(code: string) {
  return props.known.find((service) => service.code === code.padStart(5, '0'))?.name ?? '';
}

function save() {
  const toNumber = (text: string) => (text.trim() === '' ? null : Number(text.replace(',', '.')));
  emit(
    'save',
    lines.value
      .filter((line) => line.code.trim())
      .map((line) => ({
        code: line.code.trim(),
        spread: allowsSpread(line) ? toNumber(line.spread) : null,
        malha: allowsMalha(line) ? toNumber(line.malha) : null,
      })),
  );
}

const input = 'w-full rounded border border-line px-2 py-1 text-sm disabled:bg-surface';

// Percentuais (spread e malha): fora do campo aparecem centralizados com o símbolo, "10%";
// ao clicar, volta só o número para editar.
const focusedPercent = ref<string | null>(null);
type PercentKey = 'spread' | 'malha';
function percentText(line: Line, key: PercentKey, index: number) {
  const raw = line[key].trim();
  if (!raw || focusedPercent.value === `${key}-${index}`) return line[key];
  return `${raw.replace('.', ',')}%`;
}
function setPercent(line: Line, key: PercentKey, event: Event) {
  line[key] = (event.target as HTMLInputElement).value.replace(/%/g, '');
}
</script>

<template>
  <div class="space-y-2">
    <table class="w-full text-sm">
      <thead class="text-left text-xs text-muted">
        <tr>
          <th class="pb-1 font-medium">Código</th>
          <th class="pb-1 font-medium">Serviço</th>
          <th v-if="showSpread" class="w-20 pb-1 text-center font-medium">Spread</th>
          <th class="w-20 pb-1 text-center font-medium">Malha</th>
          <th v-if="!readonly" class="w-8" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(line, index) in lines" :key="index">
          <td class="w-24 py-0.5 pr-1">
            <input v-model="line.code" :class="input" :disabled="readonly || isLocked(line)" />
          </td>
          <td class="truncate py-0.5 pr-1 text-muted">
            {{ nameOf(line.code) }}
            <button
              v-if="isLocked(line) && !readonly"
              type="button"
              class="ml-1 inline-flex rounded p-0.5 align-middle text-muted opacity-60 hover:text-brand hover:opacity-100"
              :title="`Clique para trocar ou tirar ${nameOf(line.code) || 'este serviço'}`"
              @click="unlock(line)"
            >
              <NavIcon name="edit" class="!h-3.5 !w-3.5" />
            </button>
          </td>
          <td v-if="showSpread" class="py-0.5 pr-1">
            <input
              v-if="allowsSpread(line)"
              :value="percentText(line, 'spread', index)"
              :class="[input, 'text-center']"
              :disabled="readonly"
              inputmode="decimal"
              @input="setPercent(line, 'spread', $event)"
              @focus="focusedPercent = 'spread-' + index"
              @blur="focusedPercent = null"
            />
          </td>
          <td class="py-0.5 pr-1">
            <input
              v-if="allowsMalha(line)"
              :value="percentText(line, 'malha', index)"
              :class="[input, 'text-center']"
              :disabled="readonly"
              inputmode="decimal"
              @input="setPercent(line, 'malha', $event)"
              @focus="focusedPercent = 'malha-' + index"
              @blur="focusedPercent = null"
            />
          </td>
          <td v-if="!readonly" class="py-0.5 text-right">
            <button
              v-if="!isLocked(line)"
              type="button"
              class="text-muted hover:text-danger"
              title="Remover"
              @click="lines.splice(index, 1)"
            >
              ✕
            </button>
          </td>
        </tr>
        <tr v-if="!lines.length">
          <td colspan="5" class="py-2 text-muted">Nenhum serviço.</td>
        </tr>
      </tbody>
    </table>
    <div v-if="!readonly" class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="text-sm font-medium text-brand hover:underline"
        @click="lines.push({ code: '', spread: '', malha: '' })"
      >
        Adicionar serviço
      </button>
      <span class="flex-1" />
      <AppButton variant="secondary" @click="reset">Descartar</AppButton>
      <AppButton @click="save">Salvar serviços</AppButton>
    </div>
  </div>
</template>
