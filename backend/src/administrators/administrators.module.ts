import { Module } from '@nestjs/common';
import { RolesController } from '../access/roles.controller';
import { AdministratorsController } from './administrators.controller';
import { AdministratorsService } from './administrators.service';

@Module({
  controllers: [AdministratorsController, RolesController],
  providers: [AdministratorsService],
})
export class AdministratorsModule {}
