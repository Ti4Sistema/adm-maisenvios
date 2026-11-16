import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { PERMISSIONS } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { CurrentAdministrator } from '../auth/current-administrator.decorator';
import { SessionAdministrator } from '../auth/session-administrator';
import { CreateAdministratorDto } from './dto/create-administrator.dto';
import { UpdateAdministratorDto } from './dto/update-administrator.dto';
import { AdministratorsService } from './administrators.service';

@Controller('administrators')
export class AdministratorsController {
  constructor(private readonly administrators: AdministratorsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ADMINISTRATORS_READ)
  list() {
    return this.administrators.list();
  }

  @Post()
  @RequirePermission(PERMISSIONS.ADMINISTRATORS_MANAGE)
  create(@Body() dto: CreateAdministratorDto, @CurrentAdministrator() actor: SessionAdministrator) {
    return this.administrators.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.ADMINISTRATORS_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdministratorDto,
    @CurrentAdministrator() actor: SessionAdministrator,
  ) {
    return this.administrators.update(id, dto, actor);
  }
}
