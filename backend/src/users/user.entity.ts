import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../access/user-role.entity';
import { Auditable } from '../audit/auditable.decorator';

@Auditable({ name: 'user', sensitive: ['passwordHash'] })
@Entity('users')
@Unique('uq_users_email', ['email'])
export class User {
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

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  roles: UserRole[];
}
