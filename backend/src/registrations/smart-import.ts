import { fold, splitStreet } from './validators';

// Colunas da planilha de Smart (A = 0). Ver docs/plano-pre-cadastro.md.
const COLUMN = {
  master: 1, // B
  tradeName: 2, // C
  legalName: 4, // E
  document: 5, // F
  done: 9, // J
  street: 17, // R
  district: 18, // S
  city: 19, // T
  state: 20, // U
  zip: 21, // V
  billing: 22, // W
  email: 23, // X
  contact: 24, // Y
  phone: 25, // Z
} as const;

const BILLING_WORDS: [string, string][] = [
  ['MENSAL', 'Faturamento Mensal'],
  ['QUINZ', 'Faturamento Quinzenal'],
  ['SEMAN', 'Faturamento Semanal'],
  ['DIA', 'Faturamento Diário'],
  ['VISTA', 'À VISTA'],
];

export interface MappedSmartRow {
  values: Record<string, string>;
  warnings: string[];
  skip?: string;
}

export function mapSmartRow(cells: string[]): MappedSmartRow {
  const cell = (index: number) => (cells[index] ?? '').replace(/\s+/g, ' ').trim();
  const warnings: string[] = [];

  if (fold(cell(COLUMN.tradeName)).includes('NOME FANTASIA')) {
    return { values: {}, warnings, skip: 'Linha de cabeçalho' };
  }
  if (!cell(COLUMN.tradeName) && !cell(COLUMN.legalName) && !cell(COLUMN.document)) {
    return { values: {}, warnings, skip: 'Linha sem nome e sem CNPJ' };
  }
  if (cells.length < 6) {
    return {
      values: {},
      warnings,
      skip: 'Poucas colunas: copie a linha inteira da planilha, da coluna A até a Z',
    };
  }

  const values: Record<string, string> = {
    masterLicense: cell(COLUMN.master),
    tradeName: cell(COLUMN.tradeName),
    legalName: cell(COLUMN.legalName),
    document: cell(COLUMN.document),
    mainDistrict: cell(COLUMN.district),
    mainCity: cell(COLUMN.city),
    mainState: cell(COLUMN.state),
    mainZip: cell(COLUMN.zip),
    billingEmail: cell(COLUMN.email),
    contactName: cell(COLUMN.contact),
    mobilePhone: cell(COLUMN.phone),
  };

  const { street, number, complement } = splitStreet(cell(COLUMN.street));
  Object.assign(values, { mainStreet: street, mainNumber: number, mainComplement: complement });
  if (street && !number) warnings.push('Número não encontrado na coluna R');

  const billing = fold(cell(COLUMN.billing));
  if (billing) {
    const match = BILLING_WORDS.find(([word]) => billing.includes(word));
    if (match) values.billingType = match[1];
    else warnings.push(`Faturamento "${cell(COLUMN.billing)}" não reconhecido; ficou Mensal`);
  }

  if (fold(cell(COLUMN.done)).includes('FEITO')) warnings.push('Já está marcada como FEITO na planilha');

  for (const key of Object.keys(values)) if (!values[key]) delete values[key];
  return { values, warnings };
}
