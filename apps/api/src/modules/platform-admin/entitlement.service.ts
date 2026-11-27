import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const PLAN_RANK: Record<string, number> = {
  STARTER: 1,
  GROWTH: 2,
  ENTERPRISE: 3,
};

export interface ModuleEntitlementResult {
  moduleKey: string;
  name: string;
  description: string;
  version: string;
  releaseStage: string;
  requiredPlan: string;
  addonPriceInr: number;
  visible: boolean;
  canInstall: boolean;
  isInstalled: boolean;
  accessReason:
    | 'TESTING_FREE'
    | 'BETA_FREE'
    | 'PAID_ADDON'
    | 'INCLUDED_IN_PLAN'
    | 'UPGRADE_REQUIRED'
    | 'HIDDEN_RELEASE_STAGE'
    | 'BLOCKED';
  expiresAt: string | null;
}

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateAllForTenant(tenantId: string): Promise<{
    subscription: {
      plan: string;
      status: string;
      trialEndsAt: Date | null;
      currentPeriodEnd: Date | null;
    };
    modules: ModuleEntitlementResult[];
  }> {
    const [catalog, subscription, overrides, installed] = await Promise.all([
      this.prisma.globalModuleCatalog.findMany({ orderBy: { moduleKey: 'asc' } }),
      this.prisma.tenantSubscription.findUnique({ where: { tenantId } }),
      this.prisma.tenantModuleOverride.findMany({ where: { tenantId } }),
      this.prisma.tenantPlugin.findMany({ where: { tenantId } }),
    ]);

    const sub = subscription || {
      plan: 'STARTER',
      status: 'TRIALING',
      trialEndsAt: null,
      currentPeriodEnd: null,
    };

    const overrideMap = new Map(overrides.map((o) => [o.moduleKey, o]));
    const installedMap = new Map(installed.map((p) => [p.moduleKey, p]));
    const now = new Date();
    const subActive = sub.status === 'ACTIVE' || sub.status === 'TRIALING';
    const tenantPlanRank = subActive ? PLAN_RANK[sub.plan] || 1 : 0;

    const modules: ModuleEntitlementResult[] = catalog.map((mod) => {
      const ov = overrideMap.get(mod.moduleKey);
      const ovActive = ov && (!ov.expiresAt || ov.expiresAt > now);
      const inst = installedMap.get(mod.moduleKey);
      const isInstalled = Boolean(inst && inst.status === 'ENABLED');
      const addonPriceInr = Number(mod.addonPricePaise) / 100;

      // Priority 1: Explicit Platform Admin Override (Testing / Beta / Paid Add-on / Blocked)
      if (ovActive && ov) {
        if (ov.accessType === 'BLOCKED') {
          return {
            moduleKey: mod.moduleKey,
            name: mod.name,
            description: mod.description,
            version: mod.version,
            releaseStage: mod.releaseStage,
            requiredPlan: mod.requiredPlan,
            addonPriceInr,
            visible: false,
            canInstall: false,
            isInstalled,
            accessReason: 'BLOCKED',
            expiresAt: ov.expiresAt ? ov.expiresAt.toISOString() : null,
          };
        }
        return {
          moduleKey: mod.moduleKey,
          name: mod.name,
          description: mod.description,
          version: mod.version,
          releaseStage: mod.releaseStage,
          requiredPlan: mod.requiredPlan,
          addonPriceInr,
          visible: true,
          canInstall: true,
          isInstalled,
          accessReason: ov.accessType as 'TESTING_FREE' | 'BETA_FREE' | 'PAID_ADDON',
          expiresAt: ov.expiresAt ? ov.expiresAt.toISOString() : null,
        };
      }

      // Priority 2: Hide INTERNAL_TESTING or BETA modules from normal public tenants
      if (mod.releaseStage !== 'PUBLIC') {
        return {
          moduleKey: mod.moduleKey,
          name: mod.name,
          description: mod.description,
          version: mod.version,
          releaseStage: mod.releaseStage,
          requiredPlan: mod.requiredPlan,
          addonPriceInr,
          visible: false,
          canInstall: false,
          isInstalled,
          accessReason: 'HIDDEN_RELEASE_STAGE',
          expiresAt: null,
        };
      }

      // Priority 3: Public module -> check Tenant's SaaS Subscription Plan
      const reqRank = PLAN_RANK[mod.requiredPlan] || 2;
      if (tenantPlanRank >= reqRank) {
        return {
          moduleKey: mod.moduleKey,
          name: mod.name,
          description: mod.description,
          version: mod.version,
          releaseStage: mod.releaseStage,
          requiredPlan: mod.requiredPlan,
          addonPriceInr,
          visible: true,
          canInstall: true,
          isInstalled,
          accessReason: 'INCLUDED_IN_PLAN',
          expiresAt: null,
        };
      }

      return {
        moduleKey: mod.moduleKey,
        name: mod.name,
        description: mod.description,
        version: mod.version,
        releaseStage: mod.releaseStage,
        requiredPlan: mod.requiredPlan,
        addonPriceInr,
        visible: true,
        canInstall: false,
        isInstalled,
        accessReason: 'UPGRADE_REQUIRED',
        expiresAt: null,
      };
    });

    return {
      subscription: {
        plan: sub.plan,
        status: sub.status,
        trialEndsAt: sub.trialEndsAt,
        currentPeriodEnd: sub.currentPeriodEnd,
      },
      modules,
    };
  }
}
