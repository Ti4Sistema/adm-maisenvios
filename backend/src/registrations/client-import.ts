import { BILLING_WORDS } from './smart-import';
import { digits, fold, splitStreet } from './validators';

// Lê a ficha em texto que chega para cadastrar um cliente, no formato
// "Rótulo: valor" por linha, por exemplo:
//
//   Razão Social: Botica de Rossi Farmácia de Manipulação LTDA
//   CNPJ: 01.847.298/0004-85
//   Endereço: Rua Doutor Julio Olivier, 389
//   Coletas: Sim
//   Endereço de Coleta: Rua Doutor Julio Olivier, 389 Centro Macaé 27913161
//   Contato:
//   Nome: Paulo Filho
//
// Linhas sem valor ("Contato:") abrem uma seção. Rótulos sem acento e em
// qualquer caixa. O que não for reconhecido vira aviso, nunca erro.

type Target =
  | 'legalName'
  | 'tradeName'
  | 'document'
  | 'address'
  | 'mainNumber'
  | 'mainComplement'
  | 'mainZip'
  | 'mainDistrict'
  | 'mainCity'
  | 'mainState'
  | 'stateRegistration'
  | 'municipalRegistration'
  | 'website'
  | 'pickupWanted'
  | 'pickupAddress'
  | 'contactName'
  | 'phone'
  | 'email'
  | 'billingType';

const LABELS: [string[], Target][] = [
  [['RAZAO SOCIAL', 'NOME EMPRESARIAL'], 'legalName'],
  [['NOME FANTASIA', 'FANTASIA'], 'tradeName'],
  [['CNPJ', 'CPF', 'CPF/CNPJ', 'CNPJ/CPF', 'DOCUMENTO'], 'document'],
  [['ENDERECO', 'LOGRADOURO', 'RUA', 'ENDERECO PRINCIPAL'], 'address'],
  [['NUMERO', 'NO', 'N'], 'mainNumber'],
  [['COMPLEMENTO'], 'mainComplement'],
  [['CEP'], 'mainZip'],
  [['BAIRRO'], 'mainDistrict'],
  [['CIDADE', 'MUNICIPIO'], 'mainCity'],
  [['UF', 'ESTADO'], 'mainState'],
  [['INSCRICAO ESTADUAL', 'IE'], 'stateRegistration'],
  [['INSCRICAO MUNICIPAL', 'IM'], 'municipalRegistration'],
  [['SITE', 'WEBSITE'], 'website'],
  [['COLETAS', 'COLETA'], 'pickupWanted'],
  [['ENDERECO DE COLETA', 'ENDERECO DA COLETA', 'ENDERECO COLETA', 'LOCAL DE COLETA'], 'pickupAddress'],
  [['NOME', 'CONTATO', 'NOME DO CONTATO', 'RESPONSAVEL'], 'contactName'],
  [['TELEFONE', 'CELULAR', 'WHATSAPP', 'FONE', 'TEL'], 'phone'],
  [['EMAIL', 'E-MAIL', 'E MAIL', 'EMAIL FINANCEIRO', 'E-MAIL FINANCEIRO'], 'email'],
  [['FATURAMENTO', 'TIPO DE FATURAMENTO'], 'billingType'],
];

const TARGET_BY_LABEL = new Map(LABELS.flatMap(([labels, target]) => labels.map((label) => [label, target])));

export interface MappedClientText {
  values: Record<string, string>;
  warnings: string[];
  recognized: number;
}

function labelKey(label: string) {
  return fold(label)
    .replace(/[º°.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const CEP_PATTERN = /(\d{5})-?(\d{3})(?!\d)/;

export function mapClientText(text: string): MappedClientText {
  const read: Partial<Record<Target, string>> = {};
  const warnings: string[] = [];
  let recognized = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    const match = /^([^:]{1,40}):\s*(.*)$/.exec(line);
    if (!match) continue; // Títulos como "CADASTRO DE NOVO CLIENTE".
    const [, label, value] = match;
    if (!value) continue; // Seção, como "Contato:".

    const target = TARGET_BY_LABEL.get(labelKey(label));
    if (!target) {
      warnings.push(`Não reconheci "${label.trim()}"; o valor "${value}" não foi usado`);
      continue;
    }
    if (read[target] !== undefined) {
      warnings.push(`"${label.trim()}" aparece mais de uma vez; usei o primeiro valor`);
      continue;
    }
    read[target] = value;
    recognized += 1;
  }

  const values: Record<string, string> = {};
  const set = (key: string, value: string | undefined) => {
    if (value?.trim()) values[key] = value.trim();
  };

  set('legalName', read.legalName);
  // Sem Nome Fantasia na ficha, vale a Razão Social.
  set('tradeName', read.tradeName ?? read.legalName);
  if (!read.tradeName && read.legalName) warnings.push('Ficha sem Nome Fantasia; usei a Razão Social');
  set('document', read.document);
  set('mainZip', read.mainZip);
  set('mainDistrict', read.mainDistrict);
  set('mainCity', read.mainCity);
  set('mainState', read.mainState);
  set('stateRegistration', read.stateRegistration);
  set('municipalRegistration', read.municipalRegistration);
  set('website', read.website);
  set('contactName', read.contactName);

  if (read.address) {
    const { street, number, complement } = splitStreet(read.address);
    set('mainStreet', street);
    set('mainNumber', number);
    set('mainComplement', complement);
    if (street && !number && !read.mainNumber) warnings.push('Número do endereço não encontrado');
  }
  set('mainNumber', read.mainNumber ?? values.mainNumber);
  set('mainComplement', read.mainComplement ?? values.mainComplement);

  if (read.email) {
    set('billingEmail', read.email);
    if (!/FINANCEIRO/.test(fold(text))) warnings.push('O e-mail da ficha foi usado como e-mail financeiro; confira');
  }

  if (read.phone) {
    const [first, ...others] = read.phone.split(/\/|;| ou /i);
    const phone = digits(first);
    // Celular tem 11 dígitos com o 9 depois do DDD; fixo tem 10.
    set(phone.length === 11 && phone[2] === '9' ? 'mobilePhone' : 'businessPhone', first);
    if (others.length) warnings.push(`Mais de um telefone na ficha; usei ${first.trim()}`);
  }

  if (read.billingType) {
    const billing = fold(read.billingType);
    const found = BILLING_WORDS.find(([word]) => billing.includes(word));
    if (found) values.billingType = found[1];
    else warnings.push(`Faturamento "${read.billingType}" não reconhecido`);
  }

  mapPickup(read, values, warnings);
  return { values, warnings, recognized };
}

// O endereço de coleta só vira coleta quando é diferente do principal: o portal
// não aceita coleta com o mesmo CEP.
function mapPickup(read: Partial<Record<Target, string>>, values: Record<string, string>, warnings: string[]) {
  const wanted = read.pickupWanted ? fold(read.pickupWanted) : '';
  if (wanted.startsWith('N')) return;
  const raw = read.pickupAddress?.trim();
  if (!raw) {
    if (wanted.startsWith('S')) warnings.push('Ficha marca coletas, mas sem endereço de coleta');
    return;
  }

  const cepMatch = CEP_PATTERN.exec(raw);
  const pickupZip = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : '';
  const mainZip = digits(values.mainZip ?? '');
  const withoutZip = raw.replace(CEP_PATTERN, '').replace(/[\s,-]+$/, '').trim();
  const { street, number } = splitStreet(withoutZip.split(',').slice(0, 2).join(','));
  const sameStreet =
    !!values.mainStreet && fold(street) === fold(values.mainStreet) && number === (values.mainNumber ?? '');

  if ((pickupZip && pickupZip === mainZip) || (!pickupZip && sameStreet)) {
    warnings.push('Coleta no mesmo endereço principal; não precisa de endereço de coleta');
    return;
  }

  setIfPresent(values, 'hasPickupAddress', 'Sim');
  setIfPresent(values, 'pickupZip', pickupZip);
  setIfPresent(values, 'pickupStreet', street);
  setIfPresent(values, 'pickupNumber', number);
  warnings.push(`Endereço de coleta lido de "${raw}"; confira rua, número e complemento`);
}

function setIfPresent(values: Record<string, string>, key: string, value: string) {
  if (value) values[key] = value;
}
