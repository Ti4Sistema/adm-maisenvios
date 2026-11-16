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
  Issue,
  normalizeValue,
  publicSchema,
  RegistrationType,
  suggestedValues,
} from './registration-rules';
import { Registration } from './registration.entity';
import { mapSmartRow } from './smart-import';

const DUPLICATE_WARNING = 'Outro pré-cadastro usa este CPF/CNPJ';
const LIST_LIMIT = 1000;

@Injectable()
export class RegistrationsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  schema() {
    return publicSchema();
  }

  async list({ type, status, search }: ListRegistrationsDto) {
    const builder = this.dataSource.manager
      .createQueryBuilder(Registration, 'r')
      .leftJoinAndSelect('r.approvedBy', 'approvedBy')
      .orderBy('r.createdAt', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .take(LIST_LIMIT);

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
    const duplicates = await duplicateDocuments(this.dataSource.manager, rows);
    return rows.map((row) => toView(row, duplicates));
  }

  async get(id: string) {
    const row = await this.dataSource.manager.findOne(Registration, {
      where: { id },
      relations: { approvedBy: true },
    });
    if (!row) throw new NotFoundException('Pré-cadastro não encontrado');
    return toView(row, await duplicateDocuments(this.dataSource.manager, [row]));
  }

  async create(dto: CreateRegistrationDto, actor: SessionAdministrator) {
    const type = dto.type as RegistrationType;
    const id = await this.dataSource.transaction(async (manager) => {
      const row = manager.create(Registration, { type, createdById: actor.id });
      assign(row, defaultValues(type));
      assign(row, normalizeAll(type, Object.entries(dto.values ?? {})));
      refreshStatus(row);
      return (await manager.save(row)).id;
    });
    return this.get(id);
  }

  async update(id: string, dto: UpdateRegistrationDto, actor: SessionAdministrator) {
    await this.dataSource.transaction(async (manager) => {
      const row = await lockRow(manager, id);
      if (row.status === 'approved') assertCanEditApproved(actor);

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
      refreshStatus(row);
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
        throw new ConflictException('Só é possível aprovar quando todos os campos obrigatórios estão preenchidos e válidos');
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
      assign(row, defaultValues('smart'));
      const warnings = [...mapped.warnings];
      for (const [field, raw] of Object.entries(mapped.values)) {
        const rule = fieldRule(field)!;
        try {
          assign(row, { [field]: normalizeValue(rule, raw) });
        } catch (error) {
          if (!(error instanceof FieldError)) throw error;
          warnings.push(`${rule.label}: ${error.message}; ficou vazio`);
        }
      }
      refreshStatus(row);
      return { line, row, warnings };
    });

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
        const { missing, errors } = evaluate('smart', storedValues(row));
        return {
          line,
          id: dryRun ? undefined : row.id,
          status: row.status,
          values: storedValues(row),
          suggested: suggestedValues('smart', storedValues(row)),
          missing,
          errors,
          warnings,
        };
      }),
    };
  }
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

async function duplicateDocuments(manager: EntityManager, rows: Registration[]) {
  const documents = [...new Set(rows.flatMap(({ document }) => (document ? [document] : [])))];
  if (!documents.length) return new Set<string>();
  const result: { document: string }[] = await manager.query(
    'SELECT document FROM registrations WHERE document = ANY($1) GROUP BY document HAVING count(*) > 1',
    [documents],
  );
  return new Set(result.map(({ document }) => document));
}

function toView(row: Registration, duplicates: Set<string>) {
  const values = storedValues(row);
  const { missing, errors, warnings } = evaluate(row.type, values);
  const allWarnings: Issue[] =
    row.document && duplicates.has(row.document)
      ? [...warnings, { field: 'document', message: DUPLICATE_WARNING }]
      : warnings;
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    values,
    suggested: suggestedValues(row.type, values),
    missing,
    errors,
    warnings: allWarnings,
    approvedAt: row.approvedAt,
    approvedBy: row.approvedBy ? { id: row.approvedBy.id, name: row.approvedBy.name } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
