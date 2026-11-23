<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '../api/client';

// Gráfico de barras da tela inicial: pré-cadastros criados e aprovados por dia.
// Desenhado com HTML e CSS, sem biblioteca de gráficos (regra do projeto).
interface Day {
  day: string;
  created: number;
  approved: number;
}
interface Stats {
  days: Day[];
  previous: { created: number; approved: number };
}

const period = ref<7 | 30>(7);
const stats = ref<Stats | null>(null);
const error = ref('');

async function load() {
  error.value = '';
  try {
    stats.value = await api<Stats>('/registrations/stats/daily', { query: { days: String(period.value) } });
  } catch (cause) {
    error.value = (cause as Error).message;
  }
}
watch(period, load, { immediate: true });

const totals = computed(() => {
  const days = stats.value?.days ?? [];
  return {
    created: days.reduce((sum, { created }) => sum + created, 0),
    approved: days.reduce((sum, { approved }) => sum + approved, 0),
  };
});

// Comparação dos criados com o período anterior de mesmo tamanho.
const change = computed(() => {
  const before = stats.value?.previous.created ?? 0;
  if (!stats.value || before === 0) return null;
  return Math.round(((totals.value.created - before) / before) * 100);
});

// Escala do eixo: o maior valor do período, arredondado para cima em número par.
const top = computed(() => {
  const highest = Math.max(1, ...(stats.value?.days ?? []).map(({ created, approved }) => Math.max(created, approved)));
  return highest <= 4 ? 4 : Math.ceil(highest / 2) * 2;
});
const gridLines = computed(() => [top.value, top.value / 2, 0]);

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function dateOf(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}
function label(day: string, index: number) {
  const date = dateOf(day);
  if (period.value === 7) return WEEKDAYS[date.getDay()];
  // Em 30 dias, só alguns rótulos para não amontoar.
  const last = (stats.value?.days.length ?? 0) - 1;
  return index % 5 === 0 || index === last ? String(date.getDate()) : '';
}
function tooltip({ day, created, approved }: Day) {
  const date = dateOf(day).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  return `${date}: ${created} criado(s), ${approved} aprovado(s)`;
}
const height = (value: number) => `${(value / top.value) * 100}%`;
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 font-semibold">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke-linecap="round" />
          </svg>
        </span>
        Pré-cadastros {{ period === 7 ? 'da semana' : 'do mês' }}
      </h2>
      <div class="flex rounded-full bg-surface p-0.5 text-xs font-semibold" role="group" aria-label="Período">
        <button
          v-for="option in [7, 30] as const"
          :key="option"
          type="button"
          class="rounded-full px-3 py-1 transition"
          :class="period === option ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'"
          :aria-pressed="period === option"
          @click="period = option"
        >
          {{ option }} dias
        </button>
      </div>
    </div>

    <p v-if="error" class="mt-4 text-sm text-danger">{{ error }}</p>
    <template v-else-if="stats">
      <div class="mt-4 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <p class="text-2xl font-bold">{{ totals.created }}</p>
          <p class="flex items-center gap-1.5 text-xs text-muted">
            <span class="h-2.5 w-2.5 rounded-sm bg-[#2a78d6]" />Criados
          </p>
        </div>
        <div>
          <p class="text-2xl font-bold">{{ totals.approved }}</p>
          <p class="flex items-center gap-1.5 text-xs text-muted">
            <span class="h-2.5 w-2.5 rounded-sm bg-accent" />Aprovados
          </p>
        </div>
        <div v-if="change !== null">
          <p class="text-2xl font-bold" :class="change >= 0 ? 'text-success' : 'text-danger'">
            {{ change > 0 ? '+' : '' }}{{ change }}%
          </p>
          <p class="text-xs text-muted">criados vs {{ period === 7 ? 'semana' : 'mês' }} anterior</p>
        </div>
      </div>

      <div class="mt-4 flex gap-2">
        <!-- Eixo com a escala -->
        <div class="flex h-40 flex-col justify-between pb-px text-right text-[11px] text-muted">
          <span v-for="line in gridLines" :key="line" class="leading-none">{{ line }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="relative h-40">
            <div class="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              <span v-for="line in gridLines" :key="line" class="border-t border-line" />
            </div>
            <div class="relative flex h-full items-end" :class="period === 7 ? 'gap-3' : 'gap-0.5'">
              <div
                v-for="day in stats.days"
                :key="day.day"
                class="flex h-full flex-1 items-end justify-center gap-0.5 rounded-t-md hover:bg-surface"
                :title="tooltip(day)"
              >
                <span
                  class="w-full max-w-4 rounded-t bg-[#2a78d6] transition-all"
                  :style="{ height: height(day.created) }"
                />
                <span
                  class="w-full max-w-4 rounded-t bg-accent transition-all"
                  :style="{ height: height(day.approved) }"
                />
              </div>
            </div>
          </div>
          <div class="mt-1.5 flex text-[11px] text-muted" :class="period === 7 ? 'gap-3' : 'gap-0.5'">
            <span v-for="(day, index) in stats.days" :key="day.day" class="flex-1 text-center">
              {{ label(day.day, index) }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
