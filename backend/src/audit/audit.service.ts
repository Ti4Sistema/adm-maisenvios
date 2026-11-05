import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditEntry, insertAuditEntry } from './audit-entry';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>,
  ) {}

  // Para eventos que não são alteração de entidade, como login ou aprovação.
  // Dentro de uma transação, passe o manager dela para gravar junto.
  async record(entry: AuditEntry, manager: EntityManager = this.logs.manager) {
    await insertAuditEntry(manager, entry);
  }

  async search(query: AuditQueryDto) {
    const { action, entity, entityId, actorEmail, from, to, page, limit } = query;
    const builder = this.logs
      .createQueryBuilder('log')
      .orderBy('log.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (action) builder.andWhere('log.action = :action', { action });
    if (entity) builder.andWhere('log.entity = :entity', { entity });
    if (entityId) builder.andWhere('log.entityId = :entityId', { entityId });
    if (from) builder.andWhere('log.occurredAt >= :from', { from });
    if (to) builder.andWhere('log.occurredAt <= :to', { to });
    if (actorEmail) {
      builder.andWhere('log.actorEmail ILIKE :actorEmail', {
        actorEmail: `%${actorEmail}%`,
      });
    }

    const [items, total] = await builder.getManyAndCount();
    return { items, total, page, limit };
  }
}
