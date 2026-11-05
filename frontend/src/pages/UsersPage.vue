<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../api/client';
import { PERMISSIONS } from '../auth/permissions';
import { can } from '../auth/session';
import AppButton from '../components/AppButton.vue';
import AppDialog from '../components/AppDialog.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import PageHeader from '../components/PageHeader.vue';
import TextField from '../components/TextField.vue';

interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roles: string[];
}

interface Role {
  key: string;
  name: string;
}

const users = ref<User[]>([]);
const roles = ref<Role[]>([]);
const loadError = ref('');

const dialog = ref<InstanceType<typeof AppDialog>>();
const editing = ref<User | null>(null);
const form = reactive({
  name: '',
  email: '',
  password: '',
  active: true,
  roles: [] as string[],
});
const saveError = ref('');
const saving = ref(false);

const canManage = computed(() => can(PERMISSIONS.USERS_MANAGE));

function roleName(key: string) {
  return roles.value.find((role) => role.key === key)?.name ?? key;
}

async function load() {
  try {
    [users.value, roles.value] = await Promise.all([
      api<User[]>('/users'),
      api<Role[]>('/roles'),
    ]);
  } catch (cause) {
    loadError.value = (cause as Error).message;
  }
}

function openForm(user: User | null) {
  editing.value = user;
  saveError.value = '';
  Object.assign(form, {
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    active: user?.active ?? true,
    roles: [...(user?.roles ?? [])],
  });
  dialog.value?.open();
}

async function save() {
  saveError.value = '';
  saving.value = true;
  const { name, email, password, active, roles: selectedRoles } = form;
  try {
    if (editing.value) {
      await api(`/users/${editing.value.id}`, {
        method: 'PATCH',
        body: {
          name,
          email,
          active,
          roles: selectedRoles,
          ...(password ? { password } : {}),
        },
      });
    } else {
      await api('/users', {
        method: 'POST',
        body: { name, email, password, roles: selectedRoles },
      });
    }
    dialog.value?.close();
    await load();
  } catch (cause) {
    saveError.value = (cause as Error).message;
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <PageHeader title="Usuários" description="Quem acessa o sistema e com quais papéis.">
    <AppButton v-if="canManage" @click="openForm(null)">Novo usuário</AppButton>
  </PageHeader>

  <ErrorMessage :message="loadError" />

  <div class="overflow-x-auto rounded-lg border border-line bg-white">
    <table class="w-full min-w-xl text-left text-sm">
      <thead class="border-b border-line text-xs text-muted">
        <tr>
          <th class="px-4 py-3 font-medium">Nome</th>
          <th class="px-4 py-3 font-medium">E-mail</th>
          <th class="px-4 py-3 font-medium">Papéis</th>
          <th class="px-4 py-3 font-medium">Situação</th>
          <th v-if="canManage" class="px-4 py-3" />
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        <tr v-for="user in users" :key="user.id">
          <td class="px-4 py-3 font-medium">{{ user.name }}</td>
          <td class="px-4 py-3 text-muted">{{ user.email }}</td>
          <td class="px-4 py-3">
            {{ user.roles.map(roleName).join(', ') || 'Sem papel' }}
          </td>
          <td class="px-4 py-3">
            <span :class="user.active ? 'text-success' : 'text-muted'">
              {{ user.active ? 'Ativo' : 'Inativo' }}
            </span>
          </td>
          <td v-if="canManage" class="px-4 py-3 text-right">
            <button
              type="button"
              class="text-sm font-medium text-brand hover:underline"
              @click="openForm(user)"
            >
              Editar
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <AppDialog ref="dialog" :title="editing ? 'Editar usuário' : 'Novo usuário'">
    <form class="space-y-4" @submit.prevent="save">
      <ErrorMessage :message="saveError" />
      <TextField v-model="form.name" label="Nome" required />
      <TextField v-model="form.email" label="E-mail" type="email" required />
      <TextField
        v-model="form.password"
        :label="editing ? 'Nova senha' : 'Senha inicial'"
        type="password"
        autocomplete="new-password"
        :required="!editing"
        :hint="
          editing
            ? 'Deixe em branco para manter a atual.'
            : 'Pelo menos 10 caracteres. Oriente o usuário a trocá-la no primeiro acesso.'
        "
      />

      <fieldset>
        <legend class="mb-1 text-sm font-medium">Papéis</legend>
        <label
          v-for="role in roles"
          :key="role.key"
          class="flex items-center gap-2 py-1 text-sm"
        >
          <input v-model="form.roles" type="checkbox" :value="role.key" />
          {{ role.name }}
        </label>
      </fieldset>

      <label v-if="editing" class="flex items-center gap-2 text-sm">
        <input v-model="form.active" type="checkbox" />
        Usuário ativo
      </label>

      <div class="flex justify-end gap-2 pt-2">
        <AppButton variant="secondary" @click="dialog?.close()">Cancelar</AppButton>
        <AppButton type="submit" :loading="saving">Salvar</AppButton>
      </div>
    </form>
  </AppDialog>
</template>
