import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { PERMISSIONS } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionUser } from '../auth/session-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.USERS_READ)
  list() {
    return this.users.list();
  }

  @Post()
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: SessionUser) {
    return this.users.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: SessionUser,
  ) {
    return this.users.update(id, dto, actor);
  }
}
