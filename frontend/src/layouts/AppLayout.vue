<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { PERMISSIONS } from '../auth/permissions';
import { can, currentUser, logout } from '../auth/session';

const router = useRouter();
const menuOpen = ref(false);

const links = computed(() =>
  [
    { to: '/', label: 'Início', visible: true },
    { to: '/usuarios', label: 'Usuários', visible: can(PERMISSIONS.USERS_READ) },
    { to: '/auditoria', label: 'Auditoria', visible: can(PERMISSIONS.AUDIT_READ) },
    { to: '/conta', label: 'Minha conta', visible: true },
  ].filter((link) => link.visible),
);

async function signOut() {
  await logout();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen md:flex">
    <aside class="bg-brand text-white md:flex md:w-60 md:shrink-0 md:flex-col">
      <div class="flex items-center justify-between px-5 py-4">
        <RouterLink to="/" class="leading-tight">
          <span class="block font-semibold">Mais Envios</span>
          <span class="block text-xs text-white/70">Administração</span>
        </RouterLink>
        <button
          type="button"
          class="rounded-md border border-white/30 px-3 py-1 text-sm md:hidden"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          Menu
        </button>
      </div>

      <div
        class="flex-1 flex-col justify-between md:flex"
        :class="menuOpen ? 'flex' : 'hidden'"
      >
        <nav class="space-y-1 px-3">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="block rounded-md px-3 py-2 text-sm text-white/85 hover:bg-white/10"
            exact-active-class="bg-white/15 font-medium text-white"
            @click="menuOpen = false"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <div class="border-t border-white/15 p-4 text-sm">
          <p class="truncate font-medium">{{ currentUser?.name }}</p>
          <p class="truncate text-xs text-white/70">{{ currentUser?.email }}</p>
          <button
            type="button"
            class="mt-2 text-xs text-white/85 underline hover:text-white"
            @click="signOut"
          >
            Sair
          </button>
        </div>
      </div>
    </aside>

    <main class="min-w-0 flex-1 p-4 md:p-8">
      <RouterView />
    </main>
  </div>
</template>
