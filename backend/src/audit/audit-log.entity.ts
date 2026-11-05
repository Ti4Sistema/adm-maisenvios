import {
  CreateDateColumn,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

@Entity('audit_log')
@Index('idx_audit_log_entity', ['entity', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column('text')
  action: string;

  @Column('text', { nullable: true })
  entity: string | null;

  @Column('text', { name: 'entity_id', nullable: true })
  entityId: string | null;

  // Sem chave estrangeira: o registro precisa continuar legível por si só.
  @Index('idx_audit_log_actor')
  @Column('uuid', { name: 'actor_id', nullable: true })
  actorId: string | null;

  @Column('text', { name: 'actor_email', nullable: true })
  actorEmail: string | null;

  @Column('text', { nullable: true })
  ip: string | null;

  @Column('uuid', { name: 'request_id', nullable: true })
  requestId: string | null;

  @Column('jsonb', { nullable: true })
  changes: AuditChanges | null;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown> | null;
}
