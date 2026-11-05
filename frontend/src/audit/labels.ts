// Textos da tela de auditoria. O que não estiver aqui aparece com o valor gravado.
const ACTIONS: Record<string, string> = {
  create: 'Criou',
  update: 'Alterou',
  delete: 'Removeu',
  'auth.login': 'Entrou no sistema',
  'auth.logout': 'Saiu do sistema',
  'auth.login_failed': 'Login recusado',
  'access.denied': 'Acesso negado',
};

const ENTITIES: Record<string, string> = {
  user: 'Usuário',
  user_role: 'Papel do usuário',
};

const FIELDS: Record<string, string> = {
  name: 'Nome',
  email: 'E-mail',
  passwordHash: 'Senha',
  active: 'Ativo',
  role: 'Papel',
  userId: 'Usuário',
  method: 'Método',
  path: 'Rota',
  required: 'Permissão exigida',
};

export const auditActions = Object.entries(ACTIONS).map(([value, label]) => ({
  value,
  label,
}));

export const actionLabel = (action: string) => ACTIONS[action] ?? action;
export const entityLabel = (entity: string) => ENTITIES[entity] ?? entity;
export const fieldLabel = (field: string) => FIELDS[field] ?? field;
