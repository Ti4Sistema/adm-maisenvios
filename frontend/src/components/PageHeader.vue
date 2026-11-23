<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <!-- Fica sobre a faixa azul do topo, por isso o texto é branco. -->
  <header class="mb-6 flex flex-wrap items-end justify-between gap-3 text-white">
    <div class="min-w-0">
      <h1 class="text-2xl font-bold tracking-tight md:text-3xl">{{ title }}</h1>
      <p v-if="description" class="mt-1 max-w-3xl text-sm text-white/75">{{ description }}</p>
    </div>
    <slot />
  </header>
</template>
