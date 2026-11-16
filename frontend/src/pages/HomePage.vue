<script setup lang="ts">
import { currentAdministrator } from '../auth/session';
import PageHeader from '../components/PageHeader.vue';
</script>

<template>
  <PageHeader
    :title="`Olá, ${currentAdministrator?.name}`"
    description="Os cadastros vão aparecer aqui conforme forem criados."
  />
</template>
