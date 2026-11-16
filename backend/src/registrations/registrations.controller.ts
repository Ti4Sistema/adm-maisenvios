import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { CurrentAdministrator } from '../auth/current-administrator.decorator';
import { SessionAdministrator } from '../auth/session-administrator';
import {
  CreateRegistrationDto,
  ImportSmartDto,
  ListRegistrationsDto,
  UpdateRegistrationDto,
} from './dto/registration.dto';
import { RegistrationsService } from './registrations.service';

@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get('schema')
  @RequirePermission(PERMISSIONS.REGISTRATIONS_READ)
  schema() {
    return this.registrations.schema();
  }

  @Get()
  @RequirePermission(PERMISSIONS.REGISTRATIONS_READ)
  list(@Query() query: ListRegistrationsDto) {
    return this.registrations.list(query);
  }

  @Post()
  @RequirePermission(PERMISSIONS.REGISTRATIONS_EDIT)
  create(@Body() dto: CreateRegistrationDto, @CurrentAdministrator() actor: SessionAdministrator) {
    return this.registrations.create(dto, actor);
  }

  @Post('import/smart')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.REGISTRATIONS_EDIT)
  importSmart(@Body() dto: ImportSmartDto, @CurrentAdministrator() actor: SessionAdministrator) {
    return this.registrations.importSmart(dto, actor);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.REGISTRATIONS_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.get(id);
  }

  @Get(':id/history')
  @RequirePermission(PERMISSIONS.REGISTRATIONS_READ)
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.history(id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.REGISTRATIONS_EDIT)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRegistrationDto,
    @CurrentAdministrator() actor: SessionAdministrator,
  ) {
    return this.registrations.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(PERMISSIONS.REGISTRATIONS_EDIT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentAdministrator() actor: SessionAdministrator) {
    return this.registrations.remove(id, actor);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.REGISTRATIONS_APPROVE)
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentAdministrator() actor: SessionAdministrator) {
    return this.registrations.approve(id, actor);
  }

  @Post(':id/unapprove')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.REGISTRATIONS_APPROVE)
  unapprove(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.unapprove(id);
  }
}
