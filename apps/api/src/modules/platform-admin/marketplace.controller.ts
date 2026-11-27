import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgSetupGuard } from '../../common/guards/org-setup.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';
import { EntitlementService } from './entitlement.service';
import { PluginsService } from '../plugins/plugins.service';

@Controller('core/marketplace')
export class MarketplaceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
    private readonly pluginsService: PluginsService,
  ) {}


  /** Live Free Trial / 30-day Subscription Countdown for Top Dashboard Banner */
  @UseGuards(JwtAuthGuard, OrgSetupGuard)
  @Get('subscription-status')
  async getSubscriptionStatus(@CurrentUser() user: AuthContext) {
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId: user.tenantId! },
    });
    if (!sub) {
      return {
        plan: 'STARTER',
        status: 'TRIALING',
        provider: 'MANUAL',
        isBypass: false,
        isExpired: false,
        daysRemaining: Number(process.env.DEFAULT_TRIAL_DAYS || 15),
        trialEndsAt: null,
        currentPeriodEnd: null,
      };
    }

    const isBypass = sub.provider === 'BYPASS';
    const targetEnd = sub.status === 'TRIALING' ? sub.trialEndsAt : sub.currentPeriodEnd;
    let daysRemaining: number | null = null;
    let isExpired = false;

    if (!isBypass && targetEnd) {
      const diffMs = targetEnd.getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      isExpired = diffMs <= 0;
    }
    if (sub.status === 'PAST_DUE' || sub.status === 'CANCELLED') {
      isExpired = true;
    }

    return {
      plan: sub.plan,
      status: sub.status,
      provider: sub.provider,
      isBypass,
      isExpired,
      daysRemaining,
      trialEndsAt: sub.trialEndsAt,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  /** User-facing App Store: shows only modules visible to this Organization with plan/beta/testing badges */
  @UseGuards(JwtAuthGuard, OrgSetupGuard)
  @Get('modules')
  async listAppStore(@CurrentUser() user: AuthContext) {
    const res = await this.entitlements.evaluateAllForTenant(user.tenantId!);
    return {
      subscription: res.subscription,
      modules: res.modules.filter((m) => m.visible),
    };
  }

  /**
   * 1-Click User Install:
   * Checks Beta/Testing/Subscription entitlement -> registers manifest -> auto-creates internal
   * module token -> auto-creates Plugin Google Sheet in Org's Drive Folder -> unlocks Workspaces!
   */
  @UseGuards(JwtAuthGuard, OrgSetupGuard)
  @Post('modules/:moduleKey/install')
  async oneClickInstall(
    @CurrentUser() user: AuthContext,
    @Param('moduleKey') moduleKey: string,
  ) {
    const evalRes = await this.entitlements.evaluateAllForTenant(user.tenantId!);
    const modEval = evalRes.modules.find((m) => m.moduleKey === moduleKey);

    if (!modEval || !modEval.visible) {
      throw new ForbiddenException('This module is not available for your organization yet.');
    }
    if (!modEval.canInstall) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_UPGRADE_REQUIRED',
        message: `Please upgrade to the ${modEval.requiredPlan} plan (or buy the add-on) to install ${modEval.name}.`,
        requiredPlan: modEval.requiredPlan,
        addonPriceInr: modEval.addonPriceInr,
      });
    }

    const catalogItem = await this.prisma.globalModuleCatalog.findUnique({
      where: { moduleKey },
    });
    if (!catalogItem) throw new BadRequestException('Module not found in Global Catalog.');

    // 1. Register Manifest, Workspaces & Auto-Provision Google Sheet in Org's Drive Folder
    const docked = await this.pluginsService.registerPlugin(
      user.tenantId!,
      catalogItem.manifestJson as never,
    );

    // 2. Automatically issue internal scoped module token (zero copy-paste for end user!)
    await this.pluginsService.issueModuleToken(user.tenantId!, user.employeeCode || user.email, {
      moduleKey,
      label: `${catalogItem.name} (Auto 1-Click Install)`,
      scopes: [
        'core.employees.read',
        'core.students.create',
        'core.products.read',
        'core.events.publish',
        'core.sheets.write',
      ],
      expiryDays: 365,
    });

    return {
      installed: true,
      moduleKey,
      accessReason: modEval.accessReason,
      provisionedSheets: docked.provisionedSheets,
    };
  }

  @UseGuards(JwtAuthGuard, OrgSetupGuard)
  @Post('modules/:moduleKey/disable')
  async disableModule(
    @CurrentUser() user: AuthContext,
    @Param('moduleKey') moduleKey: string,
  ) {
    await this.prisma.tenantPlugin.updateMany({
      where: { tenantId: user.tenantId!, moduleKey },
      data: { status: 'DISABLED' },
    });
    return { disabled: true, moduleKey };
  }

  /**
   * Razorpay / Payment Gateway Subscription Webhook:
   * Automatically activates a company's SaaS subscription upon payment success!
   */
  @Post('billing/razorpay-webhook')
  async razorpayWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Body() payload: Record<string, unknown>,
  ) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (secret && signature) {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      if (expected !== signature) {
        throw new ForbiddenException('Invalid Razorpay webhook signature.');
      }
    }

    const event = String(payload.event || '');
    const notes = ((payload.payload as any)?.subscription?.entity?.notes ||
      (payload.payload as any)?.payment?.entity?.notes ||
      {}) as { tenantId?: string; plan?: string; moduleKey?: string };

    if (notes.tenantId && ['subscription.charged', 'payment.captured'].includes(event)) {
      const plan = (notes.plan || 'GROWTH') as 'STARTER' | 'GROWTH' | 'ENTERPRISE';
      await this.prisma.tenantSubscription.upsert({
        where: { tenantId: notes.tenantId },
        update: {
          plan,
          status: 'ACTIVE',
          provider: 'RAZORPAY',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        create: {
          tenantId: notes.tenantId,
          plan,
          status: 'ACTIVE',
          provider: 'RAZORPAY',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    return { received: true };
  }
}
