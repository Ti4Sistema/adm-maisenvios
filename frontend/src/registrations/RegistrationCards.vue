<script setup lang="ts">
import { computed } from 'vue';
import { formatValue, STATUS_STYLE } from './format';
import type { Registration, Schema } from './types';

// Lista em cartões para o celular: no lugar da grade, um cartão por pré-cadastro.
// Tocar abre o painel com todos os campos.
const props = defineProps<{ schema: Schema; rows: Registration[] }>();
const emit = defineEmits<{ open: [row: Registration] }>();

const statusLabel = computed(() => Object.fromEntries(props.schema.statuses.map(({ key, label }) => [key, label])));
const documentField = computed(() => props.schema.fields.find(({ key }) => key === 'document'));

function documentOf(row: Registration) {
  const value = row.values.document ?? null;
  return documentField.value ? formatValue(documentField.value, value) : String(value ?? '');
}
const pending = (row: Registration) => row.missing.length + row.errors.length;
</script>

<template>
  <ul class="space-y-2">
    <li v-for="row in rows" :key="row.id">
      <button
        type="button"
        class="block w-full rounded-xl border border-line bg-white px-4 py-3 text-center transition active:bg-surface"
        @click="emit('open', row)"
      >
        <span class="flex items-center justify-center gap-2">
          <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="STATUS_STYLE[row.status]">
            {{ statusLabel[row.status] }}
          </span>
          <span v-if="pending(row)" class="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-danger">
            falta{{ pending(row) > 1 ? 'm' : '' }} {{ pending(row) }}
          </span>
        </span>
        <span class="mt-2 block truncate font-bold text-ink">
          {{ (row.values.tradeName as string) || 'Sem nome ainda' }}
        </span>
        <span v-if="row.values.legalName" class="block truncate text-sm text-muted">
          {{ row.values.legalName }}
        </span>
        <span
          v-if="row.values.document || row.values.adminLogin"
          class="mt-1 flex flex-wrap items-center justify-center gap-x-2 text-xs text-muted"
        >
          <span v-if="row.values.document">{{ documentOf(row) }}</span>
          <span v-if="row.values.document && row.values.adminLogin" aria-hidden="true">·</span>
          <span v-if="row.values.adminLogin">{{ row.values.adminLogin }}</span>
        </span>
      </button>
    </li>
    <li v-if="!rows.length" class="py-8 text-center text-sm text-muted">Nenhum pré-cadastro.</li>
  </ul>
</template>
