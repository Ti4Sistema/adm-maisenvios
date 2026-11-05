import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Auditable } from '../audit/auditable.decorator';
import { User } from '../users/user.entity';

@Auditable({ name: 'user_role' })
@Entity('user_roles')
@Unique('uq_user_roles_user_role', ['userId', 'role'])
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('text')
  role: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.roles)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
