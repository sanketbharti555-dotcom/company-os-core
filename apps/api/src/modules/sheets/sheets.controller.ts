import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { GoogleSheetsService } from './google-sheets.service';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';
import { OrgSetupGuard } from '../../common/guards/org-setup.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('core/sheets')
export class SheetsController {
  constructor(private readonly sheetsService: GoogleSheetsService) {}

  @UseGuards(HybridAuthGuard, OrgSetupGuard)
  @Get('status')
  getStatus(@CurrentUser() user: AuthContext) {
    return this.sheetsService.getStatus(user.tenantId!);
  }

  @UseGuards(HybridAuthGuard, OrgSetupGuard)
  @Get('oauth/url')
  getOAuthUrl(@CurrentUser() user: AuthContext) {
    return this.sheetsService.getConnectUrl(user.tenantId!);
  }

  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') tenantId: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      await this.sheetsService.handleOAuthCallback(code, tenantId);
      return res.redirect(`${frontendUrl}/dashboard/sheets?connected=true`);
    } catch (err) {
      const msg = encodeURIComponent((err as Error).message || 'Sheets connection failed');
      return res.redirect(`${frontendUrl}/dashboard/sheets?error=${msg}`);
    }
  }

  @UseGuards(HybridAuthGuard, OrgSetupGuard)
  @Post('resync')
  resync(@CurrentUser() user: AuthContext) {
    return this.sheetsService.pushCoreTablesToSheet(user.tenantId!);
  }

  @UseGuards(HybridAuthGuard, OrgSetupGuard)
  @Post('pull-sync')
  pullSync(@CurrentUser() user: AuthContext) {
    return this.sheetsService.pullTwoWaySyncFromSheets(user.tenantId!, user.email);
  }

  @UseGuards(HybridAuthGuard, OrgSetupGuard)
  @Patch('settings')
  updateSettings(
    @CurrentUser() user: AuthContext,
    @Body() body: { twoWayEnabled?: boolean; maskStudentPii?: boolean },
  ) {
    return this.sheetsService.updateSettings(user.tenantId!, body);
  }

  /** Called by docked plugins via @company-os/plugin-sdk to mirror their rows into Org's Drive Sheet */
  @UseGuards(HybridAuthGuard, OrgSetupGuard)
  @Post('plugin-sync')
  pluginSync(
    @CurrentUser() user: AuthContext,
    @Body()
    body: {
      spreadsheetName: string;
      tabName: string;
      rows: Array<Record<string, unknown>>;
    },
  ) {
    return this.sheetsService.syncPluginRows(
      user.tenantId!,
      user.moduleKey || 'core',
      body.spreadsheetName,
      body.tabName,
      body.rows || [],
    );
  }

  /** Google Drive Push Notification Webhook for instant Two-Way Sync */
  @Post('webhook')
  async driveWebhook(@Body() _body: Record<string, unknown>) {
    return { received: true };
  }
}
