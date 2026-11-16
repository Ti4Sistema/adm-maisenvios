import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AdministratorRole } from '../access/administrator-role.entity';
import { Auditable } from '../audit/auditable.decorator';

@Auditable({ name: 'administrator', sensitive: ['passwordHash'] })
@Entity('administrators')
@Unique('uq_administrators_email', ['email'])
export class Administrator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @Column('text')
  email: string;

  @Column('text', { name: 'password_hash' })
  passwordHash: string;

  @Column('boolean', { default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => AdministratorRole, (administratorRole) => administratorRole.administrator)
  roles: AdministratorRole[];
}
