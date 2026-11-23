import { Injectable, Logger } from '@nestjs/common';
import { parseState, STATES } from './validators';

export interface CepAddress {
  street: string;
  district: string;
  city: string;
  state: string;
}

const DEFAULT_URL = 'https://viacep.com.br/ws';
const TIMEOUT_MS = 4000;

// Consulta o CEP no ViaCEP para completar cidade e UF (e rua e bairro, se vazios).
// Se o serviço não responder, o cadastro segue sem a consulta. Com
// CEP_LOOKUP_URL=off a consulta fica desligada (usado nos testes).
@Injectable()
export class CepLookup {
  private readonly logger = new Logger(CepLookup.name);
  private readonly cache = new Map<string, CepAddress | null>();

  async find(zip: string): Promise<CepAddress | null> {
    const base = process.env.CEP_LOOKUP_URL ?? DEFAULT_URL;
    if (base === 'off' || !/^\d{8}$/.test(zip)) return null;
    if (this.cache.has(zip)) return this.cache.get(zip)!;
    try {
      const response = await fetch(`${base}/${zip}/json/`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) return null;
      const body = (await response.json()) as Record<string, string | boolean>;
      const address =
        body.erro || !body.localidade
          ? null
          : {
              street: String(body.logradouro ?? ''),
              district: String(body.bairro ?? ''),
              city: String(body.localidade ?? ''),
              state: parseState(String(body.uf ?? '')),
            };
      this.cache.set(zip, address);
      return address;
    } catch (error) {
      this.logger.warn(`Consulta do CEP ${zip} falhou: ${(error as Error).message}`);
      return null;
    }
  }
}

type AddressRow = Record<string, unknown>;

// Completa o endereço pelo CEP (principal e de coleta). Quando o CEP acabou de
// mudar, rua, bairro, cidade e UF passam a ser os do CEP novo (CEP geral da
// cidade não tem rua nem bairro: esses ficam vazios para preencher). Sem troca
// de CEP, só completa o que estiver vazio. Campos que a pessoa alterou junto com
// o CEP nunca são trocados, a não ser a UF inválida (ex.: "SÃO PAULI" digitado errado
// na planilha), que o CEP sempre corrige.
export async function fillFromCep(row: AddressRow, changed: string[], lookup: Pick<CepLookup, 'find'>) {
  for (const prefix of ['main', 'pickup']) {
    const zip = row[`${prefix}Zip`];
    if (typeof zip !== 'string' || zip.length !== 8) continue;
    const zipChanged = changed.includes(`${prefix}Zip`);
    const validState = STATES.includes(String(row[`${prefix}State`] ?? ''));
    if (!zipChanged && row[`${prefix}City`] && validState) continue;

    const address = await lookup.find(zip);
    if (!address) continue;
    const fill: [string, string][] = [
      ['City', address.city],
      ['State', address.state],
      ['Street', address.street],
      ['District', address.district],
    ];
    for (const [suffix, value] of fill) {
      const key = `${prefix}${suffix}`;
      if (suffix === 'State' && !validState && value) {
        row[key] = value;
        continue;
      }
      if (changed.includes(key)) continue;
      if (zipChanged) row[key] = value || null;
      else if (value && !row[key]) row[key] = value;
    }
  }
}
