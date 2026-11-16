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
import { Administrator } from '../administrators/administrator.entity';

@Auditable({ name: 'administrator_role' })
@Entity('administrator_roles')
@Unique('uq_administrator_roles_administrator_role', ['administratorId', 'role'])
export class AdministratorRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'administrator_id' })
  administratorId: string;

  @Column('text')
  role: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Administrator, (administrator) => administrator.roles)
  @JoinColumn({ name: 'administrator_id' })
  administrator: Administrator;
}
