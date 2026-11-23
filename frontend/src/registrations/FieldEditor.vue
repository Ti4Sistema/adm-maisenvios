<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue';
import { editText, servicesFromText, withCreditMargin } from './format';
import type { FieldValue, SchemaField } from './types';

export type Move = 'down' | 'right' | 'left' | 'none';

const props = defineProps<{
  field: SchemaField;
  value: FieldValue;
  // Texto inicial quando a edição começa digitando direto na célula.
  initialText?: string;
  // Na grade: ocupa a célula e some ao confirmar. No painel: fica sempre visível.
  compact?: boolean;
  disabled?: boolean;
}>();

// to === undefined quando nada mudou.
const emit = defineEmits<{ commit: [to: unknown, move: Move]; cancel: [] }>();

const listId = useId();
const element = ref<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();
const original = computed(() => editText(props.field, props.value));
const draft = ref(props.initialText ?? original.value);
const focused = ref(false);
let finished = false;
// No painel, change e blur chegam juntos: o mesmo texto não é enviado duas vezes.
let pending: string | null = null;

const isSelect = computed(() => props.field.input === 'select' || props.field.input === 'state' || props.field.input === 'boolean');
const options = computed(() =>
  props.field.input === 'boolean'
    ? [
        { value: 'Sim', label: 'Sim' },
        { value: 'Não', label: 'Não' },
      ]
    : (props.field.options ?? []),
);

// Valor novo vindo do servidor (ex.: rua preenchida pelo CEP). Se o campo está com
// o cursor mas a pessoa não digitou nada nele, mostra o valor novo; senão, ao sair
// do campo, o texto antigo seria salvo por cima do que o CEP preencheu.
watch(original, (text, previous) => {
  pending = null;
  if (!focused.value || draft.value === previous) draft.value = text;
});

onMounted(async () => {
  if (!props.compact) return;
  await nextTick();
  element.value?.focus();
  if (element.value instanceof HTMLInputElement && props.initialText === undefined) element.value.select();
});

function finish(move: Move) {
  if (props.compact && finished) return;
  finished = props.compact;
  const text = draft.value.trim();
  if (!props.compact && text === pending) return;
  if (text === original.value.trim()) {
    emit('commit', undefined, move);
    return;
  }
  pending = text;
  let to: unknown = text;
  if (props.field.input === 'services') to = servicesFromText(text, props.value);
  // Na Smart o limite é fixo (não editável), então isto só acontece no cadastro de clientes.
  else if (props.field.key === 'creditLimit' && text) {
    to = withCreditMargin(text);
    // Mostra já o valor com os 50%; assim, sair do campo depois do Enter não soma de novo.
    draft.value = pending = to as string;
  }
  emit('commit', to, move);
}

function cancel() {
  finished = true;
  pending = null;
  draft.value = original.value;
  emit('cancel');
}

function onKeydown(event: KeyboardEvent) {
  event.stopPropagation();
  if (event.key === 'Escape') {
    event.preventDefault();
    cancel();
  } else if (event.key === 'Enter' && !(props.field.input === 'longtext' && !props.compact && !event.ctrlKey)) {
    event.preventDefault();
    finish(props.compact ? 'down' : 'none');
  } else if (event.key === 'Tab' && props.compact) {
    event.preventDefault();
    finish(event.shiftKey ? 'left' : 'right');
  }
}

function onBlur() {
  focused.value = false;
  if (props.compact && finished) return;
  finish('none');
}

const base = computed(() =>
  props.compact
    ? 'h-full w-full border-0 bg-white px-2 py-1 text-sm outline-none ring-2 ring-brand ring-inset'
    : 'w-full rounded-md border border-line bg-white px-3 py-1.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none disabled:bg-surface disabled:text-muted',
);
</script>

<template>
  <select
    v-if="isSelect"
    ref="element"
    v-model="draft"
    :class="base"
    :disabled="disabled"
    @focus="focused = true"
    @change="finish('none')"
    @blur="onBlur"
    @keydown="onKeydown"
  >
    <option value="">—</option>
    <option v-for="option in options" :key="option.value" :value="option.value">
      {{ option.label }}
    </option>
  </select>
  <textarea
    v-else-if="field.input === 'longtext' && !compact"
    ref="element"
    v-model="draft"
    rows="3"
    :class="base"
    :disabled="disabled"
    @focus="focused = true"
    @blur="onBlur"
    @keydown="onKeydown"
  />
  <template v-else>
    <input
      ref="element"
      v-model="draft"
      type="text"
      :class="base"
      :disabled="disabled"
      :list="field.suggestions?.length ? listId : undefined"
      :inputmode="['integer', 'money', 'percent', 'digits', 'zip', 'document', 'phone'].includes(field.input) ? 'decimal' : undefined"
      @focus="focused = true"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <datalist v-if="field.suggestions?.length" :id="listId">
      <option v-for="suggestion in field.suggestions" :key="suggestion" :value="suggestion" />
    </datalist>
  </template>
</template>
