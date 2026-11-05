import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsGuard } from './access/permissions.guard';
import { AuditModule } from './audit/audit.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { dataSourceOptions } from './database/data-source';
import { HealthController } from './health/health.controller';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    AuditModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [
    // A ordem importa: a autenticação identifica o usuário que as permissões avaliam.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
