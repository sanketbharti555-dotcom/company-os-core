import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { GoogleSheetsService } from '../sheets/google-sheets.service';

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly sheetsService: GoogleSheetsService,
  ) {}

  /**
   * 4-Step SaaS Organization Setup Wizard:
   * 1. Creates Tenant (TEN-XXXX) with branding & regional settings
   * 2. Creates active academic/financial Session (e.g. 2026-27)
   * 3. Creates default Departments, Super Admin Role, Core Workspaces & EMP-0001
   * 4. If user logged in with Google, auto-connects Drive & creates "Company OS Data – <Org>" folder + Core Sheet!
   * 5. Marks setupStatus = 'COMPLETED' and returns fresh JWT with tenantId unlocked.
   */
  async setupOrganization(
    userId: string,
    dto: {
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found.');

    const count = await this.prisma.tenant.count();
    const tenantCode = `TEN-${String(count + 1).padStart(4, '0')}`;
    const baseSlug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const slug = `${baseSlug || 'org'}-${Date.now().toString(36)}`;
    const sessionCode = dto.sessionCode || '2026-27';

    const tenant = await this.prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          code: tenantCode,
          name: dto.name.trim(),
          legalName: dto.legalName?.trim() || dto.name.trim(),
          slug,
          gstin: dto.gstin?.trim() || null,
          phone: dto.phone.trim(),
          email: dto.email?.trim() || user.email,
          address: dto.address?.trim() || null,
          logoUrl: dto.logoUrl?.trim() || null,
          setupStatus: 'COMPLETED',
          settingsJson: {
            timezone: dto.timezone || 'Asia/Kolkata',
            currency: dto.currency || 'INR',
            dateFormat: 'DD-MM-YYYY',
            workingHours: { start: '09:00', end: '18:00' },
          },
        },
      });

      // Default 14-day SaaS Starter Trial Subscription
      await tx.tenantSubscription.create({
        data: {
          tenantId: createdTenant.id,
          plan: 'STARTER',
          status: 'TRIALING',
          trialEndsAt: new Date(Date.now() + Number(process.env.DEFAULT_TRIAL_DAYS || 15) * 24 * 60 * 60 * 1000),
          provider: 'MANUAL',
        },
      });

      // Default active Session
      await tx.session.create({
        data: {
          tenantId: createdTenant.id,
          code: sessionCode,
          name: `Session ${sessionCode}`,
          startDate: new Date('2026-04-01'),
          endDate: new Date('2027-03-31'),
          status: 'ACTIVE',
          isCurrent: true,
        },
      });

      // Default Departments
      const mgmtDept = await tx.department.create({
        data: { tenantId: createdTenant.id, code: 'DEPT-MGMT', name: 'Management' },
      });
      await tx.department.createMany({
        data: [
          { tenantId: createdTenant.id, code: 'DEPT-CRM', name: 'CRM & Admissions' },
          { tenantId: createdTenant.id, code: 'DEPT-ACAD', name: 'Academic' },
          { tenantId: createdTenant.id, code: 'DEPT-FIN', name: 'Finance' },
          { tenantId: createdTenant.id, code: 'DEPT-HR', name: 'HR & Operations' },
        ],
      });

      // Founding Super Admin Employee (EMP-0001)
      const adminEmp = await tx.employee.create({
        data: {
          tenantId: createdTenant.id,
          code: 'EMP-0001',
          fullName: user.fullName,
          email: user.email,
          phone: dto.phone.trim(),
          departmentId: mgmtDept.id,
          designation: 'Founder / Super Admin',
          status: 'ACTIVE',
          roleTags: ['SuperAdmin', 'DepartmentHead'],
        },
      });

      await tx.department.update({
        where: { id: mgmtDept.id },
        data: { headEmployeeId: adminEmp.id },
      });

      // Default Core Workspaces (Skins)
      const coreWorkspace = await tx.workspace.create({
        data: {
          tenantId: createdTenant.id,
          key: 'core_admin',
          name: 'Core Platform Admin',
          moduleKey: 'core',
          menusJson: ['dashboard', 'sheets', 'employees', 'rbac', 'students', 'tasks-hub', 'plugins'],
        },
      });
      await tx.workspace.create({
        data: {
          tenantId: createdTenant.id,
          key: 'personal_space',
          name: 'Personal Space & Daily Hub',
          moduleKey: 'core',
          menusJson: ['tasks-hub', 'notices', 'profile'],
        },
      });

      // Default Super Admin Role
      const superAdminRole = await tx.role.create({
        data: {
          tenantId: createdTenant.id,
          name: 'Super Admin',
          description: 'Full access to all Core engines, builders, Sheets sync and plugins',
          permissionKeys: ['*'],
          workspaceKeys: ['core_admin', 'personal_space'],
          isSystem: true,
        },
      });

      await tx.userRole.create({
        data: {
          tenantId: createdTenant.id,
          employeeId: adminEmp.id,
          roleId: superAdminRole.id,
          scope: 'ALL',
        },
      });

      await tx.userWorkspace.create({
        data: {
          tenantId: createdTenant.id,
          employeeId: adminEmp.id,
          workspaceId: coreWorkspace.id,
        },
      });

      // Link SaaS User to Organization
      await tx.organizationMembership.create({
        data: {
          userId: user.id,
          tenantId: createdTenant.id,
          employeeId: adminEmp.id,
          isOwner: true,
          status: 'ACTIVE',
        },
      });

      return createdTenant;
    });

    // Auto-connect logged-in Google Account to Drive & create Company OS Data folder!
    let googleDriveProvisioned = false;
    let driveWarning: string | null = null;
    if (
      dto.autoConnectGoogleDrive !== false &&
      user.googleAccessTokenEnc &&
      user.googleRefreshTokenEnc
    ) {
      try {
        await this.sheetsService.connectWithTokens(
          tenant.id,
          user.email,
          user.googleAccessTokenEnc,
          user.googleRefreshTokenEnc,
          user.googleTokenExpiry,
        );
        googleDriveProvisioned = true;
      } catch (err) {
        driveWarning = (err as Error).message;
      }
    }

    const authBundle = await this.authService.issueTokensForUser(user.id, tenant.id);
    return {
      ...authBundle,
      googleDriveProvisioned,
      driveWarning,
    };
  }

  async getCurrentOrg(tenantId: string) {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        sessions: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        sheetConnection: {
          select: {
            googleEmail: true,
            driveFolderName: true,
            driveFolderUrl: true,
            status: true,
            twoWayEnabled: true,
            lastSyncedAt: true,
          },
        },
      },
    });
  }

  async updateBranding(
    tenantId: string,
    dto: {
      name?: string;
      legalName?: string;
      gstin?: string;
      phone?: string;
      address?: string;
      logoUrl?: string;
      website?: string;
    },
  ) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
    });
  }
}
