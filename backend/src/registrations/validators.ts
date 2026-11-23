// Validações e conversões próprias, sem bibliotecas (regra do projeto).

export function digits(value: string) {
  return value.replace(/\D/g, '');
}

// Maiúsculas e sem acento, para comparar textos digitados com as opções.
export function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

function checkDigit(numbers: number[], weights: number[]) {
  const sum = numbers.reduce((total, n, i) => total + n * weights[i], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const n = [...value].map(Number);
  const first = (n.slice(0, 9).reduce((t, d, i) => t + d * (10 - i), 0) * 10) % 11 % 10;
  const second = (n.slice(0, 10).reduce((t, d, i) => t + d * (11 - i), 0) * 10) % 11 % 10;
  return first === n[9] && second === n[10];
}

export function isValidCnpj(value: string) {
  if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const n = [...value].map(Number);
  const first = checkDigit(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === n[12] && second === n[13];
}

export function isValidDocument(value: string) {
  return value.length === 11 ? isValidCpf(value) : isValidCnpj(value);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const STATE_NAMES: Record<string, string> = {
  ACRE: 'AC', ALAGOAS: 'AL', AMAPA: 'AP', AMAZONAS: 'AM', BAHIA: 'BA', CEARA: 'CE',
  'DISTRITO FEDERAL': 'DF', BRASILIA: 'DF', 'ESPIRITO SANTO': 'ES', GOIAS: 'GO', MARANHAO: 'MA',
  'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS', 'MINAS GERAIS': 'MG', PARA: 'PA', PARAIBA: 'PB',
  PARANA: 'PR', PERNAMBUCO: 'PE', PIAUI: 'PI', 'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS', RONDONIA: 'RO', RORAIMA: 'RR', 'SANTA CATARINA': 'SC', 'SAO PAULO': 'SP',
  SERGIPE: 'SE', TOCANTINS: 'TO',
};

// Converte "São Paulo", "sp", "Estado do Rio de Janeiro" ou "SP - São Paulo" na
// sigla. Se não reconhecer, devolve o texto em maiúsculas (e a regra acusa UF inválida).
export function parseState(raw: string): string {
  const text = fold(raw)
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (STATES.includes(text)) return text;
  const name = text.replace(/^ESTADO (DE|DO|DA) /, '');
  if (STATE_NAMES[name]) return STATE_NAMES[name];
  // "SP SAO PAULO" ou "SAO PAULO SP": vale a sigla se ela bater com o nome ao lado.
  const codes = text.split(' ').filter((word) => STATES.includes(word));
  if (codes.length === 1) {
    const rest = text.split(' ').filter((word) => word !== codes[0]).join(' ');
    if (!rest || STATE_NAMES[rest] === codes[0]) return codes[0];
  }
  // Nome com uma letra errada ("SAO PAULI", "PERNANBUCO"): vale o estado mais
  // parecido. Só para nomes compridos, para não confundir PARA com PARANA.
  if (name.length >= 6) {
    const close = Object.keys(STATE_NAMES).filter((known) => known.length >= 6 && oneEditApart(name, known));
    if (close.length === 1) return STATE_NAMES[close[0]];
  }
  return raw.trim().toUpperCase();
}

// Diferença de no máximo uma letra (trocada, a mais ou a menos).
function oneEditApart(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// Aceita "30.000,00", "30000", "R$ 30.000", "1.5" e devolve o número.
export function parseDecimal(raw: string): number | null {
  let text = raw.replace(/R\$|%|\s/gi, '');
  if (!text) return null;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return NaN;
  return Number(text);
}

const TRUE_WORDS = ['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO', 'LIGADO', 'OK'];
const FALSE_WORDS = ['NAO', 'N', '0', 'FALSE', 'FALSO', 'DESLIGADO'];

export function parseBoolean(raw: unknown): boolean | null | undefined {
  if (typeof raw === 'boolean') return raw;
  const text = fold(String(raw));
  if (!text) return null;
  if (TRUE_WORDS.includes(text)) return true;
  if (FALSE_WORDS.includes(text)) return false;
  return undefined;
}

// Logins do portal: minúsculos, sem acento e sem símbolos.
export function loginWord(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function words(value: string) {
  return value.split(/\s+/).map(loginWord).filter(Boolean);
}

const COMPLEMENT_WORDS = [
  'APTO', 'APT', 'APARTAMENTO', 'BLOCO', 'CASA', 'SALA', 'LOJA', 'LOTE', 'QUADRA', 'CONJUNTO',
  'ANDAR', 'FUNDOS', 'FRENTE', 'BOX', 'GALPAO', 'TERREO', 'SOBRELOJA', 'EDIFICIO', 'TORRE', 'UNIDADE',
];

// Separa "RUA PAULISTA 498 CASA DOS FUNDOS" ou "RUA X, 123, APTO 4" em rua, número e complemento.
export function splitStreet(raw: string) {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return { street: '', number: '', complement: '' };

  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    const numberPart = parts[1].replace(/^(N[º°O.]?|NUMERO)\s*/i, '');
    const match = /^(\d+[A-Z]?|S\/?N)\b\s*(.*)$/i.exec(numberPart);
    if (match) {
      const complement = [match[2], ...parts.slice(2)].filter(Boolean).join(', ');
      return { street: parts[0], number: match[1].toUpperCase(), complement };
    }
  }

  const tokens = text.split(' ');
  const isNumber = (token: string) => /^(N[º°]?)?\d+[A-Z]?$/i.test(token) || /^S\/?N$/i.test(token);
  const isComplement = (token?: string) =>
    token !== undefined && COMPLEMENT_WORDS.includes(fold(token).replace(/[.:]/g, ''));

  const candidates = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token, index }) => index > 0 && isNumber(token) && !isComplement(tokens[index - 1]));
  if (!candidates.length) return { street: text, number: '', complement: '' };

  // O número é o primeiro seguido de fim de texto ou de uma palavra de complemento;
  // assim "RUA 7 DE SETEMBRO 100" fica com 100, e não com 7.
  const chosen =
    candidates.find(({ index }) => index === tokens.length - 1 || isComplement(tokens[index + 1])) ??
    candidates[candidates.length - 1];
  return {
    street: tokens.slice(0, chosen.index).join(' '),
    number: chosen.token.replace(/^N[º°]?/i, '').toUpperCase(),
    complement: tokens.slice(chosen.index + 1).join(' '),
  };
}
