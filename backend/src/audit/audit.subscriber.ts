import {
  EntityMetadata,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  ObjectLiteral,
  QueryRunner,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { insertAuditEntry } from './audit-entry';
import { AuditChanges } from './audit-log.entity';
import { auditableOptions, AuditableOptions } from './auditable.decorator';

const MASKED = '[protegido]';

// Registra toda alteração de entidades com @Auditable na mesma transação:
// ou a alteração e a auditoria persistem juntas, ou nenhuma persiste.
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface<ObjectLiteral> {
  beforeInsert({ metadata, queryRunner }: InsertEvent<ObjectLiteral>) {
    assertAuditable(metadata, queryRunner, true);
  }

  beforeUpdate({ metadata, queryRunner, databaseEntity }: UpdateEvent<ObjectLiteral>) {
    assertAuditable(metadata, queryRunner, Boolean(databaseEntity));
  }

  beforeRemove({ metadata, queryRunner, databaseEntity }: RemoveEvent<ObjectLiteral>) {
    assertAuditable(metadata, queryRunner, Boolean(databaseEntity));
  }

  async afterInsert({ metadata, manager, entity }: InsertEvent<ObjectLiteral>) {
    const options = auditableOptions(metadata);
    if (!options) return;
    await insertAuditEntry(manager, {
      action: 'create',
      entity: options.name,
      entityId: entityId(metadata, entity),
      changes: diff(options, dataColumns(metadata), undefined, entity),
    });
  }

  async afterUpdate(event: UpdateEvent<ObjectLiteral>) {
    const { metadata, manager, entity, databaseEntity, updatedColumns } = event;
    const options = auditableOptions(metadata);
    if (!options || !entity) return;
    await insertAuditEntry(manager, {
      action: 'update',
      entity: options.name,
      entityId: entityId(metadata, databaseEntity),
      changes: diff(options, updatedColumns, databaseEntity, entity),
    });
  }

  async afterRemove({ metadata, manager, databaseEntity }: RemoveEvent<ObjectLiteral>) {
    const options = auditableOptions(metadata);
    if (!options) return;
    await insertAuditEntry(manager, {
      action: 'delete',
      entity: options.name,
      entityId: entityId(metadata, databaseEntity),
      changes: diff(options, dataColumns(metadata), databaseEntity, undefined),
    });
  }
}

// update(), delete() e insert() direto do repositório não abrem transação ou
// não carregam o valor anterior, então escapariam da auditoria sem este bloqueio.
function assertAuditable(
  metadata: EntityMetadata,
  queryRunner: QueryRunner,
  hasPreviousState: boolean,
) {
  if (!auditableOptions(metadata)) return;
  if (!queryRunner.isTransactionActive || !hasPreviousState) {
    throw new Error(
      `${metadata.name} é auditável: altere com save() ou remove(), nunca com insert(), update() ou delete()`,
    );
  }
}

function dataColumns({ columns }: EntityMetadata) {
  return columns.filter(
    (column) =>
      !column.isPrimary &&
      !column.isCreateDate &&
      !column.isUpdateDate &&
      !column.isVersion,
  );
}

function entityId(metadata: EntityMetadata, entity: ObjectLiteral) {
  return String(metadata.getEntityIdMixedMap(entity));
}

function diff(
  options: AuditableOptions,
  columns: ColumnMetadata[],
  before: ObjectLiteral | undefined,
  after: ObjectLiteral | undefined,
): AuditChanges {
  const read = (column: ColumnMetadata, entity?: ObjectLiteral) => {
    if (options.sensitive?.includes(column.propertyName)) return entity ? MASKED : null;
    return entity ? (column.getEntityValue(entity) ?? null) : null;
  };

  return Object.fromEntries(
    columns.map((column) => [
      column.propertyName,
      { from: read(column, before), to: read(column, after) },
    ]),
  );
}
