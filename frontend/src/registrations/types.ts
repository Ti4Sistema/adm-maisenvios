// Formatos devolvidos pela API de pré-cadastro. As regras ficam em
// backend/src/registrations/registration-rules.ts e chegam por /registrations/schema.

export type RegistrationType = 'client' | 'smart';
export type RegistrationStatus = 'draft' | 'ready' | 'approved';
export type FieldMode = 'required' | 'optional' | 'fixed' | 'calc' | 'send' | 'hidden';

export interface ServiceItem {
  code: string;
  spread: number | null;
  malha: number | null;
}

export type FieldValue = string | number | boolean | ServiceItem[] | null;

export interface TypeRule {
  mode: FieldMode;
  value?: FieldValue;
  default?: FieldValue;
  conditional: boolean;
}

export interface SchemaField {
  key: string;
  label: string;
  group: string;
  input: string;
  maxLength?: number;
  options?: { value: string; label: string }[];
  suggestions?: string[];
  hint?: string;
  // Só aparece quando este Sim/Não estiver ligado (ex.: campos da malha).
  shownWhen?: string;
  // Campo pouco usado: aparece recolhido até alguém abrir.
  rare?: boolean;
  client: TypeRule;
  smart: TypeRule;
}

export interface Schema {
  types: { key: RegistrationType; label: string }[];
  statuses: { key: RegistrationStatus; label: string }[];
  groups: { key: string; label: string }[];
  services: { code: string; name: string }[];
  // Serviços que cada tipo sempre tem: não dá para remover.
  fixedServices: Record<RegistrationType, string[]>;
  // Serviços sem spread: só a malha pode ser preenchida neles.
  noSpreadServices: string[];
  // Únicos serviços que aceitam Malha %.
  malhaServices: string[];
  fields: SchemaField[];
}

export interface Issue {
  field: string;
  message: string;
}

export interface Registration {
  id: string;
  type: RegistrationType;
  status: RegistrationStatus;
  values: Record<string, FieldValue>;
  suggested: Record<string, FieldValue>;
  missing: string[];
  errors: Issue[];
  warnings: Issue[];
  approvedAt: string | null;
  approvedBy: { id: string; name: string } | null;
  // Preenchido quando o pré-cadastro foi ocultado da lista principal.
  hiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FieldChange {
  field: string;
  from: FieldValue;
  to: unknown;
}
