<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../api/client';
import AppButton from '../components/AppButton.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import PageHeader from '../components/PageHeader.vue';
import TextField from '../components/TextField.vue';

const currentPassword = ref('');
const newPassword = ref('');
const error = ref('');
const saved = ref(false);
const saving = ref(false);

async function submit() {
  error.value = '';
  saved.value = false;
  saving.value = true;
  try {
    await api('/auth/change-password', {
      method: 'POST',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value },
    });
    currentPassword.value = '';
    newPassword.value = '';
    saved.value = true;
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <PageHeader title="Minha conta" description="Altere a senha usada para entrar." />

  <form
    class="max-w-md space-y-4 rounded-lg border border-line bg-white p-6"
    @submit.prevent="submit"
  >
    <ErrorMessage :message="error" />
    <p v-if="saved" role="status" class="text-sm text-success">
      Senha alterada. As outras sessões foram encerradas.
    </p>
    <TextField
      v-model="currentPassword"
      label="Senha atual"
      type="password"
      autocomplete="current-password"
      required
    />
    <TextField
      v-model="newPassword"
      label="Nova senha"
      type="password"
      autocomplete="new-password"
      hint="Pelo menos 10 caracteres."
      required
    />
    <AppButton type="submit" :loading="saving">Salvar senha</AppButton>
  </form>
</template>
