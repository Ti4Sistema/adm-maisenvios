<script setup lang="ts">
defineProps<{ message: string }>();
</script>

<template>
  <p
    v-if="message"
    role="alert"
    class="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
  >
    {{ message }}
  </p>
</template>
