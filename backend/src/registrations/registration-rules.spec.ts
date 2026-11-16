import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  defaultValues,
  effectiveValues,
  evaluate,
  FieldError,
  fieldRule,
  isComplete,
  normalizeValue,
  suggestedValues,
} from './registration-rules';
import { mapSmartRow } from './smart-import';
import { isValidCnpj, isValidCpf, parseDecimal, splitStreet } from './validators';

const CNPJ = '11222333000181';

const completeClient = {
  ...defaultValues('client'),
  tradeName: 'CEA MODAS',
  legalName: 'CEA MODAS LTDA',
  document: CNPJ,
  billingType: 'Faturamento Mensal',
  billingEmail: 'financeiro@cea.com.br',
  dueDays: 10,
  mainZip: '01310100',
  mainNumber: '498',
  packageTable: 'TABELA X',
  reverseTable: 'TABELA Y',
  postageContract: '9912701275',
  postageCard: '0079505163',
  creditLimit: 3_000_000,
  services: [{ code: '03298', spread: null, malha: null }],
  stateRegistration: 'ISENTO',
  municipalRegistration: '123',
};

const completeSmart = {
  ...defaultValues('smart'),
  tradeName: 'PDV SMART MAIS ENVIOS 005 GUI',
  legalName: 'GUI COMERCIO LTDA',
  document: CNPJ,
  masterLicense: 'MAIS ENVIOS 005',
  billingEmail: 'gui@teste.com',
  mainZip: '01310100',
  mainNumber: '498',
};

test('valida CPF e CNPJ pelos dígitos verificadores', () => {
  assert.equal(isValidCnpj(CNPJ), true);
  assert.equal(isValidCnpj('11222333000182'), false);
  assert.equal(isValidCpf('52998224725'), true);
  assert.equal(isValidCpf('11111111111'), false);
});

test('entende valores em reais escritos de vários jeitos', () => {
  assert.equal(parseDecimal('30.000,00'), 30000);
  assert.equal(parseDecimal('R$ 1.500'), 1500);
  assert.equal(parseDecimal('2,5%'), 2.5);
  assert.equal(parseDecimal('12.5'), 12.5);
  assert.equal(normalizeValue(fieldRule('creditLimit')!, '30.000,00'), 3_000_000);
});

test('separa rua, número e complemento da coluna R', () => {
  assert.deepEqual(splitStreet('RUA PAULISTA 498 CASA DOS FUNDOS'), {
    street: 'RUA PAULISTA',
    number: '498',
    complement: 'CASA DOS FUNDOS',
  });
  assert.deepEqual(splitStreet('RUA 7 DE SETEMBRO 100'), { street: 'RUA 7 DE SETEMBRO', number: '100', complement: '' });
  assert.deepEqual(splitStreet('AV BRASIL, 1500, LOJA 3'), { street: 'AV BRASIL', number: '1500', complement: 'LOJA 3' });
  assert.deepEqual(splitStreet('RUA SEM NUMERO'), { street: 'RUA SEM NUMERO', number: '', complement: '' });
});

test('aceita opções sem acento e recusa o que não existe', () => {
  assert.equal(normalizeValue(fieldRule('billingType')!, 'mensal'), 'Faturamento Mensal');
  assert.equal(normalizeValue(fieldRule('customerType')!, 'licenca'), 'Licença');
  assert.throws(() => normalizeValue(fieldRule('billingType')!, 'anual'), FieldError);
  assert.equal(normalizeValue(fieldRule('usesMalha')!, 'sim'), true);
  assert.deepEqual(normalizeValue(fieldRule('services')!, '3298, 03220;03298'), [
    { code: '03298', spread: null, malha: null },
    { code: '03220', spread: null, malha: null },
  ]);
});

test('um cliente completo fica pronto e um vazio lista o que falta', () => {
  assert.equal(isComplete(evaluate('client', completeClient)), true);
  const { missing } = evaluate('client', defaultValues('client'));
  for (const field of ['tradeName', 'document', 'billingEmail', 'mainZip', 'services', 'postageCard']) {
    assert.ok(missing.includes(field), field);
  }
});

test('no Smart, os campos fixos e os definidos no envio não são cobrados', () => {
  const evaluation = evaluate('smart', completeSmart);
  assert.deepEqual(evaluation.missing, []);
  assert.deepEqual(evaluation.errors, []);
  const values = effectiveValues('smart', completeSmart);
  assert.equal(values.insurance, 2);
  assert.equal(values.creditLimit, 3_000_000);
  assert.equal(values.billingDocument, CNPJ);
  assert.equal('beneficiary' in values, false);
});

test('sugere os logins do portal pelo nome fantasia', () => {
  assert.deepEqual(suggestedValues('smart', completeSmart), {
    billingDocument: CNPJ,
    adminLogin: 'admpdvsmartgui',
    pdvLogin: 'pdvsmartgui',
  });
  assert.equal(suggestedValues('client', { tradeName: 'Céa Modas' }).adminLogin, 'ceaadmin');
});

test('regras que impedem ficar pronto', () => {
  const longName = evaluate('client', { ...completeClient, tradeName: 'X'.repeat(31) });
  assert.equal(longName.errors[0].field, 'tradeName');

  const sameZip = evaluate('client', { ...completeClient, pickupZip: '01310100', pickupNumber: '1' });
  assert.ok(sameZip.errors.some(({ field }) => field === 'pickupZip'));

  const halfPickup = evaluate('client', { ...completeClient, pickupCity: 'São Paulo' });
  assert.ok(halfPickup.missing.includes('pickupZip'));

  const malha = evaluate('client', { ...completeClient, usesMalha: true });
  assert.ok(malha.missing.includes('malhaDiscount'));

  assert.equal(isComplete(evaluate('client', { ...completeClient, document: '11222333000182' })), false);
});

test('mapeia a linha colada da planilha Smart', () => {
  const cells = Array<string>(26).fill('');
  cells[1] = 'MAIS ENVIOS 005';
  cells[2] = 'PDV SMART MAIS ENVIOS 005 GUI';
  cells[4] = 'GUI COMERCIO LTDA';
  cells[5] = '11.222.333/0001-81';
  cells[9] = 'FEITO';
  cells[17] = 'RUA PAULISTA 498 CASA DOS FUNDOS';
  cells[21] = '01310-100';
  cells[22] = 'quinzenal';
  cells[23] = 'gui@teste.com';

  const { values, warnings, skip } = mapSmartRow(cells);
  assert.equal(skip, undefined);
  assert.equal(values.mainNumber, '498');
  assert.equal(values.billingType, 'Faturamento Quinzenal');
  assert.ok(warnings.some((warning) => warning.includes('FEITO')));

  const header = Array<string>(26).fill('');
  header[2] = 'Nome Fantasia';
  assert.ok(mapSmartRow(header).skip);
});
