import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Administrator } from '../administrators/administrator.entity';

@Entity('sessions')
@Unique('uq_sessions_token_hash', ['tokenHash'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_sessions_administrator')
  @Column('uuid', { name: 'administrator_id' })
  administratorId: string;

  @Column('text', { name: 'token_hash' })
  tokenHash: string;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Administrator)
  @JoinColumn({ name: 'administrator_id' })
  administrator: Administrator;
}
