import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async getOverview() {
    const [tenants, activeSubs, trialingSubs, overrides, catalog] = await Promise.all([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.tenantSubscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tenantSubscription.count({ where: { status: 'TRIALING' } }),
      this.prisma.tenantModuleOverride.count(),
      this.prisma.globalModuleCatalog.count(),
    ]);
    return { tenants, activeSubs, trialingSubs, overrides, catalog };
  }

  @Get('tenants')
  async listTenants() {
    return this.prisma.tenant.findMany({
      where: { deletedAt: null },
      include: {
        subscription: true,
        moduleOverrides: true,
        plugins: { select: { moduleKey: true, status: true } },
        sheetConnection: { select: { googleEmail: true, status: true } },
        _count: { select: { employees: true, students: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch('tenants/:tenantId/subscription')
  async updateSubscription(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      plan: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
      status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
      trialDays?: number;
    },
  ) {
    const trialEndsAt = body.trialDays
      ? new Date(Date.now() + body.trialDays * 24 * 60 * 60 * 1000)
      : undefined;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: body.plan },
    });

    return this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      update: {
        plan: body.plan,
        status: body.status,
        ...(trialEndsAt ? { trialEndsAt } : {}),
        ...(body.status === 'ACTIVE'
          ? { currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
          : {}),
      },
      create: {
        tenantId,
        plan: body.plan,
        status: body.status,
        trialEndsAt: trialEndsAt || null,
        currentPeriodEnd:
          body.status === 'ACTIVE' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        provider: 'MANUAL',
      },
    });
  }

  /**
   * 1-Click Trial & Bypass Control for SaaS Founder:
   * - mode: 'DAYS' (7, 15, 30, 60, etc.) -> sets TRIALING ending in `days`
   * - mode: 'UNLIMITED' -> activates ENTERPRISE bypass (provider = 'BYPASS', expires 2099)
   * - mode: 'EXPIRE' -> immediately marks PAST_DUE with expired timestamp (soft lock)
   */
  @Patch('tenants/:tenantId/trial')
  async setTrialOrBypass(
    @Param('tenantId') tenantId: string,
    @Body() body: { mode: 'DAYS' | 'UNLIMITED' | 'EXPIRE'; days?: number },
  ) {
    const now = Date.now();

    if (body.mode === 'UNLIMITED') {
      const farFuture = new Date('2099-12-31T23:59:59.000Z');
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { plan: 'ENTERPRISE' },
      });
      return this.prisma.tenantSubscription.upsert({
        where: { tenantId },
        update: {
          plan: 'ENTERPRISE',
          status: 'ACTIVE',
          provider: 'BYPASS',
          trialEndsAt: null,
          currentPeriodEnd: farFuture,
        },
        create: {
          tenantId,
          plan: 'ENTERPRISE',
          status: 'ACTIVE',
          provider: 'BYPASS',
          trialEndsAt: null,
          currentPeriodEnd: farFuture,
        },
      });
    }

    if (body.mode === 'EXPIRE') {
      const past = new Date(now - 60 * 1000);
      return this.prisma.tenantSubscription.upsert({
        where: { tenantId },
        update: {
          status: 'PAST_DUE',
          provider: 'MANUAL',
          trialEndsAt: past,
          currentPeriodEnd: past,
        },
        create: {
          tenantId,
          plan: 'STARTER',
          status: 'PAST_DUE',
          provider: 'MANUAL',
          trialEndsAt: past,
          currentPeriodEnd: past,
        },
      });
    }

    const days = Math.max(1, Number(body.days || 15));
    const trialEndsAt = new Date(now + days * 24 * 60 * 60 * 1000);
    return this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      update: {
        status: 'TRIALING',
        provider: 'MANUAL',
        trialEndsAt,
        currentPeriodEnd: null,
      },
      create: {
        tenantId,
        plan: 'STARTER',
        status: 'TRIALING',
        provider: 'MANUAL',
        trialEndsAt,
      },
    });
  }

  /** Grant Testing Free, Beta Free (with optional expiry days), Paid Add-on, or Block a module for a company */
  @Post('overrides')
  async grantOverride(
    @CurrentUser() user: AuthContext,
    @Body()
    body: {
      tenantId: string;
      moduleKey: string;
      accessType: 'TESTING_FREE' | 'BETA_FREE' | 'PAID_ADDON' | 'BLOCKED';
      expiryDays?: number | null;
      note?: string;
    },
  ) {
    const expiresAt =
      body.expiryDays && body.expiryDays > 0
        ? new Date(Date.now() + body.expiryDays * 24 * 60 * 60 * 1000)
        : null;

    return this.prisma.tenantModuleOverride.upsert({
      where: { tenantId_moduleKey: { tenantId: body.tenantId, moduleKey: body.moduleKey } },
      update: {
        accessType: body.accessType,
        expiresAt,
        note: body.note || null,
        grantedByEmail: user.email,
      },
      create: {
        tenantId: body.tenantId,
        moduleKey: body.moduleKey,
        accessType: body.accessType,
        expiresAt,
        note: body.note || null,
        grantedByEmail: user.email,
      },
    });
  }

  @Delete('overrides/:id')
  removeOverride(@Param('id') id: string) {
    return this.prisma.tenantModuleOverride.delete({ where: { id } });
  }

  @Get('catalog')
  listCatalog() {
    return this.prisma.globalModuleCatalog.findMany({ orderBy: { moduleKey: 'asc' } });
  }

  @Patch('catalog/:moduleKey')
  updateCatalog(
    @Param('moduleKey') moduleKey: string,
    @Body()
    body: {
      releaseStage?: 'INTERNAL_TESTING' | 'BETA' | 'PUBLIC';
      requiredPlan?: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
      addonPriceInr?: number;
    },
  ) {
    return this.prisma.globalModuleCatalog.update({
      where: { moduleKey },
      data: {
        ...(body.releaseStage ? { releaseStage: body.releaseStage } : {}),
        ...(body.requiredPlan ? { requiredPlan: body.requiredPlan } : {}),
        ...(body.addonPriceInr !== undefined
          ? { addonPricePaise: BigInt(Math.round(body.addonPriceInr * 100)) }
          : {}),
      },
    });
  }
}
