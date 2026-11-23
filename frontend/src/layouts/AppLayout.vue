<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { PERMISSIONS } from '../auth/permissions';
import { can, currentAdministrator, logout } from '../auth/session';
import NavIcon from '../components/NavIcon.vue';

interface NavLink {
  to: string;
  label: string;
  icon: string;
  color: string;
}
interface NavItem {
  label: string;
  to?: string;
  children?: NavLink[];
}

const router = useRouter();
const route = useRoute();
// Menu suspenso aberto no computador (Pré-cadastros ou a conta) e menu do celular.
const openMenu = ref<string | null>(null);
const mobileOpen = ref(false);
const navbar = ref<HTMLElement>();

const items = computed(() => {
  const result: NavItem[] = [{ label: 'Início', to: '/' }];
  if (can(PERMISSIONS.REGISTRATIONS_READ)) {
    result.push({
      label: 'Pré-cadastros',
      children: [
        { to: '/pre-cadastros/clientes', label: 'Clientes', icon: 'users', color: 'bg-orange-500' },
        { to: '/pre-cadastros/smart', label: 'Smart', icon: 'store', color: 'bg-indigo-500' },
      ],
    });
  }
  if (can(PERMISSIONS.ADMINISTRATORS_READ)) result.push({ label: 'Administradores', to: '/administradores' });
  if (can(PERMISSIONS.AUDIT_READ)) result.push({ label: 'Auditoria', to: '/auditoria' });
  return result;
});

function isActive(item: NavItem) {
  if (item.to) return route.path === item.to;
  return item.children?.some(({ to }) => route.path === to) ?? false;
}

function toggle(menu: string) {
  openMenu.value = openMenu.value === menu ? null : menu;
}

const initial = computed(() => currentAdministrator.value?.name?.charAt(0).toUpperCase() ?? '');

// Fecha os menus ao trocar de página, ao clicar fora ou com Esc.
watch(
  () => route.fullPath,
  () => {
    openMenu.value = null;
    mobileOpen.value = false;
  },
);

function onDocumentClick(event: MouseEvent) {
  if (!navbar.value?.contains(event.target as Node)) openMenu.value = null;
}
function onDocumentKey(event: KeyboardEvent) {
  if (event.key === 'Escape') openMenu.value = null;
}
onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onDocumentKey);
});

async function signOut() {
  await logout();
  router.push('/login');
}

const pillClass =
  'rounded-full px-4 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white';
const pillActive = '!bg-white !text-brand shadow-sm';
const menuClass =
  'absolute top-full z-50 mt-2 min-w-56 overflow-hidden rounded-xl border border-line bg-white p-1.5 text-ink shadow-xl';
const menuItemClass = 'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface';
const mobileLinkClass = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/10';
</script>

<template>
  <div class="relative min-h-screen">
    <!-- Faixa azul atrás do topo da página; o conteúdo sobe por cima dela. -->
    <div class="bg-hero pointer-events-none absolute inset-x-0 top-0 h-64" aria-hidden="true" />

    <header ref="navbar" class="bg-hero sticky top-0 z-40">
      <div class="flex h-16 items-center gap-6 px-4 md:px-8">
        <RouterLink to="/" class="flex shrink-0 items-baseline gap-2 text-white">
          <span class="text-2xl font-extrabold tracking-tight italic"> <span class="text-accent">+</span>Envios </span>
          <span class="hidden text-xs font-medium text-white/60 lg:inline">Administração</span>
        </RouterLink>

        <!-- Computador -->
        <nav class="hidden items-center gap-0.5 rounded-full bg-white/10 p-1 ring-1 ring-white/10 md:flex">
          <template v-for="item in items" :key="item.label">
            <RouterLink v-if="item.to" :to="item.to" :class="[pillClass, isActive(item) && pillActive]">
              {{ item.label }}
            </RouterLink>
            <div v-else class="relative">
              <button
                type="button"
                class="flex items-center gap-1"
                :class="[pillClass, isActive(item) && pillActive]"
                :aria-expanded="openMenu === item.label"
                aria-haspopup="true"
                @click="toggle(item.label)"
              >
                {{ item.label }}
                <NavIcon name="chevron" class="!h-4 !w-4" />
              </button>
              <div v-if="openMenu === item.label" :class="menuClass">
                <RouterLink
                  v-for="child in item.children"
                  :key="child.to"
                  :to="child.to"
                  :class="[menuItemClass, route.path === child.to && 'bg-surface font-semibold']"
                >
                  <span class="flex h-8 w-8 items-center justify-center rounded-lg text-white" :class="child.color">
                    <NavIcon :name="child.icon" class="!h-4 !w-4" />
                  </span>
                  {{ child.label }}
                </RouterLink>
              </div>
            </div>
          </template>
        </nav>

        <div class="relative ml-auto hidden md:block">
          <button
            type="button"
            class="flex items-center gap-2 rounded-full bg-white/10 py-1 pr-3 pl-1 text-sm text-white ring-1 ring-white/10 hover:bg-white/15"
            :aria-expanded="openMenu === 'account'"
            aria-haspopup="true"
            @click="toggle('account')"
          >
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold">
              {{ initial }}
            </span>
            <span class="max-w-40 truncate font-semibold">{{ currentAdministrator?.name }}</span>
            <NavIcon name="chevron" class="!h-4 !w-4 text-white/70" />
          </button>
          <div v-if="openMenu === 'account'" :class="[menuClass, 'right-0']">
            <p class="truncate border-b border-line px-2.5 pt-1 pb-2 text-xs text-muted">
              {{ currentAdministrator?.email }}
            </p>
            <RouterLink to="/conta" :class="menuItemClass">
              <NavIcon name="key" class="!h-4 !w-4 text-muted" />
              Minha conta
            </RouterLink>
            <button type="button" :class="menuItemClass" @click="signOut">
              <NavIcon name="logout" class="!h-4 !w-4 text-muted" />
              Sair
            </button>
          </div>
        </div>

        <!-- Celular -->
        <button
          type="button"
          class="ml-auto rounded-full p-2 text-white hover:bg-white/10 md:hidden"
          :aria-label="mobileOpen ? 'Fechar menu' : 'Abrir menu'"
          :aria-expanded="mobileOpen"
          @click="mobileOpen = !mobileOpen"
        >
          <NavIcon :name="mobileOpen ? 'close' : 'menu'" />
        </button>
      </div>

      <nav v-if="mobileOpen" class="space-y-1 border-t border-white/10 px-4 py-3 md:hidden">
        <template v-for="item in items" :key="item.label">
          <RouterLink
            v-if="item.to"
            :to="item.to"
            :class="[mobileLinkClass, isActive(item) && 'bg-white/15 font-semibold text-white']"
          >
            {{ item.label }}
          </RouterLink>
          <template v-else>
            <p class="px-3 pt-2 text-[11px] font-semibold tracking-wide text-white/50 uppercase">{{ item.label }}</p>
            <RouterLink
              v-for="child in item.children"
              :key="child.to"
              :to="child.to"
              :class="[mobileLinkClass, route.path === child.to && 'bg-white/15 font-semibold text-white']"
            >
              <span class="flex h-7 w-7 items-center justify-center rounded-lg text-white" :class="child.color">
                <NavIcon :name="child.icon" class="!h-4 !w-4" />
              </span>
              {{ child.label }}
            </RouterLink>
          </template>
        </template>
        <div class="mt-2 border-t border-white/10 pt-2">
          <p class="truncate px-3 text-sm font-semibold text-white">{{ currentAdministrator?.name }}</p>
          <p class="truncate px-3 pb-1 text-xs text-white/60">{{ currentAdministrator?.email }}</p>
          <RouterLink to="/conta" :class="[mobileLinkClass, route.path === '/conta' && 'bg-white/15 text-white']">
            Minha conta
          </RouterLink>
          <button type="button" class="w-full text-left" :class="mobileLinkClass" @click="signOut">Sair</button>
        </div>
      </nav>
    </header>

    <main class="relative min-w-0 px-4 pt-6 pb-8 md:px-8">
      <RouterView />
    </main>
  </div>
</template>
