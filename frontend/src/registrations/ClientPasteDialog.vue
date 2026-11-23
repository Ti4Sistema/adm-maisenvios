<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '../api/client';
import AppButton from '../components/AppButton.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import { formatValue } from './format';
import type { FieldValue, Schema } from './types';

interface Preview {
  id?: string;
  values: Record<string, FieldValue>;
  filled: string[];
}

const props = defineProps<{ schema: Schema }>();
const emit = defineEmits<{ created: [id: string] }>();

const dialog = ref<HTMLDialogElement>();
const text = ref('');
const preview = ref<Preview | null>(null);
const error = ref('');
const loading = ref(false);

// Campos lidos da ficha, na ordem em que aparecem na grade.
const filledFields = computed(() =>
  props.schema.fields.filter((field) => preview.value?.filled.includes(field.key)),
);

async function read(source = text.value) {
  text.value = source;
  error.value = '';
  preview.value = null;
  if (!source.trim()) return;
  loading.value = true;
  try {
    preview.value = await api<Preview>('/registrations/import/client', {
      method: 'POST',
      body: { text: source, dryRun: true },
    });
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
  read(pasted);
}

async function confirm() {
  loading.value = true;
  error.value = '';
  try {
    const result = await api<Preview>('/registrations/import/client', {
      method: 'POST',
      body: { text: text.value, dryRun: false },
    });
    dialog.value?.close();
    if (result.id) emit('created', result.id);
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    loading.value = false;
  }
}

function open(initial = '') {
  text.value = '';
  preview.value = null;
  error.value = '';
  dialog.value?.showModal();
  if (initial) read(initial);
}

defineExpose({ open });
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-lg border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-black/40"
  >
    <div class="space-y-4 p-6">
      <div>
        <h2 class="text-lg font-semibold">Colar ficha do cliente</h2>
        <p class="mt-1 text-sm text-muted">
          Cole o texto da ficha recebida (Razão Social, CNPJ, Endereço, CEP, Contato…). Os campos reconhecidos são
          preenchidos e o resto fica para completar no painel.
        </p>
      </div>

      <ErrorMessage :message="error" />

      <template v-if="!preview">
        <textarea
          v-model="text"
          rows="12"
          placeholder="Cole aqui (Ctrl+V)"
          class="w-full rounded-md border border-line px-3 py-2 font-mono text-xs focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
          @paste="onPaste"
        />
        <p v-if="loading" class="text-sm text-muted">Lendo a ficha…</p>
      </template>

      <div v-else class="max-h-[60vh] space-y-4 overflow-y-auto">
        <!-- A ficha vem sempre no mesmo formato e faltam sempre os mesmos campos:
             a prévia mostra só o que foi lido, sem faltas, erros ou avisos. -->
        <p class="text-sm text-muted">{{ preview.filled.length }} campo(s) lido(s) da ficha</p>

        <table class="w-full text-left text-sm">
          <tbody class="divide-y divide-line">
            <tr v-for="field in filledFields" :key="field.key">
              <th class="w-48 py-1.5 pr-3 align-top font-medium text-muted">{{ field.label }}</th>
              <td class="py-1.5">{{ formatValue(field, preview.values[field.key] ?? null) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          v-if="preview"
          type="button"
          class="mr-auto text-sm font-medium text-brand hover:underline"
          @click="preview = null"
        >
          Voltar ao texto
        </button>
        <AppButton variant="secondary" @click="dialog?.close()">Cancelar</AppButton>
        <AppButton v-if="!preview" :loading="loading" :disabled="!text.trim()" @click="read()">Ler ficha</AppButton>
        <AppButton v-else :loading="loading" @click="confirm">Criar pré-cadastro</AppButton>
      </div>
    </div>
  </dialog>
</template>
