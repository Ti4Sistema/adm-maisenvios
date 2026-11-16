<script setup lang="ts">
import { ref, watch } from 'vue';
import AppButton from '../components/AppButton.vue';
import type { FieldValue, ServiceItem } from './types';

const props = defineProps<{
  value: FieldValue;
  known: { code: string; name: string }[];
  readonly?: boolean;
}>();

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

watch(() => props.value, reset, { immediate: true });

function nameOf(code: string) {
  return props.known.find((service) => service.code === code.padStart(5, '0'))?.name ?? '';
}

function save() {
  const toNumber = (text: string) => (text.trim() === '' ? null : Number(text.replace(',', '.')));
  emit(
    'save',
    lines.value
      .filter((line) => line.code.trim())
      .map((line) => ({ code: line.code.trim(), spread: toNumber(line.spread), malha: toNumber(line.malha) })),
  );
}

const input = 'w-full rounded border border-line px-2 py-1 text-sm disabled:bg-surface';
</script>

<template>
  <div class="space-y-2">
    <table class="w-full text-sm">
      <thead class="text-left text-xs text-muted">
        <tr>
          <th class="pb-1 font-medium">Código</th>
          <th class="pb-1 font-medium">Serviço</th>
          <th class="w-20 pb-1 font-medium">Spread %</th>
          <th class="w-20 pb-1 font-medium">Malha %</th>
          <th v-if="!readonly" class="w-8" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(line, index) in lines" :key="index">
          <td class="w-24 py-0.5 pr-1"><input v-model="line.code" :class="input" :disabled="readonly" /></td>
          <td class="truncate py-0.5 pr-1 text-muted">{{ nameOf(line.code) }}</td>
          <td class="py-0.5 pr-1"><input v-model="line.spread" :class="input" :disabled="readonly" inputmode="decimal" /></td>
          <td class="py-0.5 pr-1"><input v-model="line.malha" :class="input" :disabled="readonly" inputmode="decimal" /></td>
          <td v-if="!readonly" class="py-0.5 text-right">
            <button type="button" class="text-muted hover:text-danger" title="Remover" @click="lines.splice(index, 1)">
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
