<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary';
    type?: 'button' | 'submit';
    loading?: boolean;
    disabled?: boolean;
  }>(),
  { variant: 'primary', type: 'button' },
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    :class="
      variant === 'primary'
        ? 'bg-brand text-white hover:bg-brand-dark'
        : 'border border-line bg-white text-ink hover:bg-surface'
    "
  >
    <slot />
  </button>
</template>
