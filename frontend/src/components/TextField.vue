<script setup lang="ts">
import { useId } from 'vue';

defineProps<{
  label: string;
  type?: string;
  hint?: string;
  required?: boolean;
  autocomplete?: string;
}>();

const model = defineModel<string>({ default: '' });
const id = useId();
</script>

<template>
  <div>
    <label :for="id" class="mb-1 block text-sm font-medium">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      :type="type ?? 'text'"
      :required="required"
      :autocomplete="autocomplete"
      class="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
    />
    <p v-if="hint" class="mt-1 text-xs text-muted">{{ hint }}</p>
  </div>
</template>
