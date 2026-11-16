import {
  digits,
  fold,
  isValidDocument,
  isValidEmail,
  loginWord,
  parseBoolean,
  parseDecimal,
  STATES,
  words,
} from './validators';

// Único lugar com os campos do pré-cadastro e as regras de cada tipo.
// A API valida e calcula pendências por aqui, e o frontend monta a grade
// com o que GET /registrations/schema devolve.

export const REGISTRATION_TYPES = { client: 'Cliente', smart: 'Smart' } as const;
export type RegistrationType = keyof typeof REGISTRATION_TYPES;

export const REGISTRATION_STATUSES = {
  draft: 'Rascunho',
  ready: 'Pronto',
  approved: 'Aprovado',
} as const;
export type RegistrationStatus = keyof typeof REGISTRATION_STATUSES;

export const FIELD_GROUPS = {
  main: 'Dados principais',
  billing: 'Faturamento',
  mainAddress: 'Endereço principal',
  pickupAddress: 'Endereço de coleta',
  contract: 'Contratos',
  services: 'Serviços',
  fiscal: 'Dados fiscais',
  contacts: 'Contatos',
  malha: 'Malha',
  portal: 'Usuários do portal',
  notes: 'Observações',
} as const;
export type FieldGroup = keyof typeof FIELD_GROUPS;

export interface ServiceItem {
  code: string;
  spread: number | null;
  malha: number | null;
}

export type FieldValue = string | number | boolean | ServiceItem[] | null;

export type FieldInput =
  | 'text'
  | 'longtext'
  | 'digits'
  | 'document'
  | 'email'
  | 'zip'
  | 'phone'
  | 'state'
  | 'integer'
  | 'money'
  | 'percent'
  | 'boolean'
  | 'select'
  | 'services'
  | 'login';

// required/optional: editável. fixed: valor definido pela regra. calc: calculado de
// outro campo. send: escolhido na integração. hidden: não existe neste tipo.
export type FieldMode = 'required' | 'optional' | 'fixed' | 'calc' | 'send' | 'hidden';

export interface TypeRule {
  mode: FieldMode;
  value?: FieldValue;
  default?: FieldValue;
  // Obrigatório só quando a condição vale (ex.: campos da malha).
  requiredWhen?: (values: FieldValues) => boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  aliases?: string[];
}

export interface FieldRule {
  key: string;
  label: string;
  group: FieldGroup;
  input: FieldInput;
  maxLength?: number;
  options?: SelectOption[];
  suggestions?: string[];
  hint?: string;
  client: TypeRule;
  smart: TypeRule;
}

export type FieldValues = Record<string, FieldValue>;

export interface Issue {
  field: string;
  message: string;
}

const required: TypeRule = { mode: 'required' };
const optional: TypeRule = { mode: 'optional' };
const hidden: TypeRule = { mode: 'hidden' };
const send: TypeRule = { mode: 'send' };
const fixed = (value: FieldValue): TypeRule => ({ mode: 'fixed', value });
const usesMalha = (values: FieldValues) => values.usesMalha === true;

export const DEFAULT_BENEFICIARY = 'MAIS ENVIOS INTELIGENCIA LOGISTICA LTDA';
export const SMART_PACKAGE_TABLE = 'TABELA MAIS ENVIOS À VISTA - PROMOCAO DE INAUGURAÇÃO';
export const SMART_REVERSE_TABLE = 'TABELA MAIS ENVIOS À VISTA';

export const KNOWN_SERVICES: Record<string, string> = {
  '03298': '+Econômico',
  '03220': '+Expresso',
  '04227': '+Econômico Mini',
  '03158': '+Expresso 10',
  '03140': '+Expresso 12',
};

const SMART_SERVICES: ServiceItem[] = Object.keys(KNOWN_SERVICES).map((code) => ({
  code,
  spread: null,
  malha: null,
}));

const BILLING_TYPES: SelectOption[] = [
  { value: 'Faturamento Mensal', label: 'Mensal', aliases: ['MENSAL'] },
  { value: 'Faturamento Quinzenal', label: 'Quinzenal', aliases: ['QUINZENAL'] },
  { value: 'Faturamento Semanal', label: 'Semanal', aliases: ['SEMANAL'] },
  { value: 'Faturamento Diário', label: 'Diário', aliases: ['DIARIO'] },
  { value: 'À VISTA', label: 'À vista', aliases: ['A VISTA', 'AVISTA'] },
];

const CUSTOMER_TYPES: SelectOption[] = [
  { value: 'Cliente', label: 'Cliente' },
  { value: 'Licença', label: 'Licença', aliases: ['LICENCA'] },
  { value: 'Filial', label: 'Filial' },
];

const STATE_OPTIONS: SelectOption[] = STATES.map((uf) => ({ value: uf, label: uf }));

function address(prefix: 'main' | 'pickup', group: FieldGroup, smart: boolean): FieldRule[] {
  const client = prefix === 'main' ? required : optional;
  const smartRule = (rule: TypeRule) => (smart ? rule : hidden);
  return [
    { key: `${prefix}Zip`, label: 'CEP', group, input: 'zip', client, smart: smartRule(required) },
    { key: `${prefix}Number`, label: 'Número', group, input: 'text', client, smart: smartRule(required) },
    { key: `${prefix}Complement`, label: 'Complemento', group, input: 'text', client: optional, smart: smartRule(optional) },
    {
      key: `${prefix}Street`,
      label: 'Rua',
      group,
      input: 'text',
      hint: 'O portal completa pelo CEP; aqui é só para conferência.',
      client: optional,
      smart: smartRule(optional),
    },
    { key: `${prefix}District`, label: 'Bairro', group, input: 'text', client: optional, smart: smartRule(optional) },
    { key: `${prefix}City`, label: 'Cidade', group, input: 'text', client: optional, smart: smartRule(optional) },
    { key: `${prefix}State`, label: 'UF', group, input: 'state', options: STATE_OPTIONS, client: optional, smart: smartRule(optional) },
    {
      key: `${prefix}AddressName`,
      label: 'Identificação',
      group,
      input: 'text',
      hint: 'Nome do endereço no portal. Vazio usa o nome fantasia.',
      client: optional,
      smart: smartRule(optional),
    },
  ];
}

export const FIELDS: FieldRule[] = [
  {
    key: 'tradeName',
    label: 'Nome Fantasia',
    group: 'main',
    input: 'text',
    maxLength: 30,
    hint: 'Máximo de 30 caracteres no portal.',
    client: required,
    smart: required,
  },
  { key: 'legalName', label: 'Razão Social', group: 'main', input: 'text', client: required, smart: required },
  { key: 'document', label: 'CPF/CNPJ', group: 'main', input: 'document', client: required, smart: required },
  {
    key: 'customerType',
    label: 'Tipo Cliente',
    group: 'main',
    input: 'select',
    options: CUSTOMER_TYPES,
    client: { mode: 'required', default: 'Cliente' },
    smart: fixed('Cliente'),
  },
  {
    key: 'masterLicense',
    label: 'Licença master',
    group: 'main',
    input: 'text',
    hint: 'Ex.: MAIS ENVIOS 005',
    client: hidden,
    smart: required,
  },

  {
    key: 'billingType',
    label: 'Tipo de faturamento',
    group: 'billing',
    input: 'select',
    options: BILLING_TYPES,
    client: required,
    smart: { mode: 'required', default: 'Faturamento Mensal' },
  },
  { key: 'billingEmail', label: 'E-mail financeiro', group: 'billing', input: 'email', client: required, smart: required },
  { key: 'dueDays', label: 'Dias a vencer', group: 'billing', input: 'integer', client: required, smart: fixed(10) },
  {
    key: 'beneficiary',
    label: 'Beneficiário',
    group: 'billing',
    input: 'text',
    suggestions: [DEFAULT_BENEFICIARY],
    client: { mode: 'required', default: DEFAULT_BENEFICIARY },
    smart: send,
  },

  ...address('main', 'mainAddress', true),
  ...address('pickup', 'pickupAddress', false),

  {
    key: 'packageTable',
    label: 'Tabela Pacote',
    group: 'contract',
    input: 'text',
    suggestions: [SMART_PACKAGE_TABLE, SMART_REVERSE_TABLE],
    client: required,
    smart: fixed(SMART_PACKAGE_TABLE),
  },
  {
    key: 'reverseTable',
    label: 'Tabela Pacote Reversa',
    group: 'contract',
    input: 'text',
    suggestions: [SMART_REVERSE_TABLE],
    client: required,
    smart: fixed(SMART_REVERSE_TABLE),
  },
  { key: 'postageContract', label: 'Contrato de postagem', group: 'contract', input: 'digits', client: required, smart: send },
  {
    key: 'postageCard',
    label: 'Cartão de postagem',
    group: 'contract',
    input: 'digits',
    hint: 'Sempre enviado como principal.',
    client: required,
    smart: send,
  },
  {
    key: 'billingDocument',
    label: 'CNPJ de faturamento',
    group: 'contract',
    input: 'document',
    hint: 'Vazio usa o CPF/CNPJ do cliente.',
    client: optional,
    smart: { mode: 'calc' },
  },
  { key: 'creditLimit', label: 'Limite de crédito', group: 'contract', input: 'money', client: required, smart: fixed(3_000_000) },
  { key: 'insurance', label: 'Seguro (%)', group: 'contract', input: 'percent', client: { mode: 'required', default: 1 }, smart: fixed(2) },
  {
    key: 'reverseValidityDays',
    label: 'Validade da reversa (dias)',
    group: 'contract',
    input: 'integer',
    client: { mode: 'required', default: 90 },
    smart: { mode: 'required', default: 90 },
  },
  {
    key: 'skipPostageCost',
    label: 'Não cobrar custo de postagem',
    group: 'contract',
    input: 'boolean',
    client: { mode: 'optional', default: false },
    smart: fixed(false),
  },
  { key: 'logicalLabels', label: 'Permitir etiquetas lógicas', group: 'contract', input: 'boolean', client: optional, smart: hidden },
  {
    key: 'separateBranchInvoice',
    label: 'Boleto separado para a filial',
    group: 'contract',
    input: 'boolean',
    client: optional,
    smart: hidden,
  },

  {
    key: 'services',
    label: 'Serviços',
    group: 'services',
    input: 'services',
    hint: 'Códigos separados por vírgula. % de spread e malha no painel da linha.',
    client: required,
    smart: fixed(SMART_SERVICES),
  },

  { key: 'stateRegistration', label: 'Inscrição Estadual', group: 'fiscal', input: 'text', client: optional, smart: hidden },
  { key: 'municipalRegistration', label: 'Inscrição Municipal', group: 'fiscal', input: 'text', client: optional, smart: hidden },
  {
    key: 'whatsappNotifications',
    label: 'Notificações via WhatsApp',
    group: 'fiscal',
    input: 'boolean',
    client: optional,
    smart: fixed(true),
  },
  { key: 'unifiedLabel', label: 'Etiqueta unificada DANFE/DC-e', group: 'fiscal', input: 'boolean', client: optional, smart: fixed(false) },
  { key: 'forceDce', label: 'Emitir DC-e nas integrações', group: 'fiscal', input: 'boolean', client: optional, smart: fixed(false) },

  { key: 'contactName', label: 'Nome do contato', group: 'contacts', input: 'text', client: optional, smart: optional },
  { key: 'mobilePhone', label: 'Telefone celular', group: 'contacts', input: 'phone', client: optional, smart: optional },
  { key: 'businessPhone', label: 'Telefone comercial', group: 'contacts', input: 'phone', client: optional, smart: hidden },
  { key: 'homePhone', label: 'Telefone residencial', group: 'contacts', input: 'phone', client: optional, smart: hidden },
  { key: 'website', label: 'Site', group: 'contacts', input: 'text', client: optional, smart: hidden },

  { key: 'usesMalha', label: 'Utiliza malha', group: 'malha', input: 'boolean', client: { mode: 'optional', default: false }, smart: fixed(false) },
  {
    key: 'malhaAllUnits',
    label: 'Todas as unidades',
    group: 'malha',
    input: 'boolean',
    client: { mode: 'optional', requiredWhen: usesMalha },
    smart: hidden,
  },
  {
    key: 'malhaDiscount',
    label: 'Desconto malha (%)',
    group: 'malha',
    input: 'percent',
    client: { mode: 'optional', requiredWhen: usesMalha },
    smart: hidden,
  },
  {
    key: 'declarationContent',
    label: 'Declaração: conteúdo',
    group: 'malha',
    input: 'text',
    client: { mode: 'optional', requiredWhen: usesMalha },
    smart: hidden,
  },
  {
    key: 'declarationQuantity',
    label: 'Declaração: quantidade',
    group: 'malha',
    input: 'integer',
    client: { mode: 'optional', requiredWhen: usesMalha },
    smart: hidden,
  },
  {
    key: 'declarationValue',
    label: 'Declaração: valor',
    group: 'malha',
    input: 'money',
    client: { mode: 'optional', requiredWhen: usesMalha },
    smart: hidden,
  },

  {
    key: 'adminLogin',
    label: 'Login admin',
    group: 'portal',
    input: 'login',
    hint: 'Sugerido a partir do nome fantasia. A senha é gerada pelo portal no envio.',
    client: required,
    smart: required,
  },
  {
    key: 'pdvLogin',
    label: 'Login PDV',
    group: 'portal',
    input: 'login',
    hint: 'Sugerido a partir do nome fantasia. A senha é gerada pelo portal no envio.',
    client: hidden,
    smart: required,
  },

  { key: 'notes', label: 'Observações', group: 'notes', input: 'longtext', client: optional, smart: optional },
];

export const FIELD_KEYS = FIELDS.map(({ key }) => key);
const FIELD_MAP = new Map(FIELDS.map((field) => [field.key, field]));

export function fieldRule(key: string) {
  return FIELD_MAP.get(key);
}

export function ruleFor(field: FieldRule, type: RegistrationType) {
  return field[type];
}

export function isEditable(field: FieldRule, type: RegistrationType) {
  const { mode } = ruleFor(field, type);
  return mode === 'required' || mode === 'optional';
}

export function defaultValues(type: RegistrationType): FieldValues {
  const values: FieldValues = {};
  for (const field of FIELDS) {
    const rule = ruleFor(field, type);
    if (rule.default !== undefined) values[field.key] = rule.default;
  }
  return values;
}

export class FieldError extends Error {}

// Converte o que foi digitado ou colado no formato gravado. Só recusa o que não
// dá para entender; regras como CPF válido viram pendência na linha.
export function normalizeValue(field: FieldRule, raw: unknown): FieldValue {
  if (raw === null || raw === undefined) return null;
  if (field.input === 'services') return normalizeServices(raw);
  if (typeof raw === 'object') throw new FieldError('valor inválido');

  const text = String(raw).trim();
  if (field.input === 'boolean') {
    const value = parseBoolean(raw);
    if (value === undefined) throw new FieldError('use Sim ou Não');
    return value;
  }
  if (!text) return null;

  switch (field.input) {
    case 'text':
    case 'longtext':
      return text.replace(/\s+/g, field.input === 'text' ? ' ' : '$&');
    case 'login':
      return text.toLowerCase();
    case 'email':
      return text.toLowerCase();
    case 'state':
      return text.toUpperCase();
    case 'digits':
    case 'document':
    case 'zip':
    case 'phone': {
      const value = digits(text);
      if (!value) throw new FieldError('informe apenas números');
      return value;
    }
    case 'integer': {
      const value = parseDecimal(text);
      if (value === null) return null;
      if (!Number.isInteger(value) || value < 0) throw new FieldError('informe um número inteiro');
      return value;
    }
    case 'money': {
      const value = parseDecimal(text);
      if (value === null) return null;
      if (Number.isNaN(value) || value < 0) throw new FieldError('informe um valor em reais');
      return Math.round(value * 100);
    }
    case 'percent': {
      const value = parseDecimal(text);
      if (value === null) return null;
      if (Number.isNaN(value) || value < 0 || value > 100) throw new FieldError('informe um percentual entre 0 e 100');
      return Math.round(value * 100) / 100;
    }
    case 'select': {
      const wanted = fold(text);
      const option = field.options?.find(
        (o) => fold(o.value) === wanted || fold(o.label) === wanted || o.aliases?.includes(wanted),
      );
      if (!option) {
        throw new FieldError(`use uma destas opções: ${field.options?.map((o) => o.label).join(', ')}`);
      }
      return option.value;
    }
  }
  return text;
}

function normalizePercent(raw: unknown) {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = typeof raw === 'number' ? raw : parseDecimal(String(raw));
  if (value === null) return null;
  if (Number.isNaN(value) || value < 0 || value > 100) throw new FieldError('percentual inválido');
  return Math.round(value * 100) / 100;
}

function normalizeServices(raw: unknown): ServiceItem[] | null {
  const items: ServiceItem[] = [];
  if (typeof raw === 'string') {
    for (const code of raw.split(/[\s,;]+/).filter(Boolean)) {
      items.push({ code, spread: null, malha: null });
    }
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') throw new FieldError('serviço inválido');
      const { code, spread, malha } = item as Record<string, unknown>;
      items.push({ code: String(code ?? '').trim(), spread: normalizePercent(spread), malha: normalizePercent(malha) });
    }
  } else {
    throw new FieldError('serviços inválidos');
  }

  const seen = new Set<string>();
  const result: ServiceItem[] = [];
  for (const item of items) {
    const code = digits(item.code).padStart(5, '0');
    if (!/^\d{5}$/.test(code)) throw new FieldError(`código de serviço inválido: ${item.code}`);
    if (seen.has(code)) continue;
    seen.add(code);
    result.push({ ...item, code });
  }
  return result.length ? result : null;
}

// Valores calculados quando o campo está vazio: o usuário pode sobrescrever.
export function suggestedValues(type: RegistrationType, values: FieldValues): FieldValues {
  const suggested: FieldValues = {};
  const name = typeof values.tradeName === 'string' ? words(values.tradeName) : [];

  if (!values.billingDocument && values.document) suggested.billingDocument = values.document;
  if (!values.adminLogin && name.length) {
    suggested.adminLogin = type === 'smart' ? `admpdvsmart${name[name.length - 1]}` : `${name[0]}admin`;
  }
  if (type === 'smart' && !values.pdvLogin && name.length) {
    suggested.pdvLogin = `pdvsmart${name[name.length - 1]}`;
  }
  return suggested;
}

// O valor que vale para o tipo: fixo, calculado, gravado ou sugerido.
export function effectiveValues(type: RegistrationType, stored: FieldValues): FieldValues {
  const suggested = suggestedValues(type, stored);
  const values: FieldValues = {};
  for (const field of FIELDS) {
    const rule = ruleFor(field, type);
    if (rule.mode === 'hidden' || rule.mode === 'send') continue;
    if (rule.mode === 'fixed') values[field.key] = rule.value ?? null;
    else values[field.key] = stored[field.key] ?? suggested[field.key] ?? null;
  }
  return values;
}

function isEmpty(value: FieldValue | undefined) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length);
}

export interface Evaluation {
  missing: string[];
  errors: Issue[];
  warnings: Issue[];
}

// O que falta, o que está errado (impede ficar Pronto) e os pontos de atenção.
export function evaluate(type: RegistrationType, stored: FieldValues): Evaluation {
  const values = effectiveValues(type, stored);
  const missing: string[] = [];
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const has = (key: string) => key in values;
  const text = (key: string) => (typeof values[key] === 'string' ? (values[key] as string) : '');

  for (const field of FIELDS) {
    const rule = ruleFor(field, type);
    const mustFill = rule.mode === 'required' || (rule.mode === 'optional' && rule.requiredWhen?.(values));
    if (mustFill && isEmpty(values[field.key])) missing.push(field.key);
  }

  if (text('tradeName').length > 30) {
    errors.push({ field: 'tradeName', message: 'O portal aceita no máximo 30 caracteres' });
  }
  for (const key of ['document', 'billingDocument']) {
    const value = text(key);
    if (value && ![11, 14].includes(value.length)) errors.push({ field: key, message: 'Informe 11 (CPF) ou 14 (CNPJ) dígitos' });
    else if (value && !isValidDocument(value)) errors.push({ field: key, message: 'CPF/CNPJ inválido' });
  }
  if (type === 'client' && stored.billingDocument && stored.billingDocument !== stored.document) {
    warnings.push({ field: 'billingDocument', message: 'CNPJ de faturamento diferente do CPF/CNPJ do cliente' });
  }
  if (text('billingEmail') && !isValidEmail(text('billingEmail'))) {
    errors.push({ field: 'billingEmail', message: 'E-mail inválido' });
  }
  if (has('dueDays') && values.dueDays === 0) errors.push({ field: 'dueDays', message: 'Informe pelo menos 1 dia' });

  for (const prefix of ['main', 'pickup']) {
    const zip = text(`${prefix}Zip`);
    if (zip && zip.length !== 8) errors.push({ field: `${prefix}Zip`, message: 'O CEP tem 8 dígitos' });
    const state = text(`${prefix}State`);
    if (state && !STATES.includes(state)) errors.push({ field: `${prefix}State`, message: 'UF inválida' });
  }
  const pickupFilled = FIELDS.some(
    (f) => f.group === 'pickupAddress' && has(f.key) && !isEmpty(values[f.key]),
  );
  if (pickupFilled) {
    for (const key of ['pickupZip', 'pickupNumber']) if (isEmpty(values[key])) missing.push(key);
    if (text('pickupZip') && text('pickupZip') === text('mainZip')) {
      errors.push({ field: 'pickupZip', message: 'O portal não aceita dois endereços com o mesmo CEP' });
    }
  }

  for (const key of ['mobilePhone', 'businessPhone', 'homePhone']) {
    const phone = text(key);
    if (phone && phone.length < 10) warnings.push({ field: key, message: 'Telefone sem DDD' });
  }
  if (type === 'client') {
    if (!values.stateRegistration) warnings.push({ field: 'stateRegistration', message: 'Inscrição Estadual vazia' });
    if (!values.municipalRegistration) warnings.push({ field: 'municipalRegistration', message: 'Inscrição Municipal vazia' });
  }
  for (const key of ['adminLogin', 'pdvLogin']) {
    const login = text(key);
    if (login && login !== loginWord(login)) {
      errors.push({ field: key, message: 'Use só letras minúsculas sem acento e números' });
    }
  }
  if (values.adminLogin && values.adminLogin === values.pdvLogin) {
    errors.push({ field: 'pdvLogin', message: 'Os dois logins precisam ser diferentes' });
  }

  return { missing: [...new Set(missing)], errors, warnings };
}

export function isComplete({ missing, errors }: Evaluation) {
  return !missing.length && !errors.length;
}

// O que o frontend precisa para montar a grade, sem as funções internas.
export function publicSchema() {
  return {
    types: Object.entries(REGISTRATION_TYPES).map(([key, label]) => ({ key, label })),
    statuses: Object.entries(REGISTRATION_STATUSES).map(([key, label]) => ({ key, label })),
    groups: Object.entries(FIELD_GROUPS).map(([key, label]) => ({ key, label })),
    services: Object.entries(KNOWN_SERVICES).map(([code, name]) => ({ code, name })),
    fields: FIELDS.map(({ client, smart, options, ...field }) => ({
      ...field,
      options: options?.map(({ value, label }) => ({ value, label })),
      client: publicTypeRule(client),
      smart: publicTypeRule(smart),
    })),
  };
}

function publicTypeRule({ mode, value, default: initial, requiredWhen }: TypeRule) {
  return { mode, value, default: initial, conditional: Boolean(requiredWhen) };
}
