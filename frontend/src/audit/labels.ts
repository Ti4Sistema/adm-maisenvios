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
  administrator: 'Administrador',
  administrator_role: 'Papel do administrador',
  // Valores gravados antes da troca de nome: a auditoria não pode ser alterada.
  user: 'Administrador',
  user_role: 'Papel do administrador',
};

const FIELDS: Record<string, string> = {
  name: 'Nome',
  email: 'E-mail',
  passwordHash: 'Senha',
  active: 'Ativo',
  role: 'Papel',
  administratorId: 'Administrador',
  userId: 'Administrador',
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
