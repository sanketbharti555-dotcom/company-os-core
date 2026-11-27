import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgSetupGuard } from '../../common/guards/org-setup.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('core/organizations')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /** Unlocked right after login (does NOT require OrgSetupGuard) so user can create their org */
  @UseGuards(JwtAuthGuard)
  @Post('setup')
  setupOrganization(
    @CurrentUser() user: AuthContext,
    @Body()
    body: {
      name: string;
      legalName?: string;
      gstin?: string;
      phone: string;
      email?: string;
      address?: string;
      logoUrl?: string;
      sessionCode?: string;
      timezone?: string;
      currency?: string;
      autoConnectGoogleDrive?: boolean;
    },
  ) {
    return this.tenantService.setupOrganization(user.userId, body);
  }

  @UseGuards(JwtAuthGuard, OrgSetupGuard)
  @Get('current')
  getCurrent(@CurrentUser() user: AuthContext) {
    return this.tenantService.getCurrentOrg(user.tenantId!);
  }

  @UseGuards(JwtAuthGuard, OrgSetupGuard)
  @Patch('current')
  updateCurrent(
    @CurrentUser() user: AuthContext,
    @Body()
    body: {
      name?: string;
      legalName?: string;
      gstin?: string;
      phone?: string;
      address?: string;
      logoUrl?: string;
      website?: string;
    },
  ) {
    return this.tenantService.updateBranding(user.tenantId!, body);
  }
}
