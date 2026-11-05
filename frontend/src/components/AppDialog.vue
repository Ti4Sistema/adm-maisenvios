<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ title: string }>();

const dialog = ref<HTMLDialogElement>();

defineExpose({
  open: () => dialog.value?.showModal(),
  close: () => dialog.value?.close(),
});
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-black/40"
  >
    <div class="p-6">
      <h2 class="mb-4 text-lg font-semibold">{{ title }}</h2>
      <slot />
    </div>
  </dialog>
</template>
