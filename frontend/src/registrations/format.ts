import type { FieldValue, Registration, SchemaField, ServiceItem, TypeRule } from './types';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function ruleOf(field: SchemaField, row: Registration): TypeRule {
  return field[row.type];
}

export function isEditableMode(rule: TypeRule) {
  return rule.mode === 'required' || rule.mode === 'optional';
}

// Campo que depende de um Sim/Não (coleta, malha) só aparece com ele ligado.
export function isShown(field: SchemaField, row: Registration) {
  return !field.shownWhen || row.values[field.shownWhen] === true;
}

// O valor que aparece na célula e se ele é só uma sugestão do sistema.
export function cellValue(field: SchemaField, row: Registration): { value: FieldValue; suggested: boolean } {
  const rule = ruleOf(field, row);
  // Fixo: vale o da regra, a não ser que tenha sido alterado neste cadastro.
  if (rule.mode === 'fixed') return { value: row.values[field.key] ?? rule.value ?? null, suggested: false };
  const stored = row.values[field.key] ?? null;
  if (stored !== null) return { value: stored, suggested: false };
  const suggestion = row.suggested[field.key] ?? null;
  return { value: suggestion, suggested: suggestion !== null };
}

function maskDocument(value: string) {
  if (value.length === 11) return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (value.length === 14) return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return value;
}

function maskPhone(value: string) {
  if (value.length === 11) return value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (value.length === 10) return value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return value;
}

export function serviceCodes(value: FieldValue) {
  return Array.isArray(value) ? value.map((item) => item.code).join(', ') : '';
}

export function formatValue(field: SchemaField, value: FieldValue): string {
  if (value === null || value === undefined || value === '') return '';
  switch (field.input) {
    case 'document':
      return maskDocument(String(value));
    case 'zip':
      return String(value).replace(/^(\d{5})(\d{3})$/, '$1-$2');
    case 'phone':
      return maskPhone(String(value));
    case 'money':
      return money.format(Number(value) / 100);
    case 'percent':
      return `${percent.format(Number(value))}%`;
    case 'boolean':
      return value ? 'Sim' : 'Não';
    case 'select':
      return field.options?.find((option) => option.value === value)?.label ?? String(value);
    case 'services':
      return serviceCodes(value);
    default:
      return String(value);
  }
}

// Texto que vai para o campo de edição.
export function editText(field: SchemaField, value: FieldValue): string {
  if (value === null || value === undefined) return '';
  switch (field.input) {
    case 'money':
      return decimal.format(Number(value) / 100);
    case 'percent':
      return percent.format(Number(value));
    case 'boolean':
      return value ? 'Sim' : 'Não';
    case 'services':
      return serviceCodes(value);
    case 'document':
    case 'zip':
    case 'phone':
      return formatValue(field, value);
    default:
      return String(value);
  }
}

// Padrão do cadastro de clientes: o limite de crédito é sempre 50% acima do valor digitado
// (5.000 vira 7.500). Só vale para valor novo digitado no campo; texto que não é número
// segue como está para a API apontar o erro.
export function withCreditMargin(text: string): string {
  let clean = text.replace(/R\$|\s/gi, '');
  if (clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) clean = clean.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(clean)) return text;
  return decimal.format(Math.round(Number(clean) * 150) / 100);
}

// Ao editar a lista de códigos, mantém o spread e a malha dos serviços que continuam.
export function servicesFromText(text: string, current: FieldValue): ServiceItem[] {
  const existing = Array.isArray(current) ? current : [];
  return text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((raw) => {
      const code = raw.replace(/\D/g, '').padStart(5, '0');
      return existing.find((item) => item.code === code) ?? { code: raw, spread: null, malha: null };
    });
}

// Lê o texto copiado do Excel ou do Google Sheets: colunas separadas por tabulação
// e células com quebra de linha entre aspas.
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/\r\n?/g, '\n');

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === '\t') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

export const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800',
  ready: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
};
