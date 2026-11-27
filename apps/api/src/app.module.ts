import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ModuleTokenGuard } from './common/guards/module-token.guard';
import { HybridAuthGuard } from './common/guards/hybrid-auth.guard';
import { OrgSetupGuard } from './common/guards/org-setup.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

import { EventsModule } from './modules/events/events.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { SheetsModule } from './modules/sheets/sheets.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { StudentsModule } from './modules/students/students.module';
import { ProductsModule } from './modules/products/products.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { BuildersModule } from './modules/builders/builders.module';
import { TasksKpiModule } from './modules/tasks-kpi/tasks-kpi.module';
import { PluginsModule } from './modules/plugins/plugins.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({ wildcard: true }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    PrismaModule,
    CryptoModule,
    EventsModule,
    SheetsModule,
    AuthModule,
    TenantModule,
    EmployeesModule,
    RbacModule,
    StudentsModule,
    ProductsModule,
    SessionsModule,
    BuildersModule,
    TasksKpiModule,
    PluginsModule,
    PlatformAdminModule,
  ],
  providers: [
    JwtAuthGuard,
    ModuleTokenGuard,
    HybridAuthGuard,
    OrgSetupGuard,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
