<script setup lang="ts">
import { currentUser } from '../auth/session';
import PageHeader from '../components/PageHeader.vue';
</script>

<template>
  <PageHeader
    :title="`Olá, ${currentUser?.name}`"
    description="Os cadastros vão aparecer aqui conforme forem criados."
  />
</template>
