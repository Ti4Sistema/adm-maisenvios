import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { fillFromCep } from './cep-lookup';
import {
  autoLogins,
  CLIENT_SERVICE_CODES,
  defaultValues,
  effectiveValues,
  evaluate,
  FieldError,
  fieldRule,
  isComplete,
  isShown,
  normalizeValue,
  suggestedValues,
} from './registration-rules';
import { mapClientText } from './client-import';
import { mapSmartRow } from './smart-import';
import { isValidCnpj, isValidCpf, parseDecimal, parseState, splitStreet } from './validators';

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
  packageTable: 'TABELA MAIS ENVIOS 1',
  reverseTable: 'TABELA MAIS ENVIOS 2',
  postageContract: '9912701275',
  postageCard: '0079505155',
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
  assert.deepEqual(splitStreet('RUA 7 DE SETEMBRO 100'), {
    street: 'RUA 7 DE SETEMBRO',
    number: '100',
    complement: '',
  });
  assert.deepEqual(splitStreet('AV BRASIL, 1500, LOJA 3'), {
    street: 'AV BRASIL',
    number: '1500',
    complement: 'LOJA 3',
  });
  assert.deepEqual(splitStreet('RUA SEM NUMERO'), { street: 'RUA SEM NUMERO', number: '', complement: '' });
});

test('lê a ficha de cliente colada em texto', () => {
  const { values, warnings } = mapClientText(
    [
      'CADASTRO DE NOVO CLIENTE - MAIS ENVIOS',
      'Dados Cadastrais:',
      'Razão Social: Botica de Rossi Farmácia de Manipulação LTDA',
      'CNPJ: 01.847.298/0004-85',
      'Endereço: Rua Doutor Julio Olivier, 389',
      'CEP: 27913-161',
      'Bairro: Centro',
      'Coletas: Sim',
      'Endereço de Coleta: Rua Doutor Julio Olivier, 389 Centro Macaé 27913161',
      'Contato:',
      'Nome: Paulo FIlho',
      'Telefone: (21) 99758-0469',
      'Email: ti@boticaderossi.com.br',
    ].join('\r\n'),
  );
  assert.deepEqual(values, {
    legalName: 'Botica de Rossi Farmácia de Manipulação LTDA',
    tradeName: 'Botica de Rossi Farmácia de Manipulação LTDA',
    document: '01.847.298/0004-85',
    mainZip: '27913-161',
    mainDistrict: 'Centro',
    contactName: 'Paulo FIlho',
    mainStreet: 'Rua Doutor Julio Olivier',
    mainNumber: '389',
    billingEmail: 'ti@boticaderossi.com.br',
    mobilePhone: '(21) 99758-0469',
  });
  assert.ok(warnings.some((warning) => warning.includes('mesmo endereço')));

  const other = mapClientText(
    'Endereço: Rua A, 10\nCEP: 01310-100\nColetas: Sim\nEndereço de Coleta: Rua B, 20 - 04538-133',
  );
  assert.equal(other.values.pickupZip, '04538133');
  assert.equal(other.values.pickupStreet, 'Rua B');
  assert.equal(other.values.pickupNumber, '20');
  assert.equal(mapClientText('Telefone: (11) 3333-4444').values.businessPhone, '(11) 3333-4444');
});

test('converte o nome do estado na sigla da UF', () => {
  const uf = fieldRule('mainState')!;
  assert.equal(normalizeValue(uf, 'São Paulo'), 'SP');
  assert.equal(normalizeValue(uf, 'rio de janeiro'), 'RJ');
  assert.equal(normalizeValue(uf, 'Mato Grosso do Sul'), 'MS');
  assert.equal(normalizeValue(uf, 'Estado do Paraná'), 'PR');
  assert.equal(normalizeValue(uf, 'Brasília'), 'DF');
  assert.equal(normalizeValue(uf, 'mg'), 'MG');
  assert.equal(normalizeValue(uf, 'SP - São Paulo'), 'SP');
  assert.equal(normalizeValue(uf, 'Goiás (GO)'), 'GO');
  assert.equal(normalizeValue(uf, 'Narnia'), 'NARNIA');
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
  for (const field of ['tradeName', 'document', 'billingEmail', 'mainZip', 'packageTable']) {
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

  const sameZip = evaluate('client', {
    ...completeClient,
    hasPickupAddress: true,
    pickupZip: '01310100',
    pickupNumber: '1',
  });
  assert.ok(sameZip.errors.some(({ field }) => field === 'pickupZip'));

  const pickupOn = evaluate('client', { ...completeClient, hasPickupAddress: true });
  assert.ok(pickupOn.missing.includes('pickupZip'));
  assert.ok(pickupOn.missing.includes('pickupNumber'));

  // Malha ligada não cobra nada: os campos dela são fixos.
  const malha = evaluate('client', { ...completeClient, usesMalha: true });
  assert.equal(isComplete(malha), true);

  assert.equal(isComplete(evaluate('client', { ...completeClient, document: '11222333000182' })), false);
});

test('coleta e malha desligadas escondem e não cobram os campos que dependem delas', () => {
  const leftovers = { ...completeClient, hasPickupAddress: false, pickupZip: '01310100', usesMalha: false };
  const evaluation = evaluate('client', leftovers);
  assert.equal(isComplete(evaluation), true);
  assert.ok(!evaluation.missing.includes('malhaDiscount'));
  assert.equal(isShown(fieldRule('pickupCity')!, leftovers), false);
  assert.equal(isShown(fieldRule('malhaDiscount')!, { usesMalha: true }), true);
  assert.equal(isShown(fieldRule('hasPickupAddress')!, leftovers), true);
});

test('no Cliente, dias a vencer, seguro e validade são fixos e o CNPJ de faturamento repete o do cliente', () => {
  const values = effectiveValues('client', { ...completeClient, billingDocument: '99999999000199', dueDays: null });
  assert.equal(values.dueDays, 10);
  assert.equal(values.insurance, 1);
  assert.equal(values.reverseValidityDays, 90);
  assert.equal(values.billingDocument, CNPJ);
  assert.equal(values.postageContract, '9912701275');
  assert.equal(values.postageCard, '0079505155');
  assert.equal(fieldRule('notes')!.client.mode, 'hidden');
  assert.equal(mapClientText('Razão Social: A LTDA\nNome Fantasia: A').values.tradeName, 'A');
  const defaults = defaultValues('client');
  assert.equal(defaults.whatsappNotifications, true);
  assert.equal(defaults.unifiedLabel, true);
  assert.equal(defaults.forceDce, false);
  assert.equal(defaults.maisEnviosLabel, false);
  assert.equal(defaults.requireRecipientDocument, false);
  assert.equal(defaults.logicalLabels, false);
  assert.equal(defaults.separateBranchInvoice, false);
  assert.equal(defaults.hasPickupAddress, false);
  assert.equal(fieldRule('mainAddressName'), undefined);
  assert.deepEqual(evaluate('client', completeClient).warnings, []);
});

test('corta o Nome Fantasia em 30 caracteres e preenche os logins pela sugestão', () => {
  const name = normalizeValue(fieldRule('tradeName')!, 'Botica de Rossi Farmácia de Manipulação LTDA');
  assert.equal(name, 'Botica de Rossi Farmácia de Ma');
  assert.equal(normalizeValue(fieldRule('tradeName')!, 'X'.repeat(29) + ' Y'), 'X'.repeat(29));

  // Vazio: preenche. Nome mudou e o login era o automático: acompanha.
  assert.deepEqual(autoLogins('client', {}, { tradeName: 'Botica de Rossi' }, ['tradeName']), {
    adminLogin: 'boticaadmin',
  });
  assert.deepEqual(
    autoLogins('client', { tradeName: 'Botica' }, { tradeName: 'Rossi', adminLogin: 'boticaadmin' }, ['tradeName']),
    { adminLogin: 'rossiadmin' },
  );
  // Login digitado por alguém não é trocado.
  assert.deepEqual(
    autoLogins('client', { tradeName: 'Botica' }, { tradeName: 'Rossi', adminLogin: 'outro' }, ['tradeName']),
    {},
  );
  assert.deepEqual(autoLogins('client', {}, { tradeName: 'Botica', adminLogin: 'x' }, ['adminLogin']), {});
  assert.deepEqual(autoLogins('smart', {}, { tradeName: 'PDV SMART GUI' }, ['tradeName']), {
    adminLogin: 'admpdvsmartgui',
    pdvLogin: 'pdvsmartgui',
  });
});

test('todo Cliente começa com os 9 serviços padrão, e dá para tirar um quando preciso', () => {
  const codes = (value: unknown) => (value as { code: string }[]).map(({ code }) => code);
  assert.deepEqual(codes(defaultValues('client').services), CLIENT_SERVICE_CODES);
  assert.equal(CLIENT_SERVICE_CODES.length, 9);

  const withoutOne = CLIENT_SERVICE_CODES.filter((code) => code !== '04227').map((code) => ({ code }));
  assert.deepEqual(
    codes(normalizeValue(fieldRule('services')!, withoutOne)),
    CLIENT_SERVICE_CODES.filter((c) => c !== '04227'),
  );
});

test('UF digitada errada na planilha: reconhece o estado ou o CEP corrige', async () => {
  assert.equal(parseState('SÃO PAULI'), 'SP');
  assert.equal(parseState('Pernanbuco'), 'PE');
  assert.equal(parseState('Paraná'), 'PR');
  assert.equal(parseState('Pará'), 'PA');
  assert.equal(parseState('XYZABC'), 'XYZABC');

  const lookup = { find: async () => ({ street: 'Rua Paulista', district: 'Conceição', city: 'Osasco', state: 'SP' }) };
  const pasted: Record<string, unknown> = { mainZip: '06140030', mainCity: 'OSASCO', mainState: 'ESTADO X' };
  await fillFromCep(pasted, ['mainZip', 'mainCity', 'mainState'], lookup);
  assert.equal(pasted.mainState, 'SP');
  assert.equal(pasted.mainCity, 'OSASCO');
});

test('completa cidade e UF pelo CEP sem trocar o que a pessoa digitou', async () => {
  const lookup = {
    find: async () => ({ street: 'Rua Doutor Júlio Olivier', district: 'Centro', city: 'Macaé', state: 'RJ' }),
  };
  const fromForm: Record<string, unknown> = { mainZip: '27913161', mainStreet: 'Rua Doutor Julio Olivier' };
  await fillFromCep(fromForm, ['mainStreet', 'mainZip'], lookup);
  assert.equal(fromForm.mainCity, 'Macaé');
  assert.equal(fromForm.mainState, 'RJ');
  assert.equal(fromForm.mainDistrict, 'Centro');
  assert.equal(fromForm.mainStreet, 'Rua Doutor Julio Olivier');

  const untouched: Record<string, unknown> = { mainZip: '27913161', mainCity: 'Outra', mainState: 'SP' };
  await fillFromCep(untouched, ['notes'], lookup);
  assert.equal(untouched.mainCity, 'Outra');

  // Trocar o CEP principal troca rua, bairro, cidade e UF pelos do CEP novo.
  const zipChanged: Record<string, unknown> = {
    mainZip: '27913161',
    mainStreet: 'Avenida Paulista',
    mainDistrict: 'Bela Vista',
    mainCity: 'Outra',
    mainState: 'SP',
    mainNumber: '498',
  };
  await fillFromCep(zipChanged, ['mainZip'], lookup);
  assert.equal(zipChanged.mainStreet, 'Rua Doutor Júlio Olivier');
  assert.equal(zipChanged.mainDistrict, 'Centro');
  assert.equal(zipChanged.mainCity, 'Macaé');
  assert.equal(zipChanged.mainState, 'RJ');
  assert.equal(zipChanged.mainNumber, '498');

  // CEP geral da cidade (sem rua): a rua antiga não fica, para não misturar endereços.
  const cityZip = { find: async () => ({ street: '', district: '', city: 'Macaé', state: 'RJ' }) };
  const generic: Record<string, unknown> = {
    mainZip: '27900000',
    mainStreet: 'Avenida Paulista',
    mainCity: 'São Paulo',
  };
  await fillFromCep(generic, ['mainZip'], cityZip);
  assert.equal(generic.mainStreet, null);
  assert.equal(generic.mainCity, 'Macaé');
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

test('serviços padrão não aceitam spread; malha só no +Econômico e no +Expresso', () => {
  const services = normalizeValue(fieldRule('services')!, [
    { code: '03298', spread: 5, malha: 2 },
    { code: '3301', spread: 4, malha: 3 },
    { code: '03220', spread: null, malha: 1.5 },
    { code: '99999', spread: 7, malha: 2 },
  ]) as { code: string; spread: number | null; malha: number | null }[];
  assert.deepEqual(services, [
    { code: '03298', spread: null, malha: 2 },
    { code: '03301', spread: null, malha: null },
    { code: '03220', spread: null, malha: 1.5 },
    { code: '99999', spread: 7, malha: null },
  ]);
});

test('malha ligada usa os valores padronizados', () => {
  const values = effectiveValues('client', { usesMalha: true });
  assert.equal(values.malhaAllUnits, true);
  assert.equal(values.malhaDiscount, 0);
  assert.equal(values.declarationContent, 'Documentos');
  assert.equal(values.declarationQuantity, 1);
  assert.equal(values.declarationValue, 10000);
});

test('tabelas do Cliente são escolhidas da lista fixa', () => {
  const table = fieldRule('packageTable')!;
  assert.equal(normalizeValue(table, 'tabela mais envios 13'), 'TABELA MAIS ENVIOS 13');
  assert.equal(normalizeValue(table, '7'), 'TABELA MAIS ENVIOS 7');
  assert.equal(normalizeValue(fieldRule('reverseTable')!, 'TABELA MAIS ENVIOS 16'), 'TABELA MAIS ENVIOS 16');
  assert.equal(normalizeValue(table, 'tabela mais envios à vista'), 'TABELA MAIS ENVIOS À VISTA');
  assert.equal(normalizeValue(fieldRule('reverseTable')!, 'à vista'), 'TABELA MAIS ENVIOS À VISTA');
  assert.throws(() => normalizeValue(table, 'TABELA QUALQUER'), FieldError);
});

test('campo fixo vem com o valor da regra, mas pode ser alterado', () => {
  assert.equal(effectiveValues('client', {}).dueDays, 10);
  assert.equal(effectiveValues('client', { dueDays: 15 }).dueDays, 15);
  assert.equal(effectiveValues('client', { insurance: 2 }).insurance, 2);
  assert.equal(effectiveValues('smart', { creditLimit: 500_000 }).creditLimit, 500_000);
});
