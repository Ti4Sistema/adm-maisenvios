import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';
import { Administrator } from '../administrators/administrator.entity';
import { Auditable } from '../audit/auditable.decorator';
import type { RegistrationStatus, RegistrationType, ServiceItem } from './registration-rules';

// O Postgres devolve numeric como texto; aqui vira número.
const decimal: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

const text = (name: string) => Column('text', { name, nullable: true });
const integer = (name: string) => Column('integer', { name, nullable: true });
const flag = (name: string) => Column('boolean', { name, nullable: true });
const percent = (name: string) =>
  Column('numeric', { name, precision: 5, scale: 2, nullable: true, transformer: decimal });

// Os campos do pré-cadastro são descritos em registration-rules.ts.
// Valores em dinheiro ficam em centavos.
@Auditable({ name: 'registration' })
@Entity('registrations')
@Index('idx_registrations_document', ['document'])
@Check('chk_registrations_type', "type IN ('client', 'smart')")
@Check('chk_registrations_status', "status IN ('draft', 'ready', 'approved')")
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  type: RegistrationType;

  @Index('idx_registrations_status')
  @Column('text', { default: 'draft' })
  status: RegistrationStatus;

  @text('trade_name') tradeName: string | null;
  @text('legal_name') legalName: string | null;
  @text('document') document: string | null;
  @text('customer_type') customerType: string | null;
  @text('master_license') masterLicense: string | null;

  @text('billing_type') billingType: string | null;
  @text('billing_email') billingEmail: string | null;
  @integer('due_days') dueDays: number | null;
  @text('beneficiary') beneficiary: string | null;

  @text('main_zip') mainZip: string | null;
  @text('main_number') mainNumber: string | null;
  @text('main_complement') mainComplement: string | null;
  @text('main_street') mainStreet: string | null;
  @text('main_district') mainDistrict: string | null;
  @text('main_city') mainCity: string | null;
  @text('main_state') mainState: string | null;
  @text('main_address_name') mainAddressName: string | null;

  @text('pickup_zip') pickupZip: string | null;
  @text('pickup_number') pickupNumber: string | null;
  @text('pickup_complement') pickupComplement: string | null;
  @text('pickup_street') pickupStreet: string | null;
  @text('pickup_district') pickupDistrict: string | null;
  @text('pickup_city') pickupCity: string | null;
  @text('pickup_state') pickupState: string | null;
  @text('pickup_address_name') pickupAddressName: string | null;

  @text('package_table') packageTable: string | null;
  @text('reverse_table') reverseTable: string | null;
  @text('postage_contract') postageContract: string | null;
  @text('postage_card') postageCard: string | null;
  @text('billing_document') billingDocument: string | null;
  @integer('credit_limit') creditLimit: number | null;
  @percent('insurance') insurance: number | null;
  @integer('reverse_validity_days') reverseValidityDays: number | null;
  @flag('skip_postage_cost') skipPostageCost: boolean | null;
  @flag('logical_labels') logicalLabels: boolean | null;
  @flag('separate_branch_invoice') separateBranchInvoice: boolean | null;

  @Column('jsonb', { nullable: true })
  services: ServiceItem[] | null;

  @text('state_registration') stateRegistration: string | null;
  @text('municipal_registration') municipalRegistration: string | null;
  @flag('whatsapp_notifications') whatsappNotifications: boolean | null;
  @flag('unified_label') unifiedLabel: boolean | null;
  @flag('force_dce') forceDce: boolean | null;

  @text('contact_name') contactName: string | null;
  @text('mobile_phone') mobilePhone: string | null;
  @text('business_phone') businessPhone: string | null;
  @text('home_phone') homePhone: string | null;
  @text('website') website: string | null;

  @flag('uses_malha') usesMalha: boolean | null;
  @flag('malha_all_units') malhaAllUnits: boolean | null;
  @percent('malha_discount') malhaDiscount: number | null;
  @text('declaration_content') declarationContent: string | null;
  @integer('declaration_quantity') declarationQuantity: number | null;
  @integer('declaration_value') declarationValue: number | null;

  @text('admin_login') adminLogin: string | null;
  @text('pdv_login') pdvLogin: string | null;

  @text('notes') notes: string | null;

  @Column('timestamptz', { name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  @Column('uuid', { name: 'approved_by_id', nullable: true })
  approvedById: string | null;

  @ManyToOne(() => Administrator, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: Administrator | null;

  @Column('uuid', { name: 'created_by_id', nullable: true })
  createdById: string | null;

  @ManyToOne(() => Administrator, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Administrator | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
