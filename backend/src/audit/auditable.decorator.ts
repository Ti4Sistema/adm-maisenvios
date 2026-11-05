import { EntityMetadata } from 'typeorm';

const AUDITABLE = Symbol('auditable');

export interface AuditableOptions {
  // Nome gravado em audit_log.entity.
  name: string;
  // Propriedades cujo valor nunca vai para a auditoria, só o fato de terem mudado.
  sensitive?: string[];
}

export function Auditable(options: AuditableOptions): ClassDecorator {
  return (target) => Reflect.defineMetadata(AUDITABLE, options, target);
}

export function auditableOptions({
  target,
}: EntityMetadata): AuditableOptions | undefined {
  if (typeof target !== 'function') return undefined;
  return Reflect.getMetadata(AUDITABLE, target);
}
