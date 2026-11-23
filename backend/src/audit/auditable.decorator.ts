import { EntityMetadata, ObjectLiteral } from 'typeorm';

const AUDITABLE = Symbol('auditable');

export interface AuditableOptions {
  // Nome gravado em audit_log.entity.
  name: string;
  // Propriedades cujo valor nunca vai para a auditoria, só o fato de terem mudado.
  sensitive?: string[];
  // Nome legível do item (ex.: o Nome Fantasia), gravado em metadata.item para a
  // auditoria mostrar o que foi criado, alterado ou removido, mesmo depois de apagado.
  describe?: (entity: ObjectLiteral) => string | null | undefined;
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
