import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PluginsService } from './plugins.service';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';
import { OrgSetupGuard } from '../../common/guards/org-setup.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(HybridAuthGuard, OrgSetupGuard)
@Controller('core/plugins')
export class PluginsController {
  constructor(private readonly service: PluginsService) {}

  @Get()
  list(@CurrentUser() user: AuthContext) {
    return this.service.listPlugins(user.tenantId!);
  }

  @Post('register')
  register(@CurrentUser() user: AuthContext, @Body() manifest: Record<string, unknown>) {
    return this.service.registerPlugin(user.tenantId!, manifest as never);
  }

  @Post('tokens')
  issueToken(
    @CurrentUser() user: AuthContext,
    @Body() body: { moduleKey: string; label: string; scopes: string[]; expiryDays?: number },
  ) {
    return this.service.issueModuleToken(user.tenantId!, user.employeeCode || user.email, body);
  }

  @Patch('tokens/:id/revoke')
  revokeToken(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.revokeToken(user.tenantId!, id);
  }

  /** Endpoint called by docked plugins to publish canonical events into this Org's Event Bus */
  @Post('events/publish')
  publishEvent(
    @CurrentUser() user: AuthContext,
    @Body() body: { event_name: string; payload: Record<string, unknown>; correlation_id?: string },
  ) {
    return this.service.publishPluginEvent(
      user.tenantId!,
      user.employeeCode || user.email,
      user.moduleKey || 'external',
      body,
    );
  }
}
