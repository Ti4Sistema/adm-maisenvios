<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { PERMISSIONS } from '../auth/permissions';
import { can, currentAdministrator } from '../auth/session';
import PageHeader from '../components/PageHeader.vue';
</script>

<template>
  <PageHeader :title="`Olá, ${currentAdministrator?.name}`" />
  <RouterLink
    v-if="can(PERMISSIONS.REGISTRATIONS_READ)"
    to="/pre-cadastros"
    class="block max-w-md rounded-lg border border-line bg-white p-5 hover:border-brand"
  >
    <span class="block font-semibold text-brand">Pré-cadastros</span>
    <span class="mt-1 block text-sm text-muted">
      Clientes e Smart sendo preenchidos pela equipe, com o que falta em cada um.
    </span>
  </RouterLink>
  <p v-else class="text-sm text-muted">Seu usuário ainda não tem acesso aos pré-cadastros.</p>
</template>
