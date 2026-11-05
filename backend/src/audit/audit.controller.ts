import { Controller, Get, Query } from '@nestjs/common';
import { PERMISSIONS } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_READ)
  search(@Query() query: AuditQueryDto) {
    return this.audit.search(query);
  }
}
