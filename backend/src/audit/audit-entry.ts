import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { currentContext } from '../common/request-context';
import { AuditChanges, AuditLog } from './audit-log.entity';

export interface AuditEntry {
  action: string;
  entity?: string;
  entityId?: string;
  changes?: AuditChanges;
  metadata?: Record<string, unknown>;
}

export function insertAuditEntry(manager: EntityManager, entry: AuditEntry) {
  const context = currentContext();
  const log = manager.create(AuditLog, {
    ...entry,
    actorId: context?.actor?.id ?? null,
    actorEmail: context?.actor?.email ?? null,
    ip: context?.ip ?? null,
    requestId: context?.requestId ?? null,
  });
  return manager.insert(AuditLog, log as QueryDeepPartialEntity<AuditLog>);
}
