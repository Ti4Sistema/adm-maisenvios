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

interface Administrator {
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

const administrators = ref<Administrator[]>([]);
const roles = ref<Role[]>([]);
const loadError = ref('');

const dialog = ref<InstanceType<typeof AppDialog>>();
const editing = ref<Administrator | null>(null);
const form = reactive({
  name: '',
  email: '',
  password: '',
  active: true,
  roles: [] as string[],
});
const saveError = ref('');
const saving = ref(false);

const canManage = computed(() => can(PERMISSIONS.ADMINISTRATORS_MANAGE));

function roleName(key: string) {
  return roles.value.find((role) => role.key === key)?.name ?? key;
}

async function load() {
  try {
    [administrators.value, roles.value] = await Promise.all([
      api<Administrator[]>('/administrators'),
      api<Role[]>('/roles'),
    ]);
  } catch (cause) {
    loadError.value = (cause as Error).message;
  }
}

function openForm(administrator: Administrator | null) {
  editing.value = administrator;
  saveError.value = '';
  Object.assign(form, {
    name: administrator?.name ?? '',
    email: administrator?.email ?? '',
    password: '',
    active: administrator?.active ?? true,
    roles: [...(administrator?.roles ?? [])],
  });
  dialog.value?.open();
}

async function save() {
  saveError.value = '';
  saving.value = true;
  const { name, email, password, active, roles: selectedRoles } = form;
  try {
    if (editing.value) {
      await api(`/administrators/${editing.value.id}`, {
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
      await api('/administrators', {
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
  <PageHeader title="Administradores" description="Quem acessa o sistema e com quais papéis.">
    <AppButton v-if="canManage" @click="openForm(null)">Novo administrador</AppButton>
  </PageHeader>

  <ErrorMessage :message="loadError" />

  <div class="overflow-x-auto rounded-2xl border border-line/70 bg-white shadow-sm">
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
        <tr v-for="administrator in administrators" :key="administrator.id">
          <td class="px-4 py-3 font-medium">{{ administrator.name }}</td>
          <td class="px-4 py-3 text-muted">{{ administrator.email }}</td>
          <td class="px-4 py-3">
            {{ administrator.roles.map(roleName).join(', ') || 'Sem papel' }}
          </td>
          <td class="px-4 py-3">
            <span :class="administrator.active ? 'text-success' : 'text-muted'">
              {{ administrator.active ? 'Ativo' : 'Inativo' }}
            </span>
          </td>
          <td v-if="canManage" class="px-4 py-3 text-right">
            <button
              type="button"
              class="text-sm font-medium text-brand hover:underline"
              @click="openForm(administrator)"
            >
              Editar
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <AppDialog ref="dialog" :title="editing ? 'Editar administrador' : 'Novo administrador'">
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
            : 'Pelo menos 10 caracteres. Oriente o administrador a trocá-la no primeiro acesso.'
        "
      />

      <fieldset>
        <legend class="mb-1 text-sm font-medium">Papéis</legend>
        <label v-for="role in roles" :key="role.key" class="flex items-center gap-2 py-1 text-sm">
          <input v-model="form.roles" type="checkbox" :value="role.key" />
          {{ role.name }}
        </label>
      </fieldset>

      <label v-if="editing" class="flex items-center gap-2 text-sm">
        <input v-model="form.active" type="checkbox" />
        Administrador ativo
      </label>

      <div class="flex justify-end gap-2 pt-2">
        <AppButton variant="secondary" @click="dialog?.close()">Cancelar</AppButton>
        <AppButton type="submit" :loading="saving">Salvar</AppButton>
      </div>
    </form>
  </AppDialog>
</template>
