<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login } from '../auth/session';
import AppButton from '../components/AppButton.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import TextField from '../components/TextField.vue';

const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await login(email.value, password.value);
    const { redirect } = route.query;
    await router.push(typeof redirect === 'string' ? redirect : '/');
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center">
        <p class="text-2xl font-semibold text-brand">Mais Envios</p>
        <p class="text-sm text-muted">Administração</p>
      </div>

      <form
        class="space-y-4 rounded-lg border border-line bg-white p-6"
        @submit.prevent="submit"
      >
        <ErrorMessage :message="error" />
        <TextField
          v-model="email"
          label="E-mail"
          type="email"
          autocomplete="username"
          required
        />
        <TextField
          v-model="password"
          label="Senha"
          type="password"
          autocomplete="current-password"
          required
        />
        <AppButton type="submit" :loading="loading" class="w-full">Entrar</AppButton>
      </form>
    </div>
  </div>
</template>
