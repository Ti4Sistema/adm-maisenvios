<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-xl font-semibold">{{ title }}</h1>
      <p v-if="description" class="mt-1 text-sm text-muted">{{ description }}</p>
    </div>
    <slot />
  </header>
</template>
