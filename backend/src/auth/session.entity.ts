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
import { User } from '../users/user.entity';

@Entity('sessions')
@Unique('uq_sessions_token_hash', ['tokenHash'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_sessions_user')
  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('text', { name: 'token_hash' })
  tokenHash: string;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
