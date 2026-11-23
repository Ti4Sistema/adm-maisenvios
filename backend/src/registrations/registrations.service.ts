import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { PERMISSIONS } from '../access/permissions';
import { AuditLog } from '../audit/audit-log.entity';
import { SessionAdministrator } from '../auth/session-administrator';
import {
  CreateRegistrationDto,
  FieldChangeDto,
  HiddenCountDto,
  DailyStatsDto,
  ImportClientDto,
  ImportSmartDto,
  ListRegistrationsDto,
  UpdateRegistrationDto,
} from './dto/registration.dto';
import {
  defaultValues,
  evaluate,
  FIELD_KEYS,
  FieldError,
  fieldRule,
  FieldValues,
  isComplete,
  isEditable,
  normalizeValue,
  publicSchema,
  RegistrationType,
  autoLogins,
  suggestedValues,
} from './registration-rules';
import { Registration } from './registration.entity';
import { CepLookup, fillFromCep } from './cep-lookup';
import { mapClientText } from './client-import';
import { mapSmartRow } from './smart-import';

const LIST_LIMIT = 1000;

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cep: CepLookup,
  ) {}

  // Completa cidade e UF (e rua e bairro vazios) pelo CEP, preenche os logins
  // pela sugestão e recalcula a situação.
  private async completeAddress(row: Registration, changed: string[], previous: FieldValues = {}) {
    await fillFromCep(row as unknown as Record<string, unknown>, changed, this.cep);
    assign(row, autoLogins(row.type, previous, storedValues(row), changed));
    refreshStatus(row);
  }

  schema() {
    return publicSchema();
  }

  async list({ type, status, search, hidden }: ListRegistrationsDto) {
    const builder = this.dataSource.manager
      .createQueryBuilder(Registration, 'r')
      .leftJoinAndSelect('r.approvedBy', 'approvedBy')
      .orderBy('r.createdAt', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .take(LIST_LIMIT);

    builder.andWhere(hidden === 'true' ? 'r.hiddenAt IS NOT NULL' : 'r.hiddenAt IS NULL');
    if (type) builder.andWhere('r.type = :type', { type });
    if (status) builder.andWhere('r.status = :status', { status });
    if (search?.trim()) {
      const term = search.trim();
      const numbers = term.replace(/\D/g, '');
      builder.andWhere(
        `(r.tradeName ILIKE :like OR r.legalName ILIKE :like OR r.masterLicense ILIKE :like${
          numbers.length >= 3 ? ' OR r.document LIKE :numbers' : ''
        })`,
        { like: `%${term}%`, numbers: `%${numbers}%` },
      );
    }

    const rows = await builder.getMany();
    return rows.map(toView);
  }

  async get(id: string) {
    const row = await this.dataSource.manager.findOne(Registration, {
      where: { id },
      relations: { approvedBy: true },
    });
    if (!row) throw new NotFoundException('Pré-cadastro não encontrado');
    return toView(row);
  }

  async create(dto: CreateRegistrationDto, actor: SessionAdministrator) {
    const type = dto.type as RegistrationType;
    const id = await this.dataSource.transaction(async (manager) => {
      const row = manager.create(Registration, { type, createdById: actor.id });
      assign(row, defaultValues(type));
      const values = normalizeAll(type, Object.entries(dto.values ?? {}));
      assign(row, values);
      await this.completeAddress(row, Object.keys(values));
      return (await manager.save(row)).id;
    });
    return this.get(id);
  }

  async update(id: string, dto: UpdateRegistrationDto, actor: SessionAdministrator) {
    await this.dataSource.transaction(async (manager) => {
      const row = await lockRow(manager, id);
      if (row.status === 'approved') assertCanEditApproved(actor);
      const previous = storedValues(row);

      const conflicts = dto.changes
        .filter(({ field, from }) => FIELD_KEYS.includes(field) && !sameValue(read(row, field), from))
        .map(({ field }) => ({ field, current: read(row, field) }));
      if (conflicts.length) {
        throw new ConflictException({
          statusCode: 409,
          message: 'Outra pessoa alterou este campo enquanto você editava. Confira o valor atual.',
          conflicts,
        });
      }

      assign(row, normalizeAll(row.type, dto.changes.map(toEntry)));
      await this.completeAddress(
        row,
        dto.changes.map(({ field }) => field),
        previous,
      );
      await manager.save(row);
    });
    return this.get(id);
  }

  // Quantos estão ocultos, para o link discreto da tela.
  // Pré-cadastros criados e aprovados por dia (no horário de Brasília), para o
  // gráfico da tela inicial, e os totais do período anterior para comparar.
  async dailyStats({ days }: DailyStatsDto) {
    const span = Number(days ?? 7);
    const zone = 'America/Sao_Paulo';
    const perDay: { day: string; created: number; approved: number }[] = await this.dataSource.query(
      `WITH days AS (
         SELECT generate_series(
           (now() AT TIME ZONE $2)::date - ($1::int - 1),
           (now() AT TIME ZONE $2)::date,
           interval '1 day'
         )::date AS day
       )
       SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
         (SELECT count(*) FROM registrations r WHERE (r.created_at AT TIME ZONE $2)::date = d.day)::int AS created,
         (SELECT count(*) FROM registrations r WHERE (r.approved_at AT TIME ZONE $2)::date = d.day)::int AS approved
       FROM days d
       ORDER BY d.day`,
      [span, zone],
    );
    const [previous]: { created: number; approved: number }[] = await this.dataSource.query(
      `WITH bounds AS (
         SELECT (now() AT TIME ZONE $2)::date - ($1::int * 2 - 1) AS first,
                (now() AT TIME ZONE $2)::date - $1::int AS last
       )
       SELECT
         (SELECT count(*) FROM registrations r, bounds b
           WHERE (r.created_at AT TIME ZONE $2)::date BETWEEN b.first AND b.last)::int AS created,
         (SELECT count(*) FROM registrations r, bounds b
           WHERE (r.approved_at AT TIME ZONE $2)::date BETWEEN b.first AND b.last)::int AS approved`,
      [span, zone],
    );
    return { days: perDay, previous };
  }

  async hiddenCount({ type }: HiddenCountDto) {
    const builder = this.dataSource.manager.createQueryBuilder(Registration, 'r').where('r.hiddenAt IS NOT NULL');
    if (type) builder.andWhere('r.type = :type', { type });
    return { count: await builder.getCount() };
  }

  // Ocultar tira da lista principal sem apagar; "mostrar de novo" desfaz.
  async setHidden(id: string, hidden: boolean, actor: SessionAdministrator) {
    await this.dataSource.transaction(async (manager) => {
      const row = await lockRow(manager, id);
      if (row.status === 'approved') assertCanEditApproved(actor);
      if (Boolean(row.hiddenAt) === hidden) return;
      row.hiddenAt = hidden ? new Date() : null;
      await manager.save(row);
    });
    return this.get(id);
  }

  async remove(id: string, actor: SessionAdministrator) {
    await this.dataSource.transaction(async (manager) => {
      const row = await lockRow(manager, id);
      if (row.status === 'approved') assertCanEditApproved(actor);
      await manager.remove(row);
    });
  }

  async approve(id: string, actor: SessionAdministrator) {
    await this.dataSource.transaction(async (manager) => {
      const row = await lockRow(manager, id);
      if (row.status === 'approved') throw new ConflictException('Este pré-cadastro já está aprovado');
      refreshStatus(row);
      if (row.status !== 'ready') {
        throw new ConflictException(
          'Só é possível aprovar quando todos os campos obrigatórios estão preenchidos e válidos',
        );
      }
      row.status = 'approved';
      row.approvedAt = new Date();
      row.approvedById = actor.id;
      await manager.save(row);
    });
    return this.get(id);
  }

  async unapprove(id: string) {
    await this.dataSource.transaction(async (manager) => {
      const row = await lockRow(manager, id);
      if (row.status !== 'approved') throw new ConflictException('Este pré-cadastro não está aprovado');
      clearApproval(row);
      refreshStatus(row);
      await manager.save(row);
    });
    return this.get(id);
  }

  async history(id: string) {
    await this.get(id);
    const logs = await this.dataSource.manager.find(AuditLog, {
      where: { entity: 'registration', entityId: id },
      order: { id: 'DESC' },
      take: 200,
    });
    return logs.map(({ id: logId, occurredAt, action, actorEmail, changes }) => ({
      id: logId,
      occurredAt,
      action,
      actorEmail,
      changes,
    }));
  }

  // Cada linha colada da planilha vira um pré-cadastro Smart. Com dryRun, só
  // mostra o que seria criado; campos que não deu para entender ficam vazios.
  async importSmart({ rows, dryRun }: ImportSmartDto, actor: SessionAdministrator) {
    // Linhas da mesma colagem ganham horários em sequência, para aparecerem na
    // grade na ordem da planilha (a lista mostra os mais recentes primeiro).
    const pastedAt = Date.now();
    const prepared = rows.map(({ line, cells }, index) => {
      const mapped = mapSmartRow(cells);
      if (mapped.skip) return { line, skipped: mapped.skip, warnings: [] as string[] };

      const row = this.dataSource.manager.create(Registration, {
        type: 'smart',
        createdById: actor.id,
        createdAt: new Date(pastedAt + rows.length - index),
      });
      const warnings = fillImported(row, mapped.values, mapped.warnings);
      return { line, row, warnings };
    });
    // A planilha costuma trazer cidade e UF; o CEP só completa o que faltou.
    await Promise.all(
      prepared.map(
        (item) =>
          item.row &&
          this.completeAddress(
            item.row,
            Object.keys(item.row).filter((key) => !key.endsWith('Login')),
          ),
      ),
    );

    const documents = prepared.flatMap((item) => (item.row?.document ? [item.row.document] : []));
    const existing = new Set(
      documents.length
        ? (
            await this.dataSource.manager.find(Registration, {
              select: { document: true },
              where: { document: In(documents) },
            })
          ).map(({ document }) => document)
        : [],
    );
    const seen = new Map<string, number>();
    for (const item of prepared) {
      const document = item.row?.document;
      if (!document) continue;
      if (existing.has(document)) item.warnings.push('Já existe pré-cadastro com este CNPJ');
      if (seen.has(document)) item.warnings.push(`CNPJ repetido na linha ${seen.get(document)}`);
      else seen.set(document, item.line);
    }

    if (!dryRun) {
      const toSave = prepared.flatMap((item) => (item.row ? [item.row] : []));
      await this.dataSource.transaction((manager) => manager.save(toSave));
    }

    return {
      created: dryRun ? 0 : prepared.filter((item) => item.row).length,
      items: prepared.map(({ line, row, skipped, warnings }) => {
        if (!row) return { line, skipped, warnings };
        return { line, id: dryRun ? undefined : row.id, ...importedView(row), warnings };
      }),
    };
  }

  // A ficha em texto de um cliente vira um pré-cadastro de Cliente. Com dryRun,
  // só mostra o que foi lido e o que ainda falta.
  async importClient({ text, dryRun }: ImportClientDto, actor: SessionAdministrator) {
    const mapped = mapClientText(text);
    if (!mapped.recognized) {
      throw new BadRequestException(
        'Não encontrei nenhum campo da ficha. Cole o texto no formato "Rótulo: valor", como "Razão Social: ..."',
      );
    }

    const row = this.dataSource.manager.create(Registration, { type: 'client', createdById: actor.id });
    const warnings = fillImported(row, mapped.values, mapped.warnings);
    // A ficha não traz cidade e UF: vêm do CEP. Rua e bairro da ficha são mantidos.
    await this.completeAddress(
      row,
      Object.keys(mapped.values)
        .filter((key) => !key.endsWith('Zip'))
        .concat('mainZip', 'pickupZip'),
    );
    if (row.document) {
      const existing = await this.dataSource.manager.count(Registration, { where: { document: row.document } });
      if (existing) warnings.push('Já existe pré-cadastro com este CPF/CNPJ');
    }

    if (!dryRun) await this.dataSource.transaction((manager) => manager.save(row));
    const view = importedView(row);
    return {
      id: dryRun ? undefined : row.id,
      // Campos que vieram da ficha, para a tela mostrar o que foi lido.
      filled: Object.keys(mapped.values).filter((key) => view.values[key] !== null),
      ...view,
      warnings,
    };
  }
}

// Aplica os padrões do tipo e os valores lidos. Campo que não deu para entender
// fica vazio e vira aviso, para não perder o cadastro inteiro.
function fillImported(row: Registration, raw: Record<string, string>, initial: string[]) {
  assign(row, defaultValues(row.type));
  const warnings = [...initial];
  for (const [field, value] of Object.entries(raw)) {
    const rule = fieldRule(field)!;
    try {
      assign(row, { [field]: normalizeValue(rule, value) });
      if (rule.maxLength && value.trim().length > rule.maxLength) {
        warnings.push(`${rule.label} tinha mais de ${rule.maxLength} caracteres; o excesso foi cortado`);
      }
    } catch (error) {
      if (!(error instanceof FieldError)) throw error;
      warnings.push(`${rule.label}: ${error.message}; ficou vazio`);
    }
  }
  refreshStatus(row);
  return warnings;
}

function importedView(row: Registration) {
  const values = storedValues(row);
  const { missing, errors } = evaluate(row.type, values);
  return { status: row.status, values, suggested: suggestedValues(row.type, values), missing, errors };
}

async function lockRow(manager: EntityManager, id: string) {
  const row = await manager.findOne(Registration, { where: { id }, lock: { mode: 'pessimistic_write' } });
  if (!row) throw new NotFoundException('Pré-cadastro não encontrado');
  return row;
}

function assertCanEditApproved(actor: SessionAdministrator) {
  if (!actor.permissions.includes(PERMISSIONS.REGISTRATIONS_EDIT_APPROVED)) {
    throw new ForbiddenException('Pré-cadastro aprovado: só o Admin global pode alterar');
  }
}

function toEntry({ field, to }: FieldChangeDto): [string, unknown] {
  return [field, to];
}

// Converte todos os valores e junta os erros numa única resposta.
function normalizeAll(type: RegistrationType, entries: [string, unknown][]): FieldValues {
  const values: FieldValues = {};
  const problems: string[] = [];
  for (const [key, raw] of entries) {
    const rule = fieldRule(key);
    if (!rule) {
      problems.push(`Campo desconhecido: ${key}`);
    } else if (!isEditable(rule, type)) {
      problems.push(`${rule.label} não pode ser alterado neste tipo de cadastro`);
    } else {
      try {
        values[key] = normalizeValue(rule, raw);
      } catch (error) {
        if (!(error instanceof FieldError)) throw error;
        problems.push(`${rule.label}: ${error.message}`);
      }
    }
  }
  if (problems.length) throw new BadRequestException(problems);
  return values;
}

function assign(row: Registration, values: FieldValues) {
  Object.assign(row, values);
}

function read(row: Registration, field: string) {
  return (row as unknown as FieldValues)[field] ?? null;
}

function sameValue(current: unknown, expected: unknown) {
  return JSON.stringify(current ?? null) === JSON.stringify(expected ?? null);
}

export function storedValues(row: Registration): FieldValues {
  return Object.fromEntries(FIELD_KEYS.map((key) => [key, read(row, key)]));
}

function clearApproval(row: Registration) {
  row.approvedAt = null;
  row.approvedById = null;
}

// Rascunho e Pronto são calculados. Um aprovado que ficou incompleto volta a Rascunho.
function refreshStatus(row: Registration) {
  const complete = isComplete(evaluate(row.type, storedValues(row)));
  if (row.status === 'approved' && complete) return;
  if (row.status === 'approved') clearApproval(row);
  row.status = complete ? 'ready' : 'draft';
}

function toView(row: Registration) {
  const values = storedValues(row);
  const { missing, errors, warnings } = evaluate(row.type, values);
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    values,
    suggested: suggestedValues(row.type, values),
    missing,
    errors,
    warnings,
    approvedAt: row.approvedAt,
    approvedBy: row.approvedBy ? { id: row.approvedBy.id, name: row.approvedBy.name } : null,
    hiddenAt: row.hiddenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
