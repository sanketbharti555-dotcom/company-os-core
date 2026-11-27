import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthContext } from '../decorators/current-user.decorator';

/**
 * OrgSetupGuard — Enforces the SaaS Organization Gate:
 * A logged-in user CANNOT access any Core OS feature until they have created
 * (or joined) an Organization with setupStatus === 'COMPLETED'.
 */
@Injectable()
export class OrgSetupGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthContext | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }
    if (user.authType === 'MODULE_TOKEN') {
      return true;
    }

    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    const tenantId = headerTenantId || user.tenantId;

    if (!tenantId) {
      throw new ForbiddenException({
        code: 'ORG_SETUP_REQUIRED',
        message: 'Please complete Organization Setup before using Company OS features.',
      });
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: { userId_tenantId: { userId: user.userId, tenantId } },
      include: { tenant: true, employee: true },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('You are not an active member of this organization.');
    }

    if (membership.tenant.setupStatus !== 'COMPLETED') {
      throw new ForbiddenException({
        code: 'ORG_SETUP_REQUIRED',
        message: 'Organization setup is incomplete. Finish the setup wizard to unlock OS features.',
      });
    }

    if (membership.employee && membership.employee.status !== 'ACTIVE') {
      throw new ForbiddenException('Employee ID is inactive. Access revoked.');
    }

    // Hydrate verified tenant and employee context onto req.user
    user.tenantId = membership.tenantId;
    user.employeeId = membership.employee?.id || null;
    user.employeeCode = membership.employee?.code || null;
    user.isOwner = membership.isOwner;
    user.setupStatus = membership.tenant.setupStatus;

    return true;
  }
}
