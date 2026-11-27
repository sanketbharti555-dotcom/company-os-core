import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../crypto/encryption.service';

/**
 * ModuleTokenGuard — Allows future plugins (CRM, Academic, Finance, HRMS) to call
 * Core APIs on behalf of an Organization using:
 *   Authorization: Bearer cos_mod_...
 *   X-Tenant-Id: <tenantId>
 *   X-Actor-Employee-Id: <EMP-0001>
 *
 * Also transparently passes through standard User JWT requests if token is not a module token.
 */
@Injectable()
export class ModuleTokenGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = String(req.headers['authorization'] || '');
    if (!authHeader.startsWith('Bearer cos_mod_')) {
      return false; // Let JwtAuthGuard handle standard user tokens
    }

    const rawToken = authHeader.slice('Bearer '.length).trim();
    const tokenHash = this.crypto.sha256(rawToken);
    const tenantId = String(req.headers['x-tenant-id'] || '').trim();
    const actorEmpCode = String(req.headers['x-actor-employee-id'] || '').trim();

    if (!tenantId || !actorEmpCode) {
      throw new UnauthorizedException(
        'Plugin calls require X-Tenant-Id and X-Actor-Employee-Id headers.',
      );
    }

    const tokenRecord = await this.prisma.moduleToken.findUnique({
      where: { tokenHash },
      include: { tenant: true },
    });

    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Module token is invalid, expired, or revoked.');
    }

    if (tokenRecord.tenantId !== tenantId && tokenRecord.tenant.code !== tenantId) {
      throw new ForbiddenException('Module token does not belong to the requested Organization.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId: tokenRecord.tenantId,
        code: actorEmpCode,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (!employee) {
      throw new ForbiddenException('Invalid Employee ID: actor must exist and be Active.');
    }

    await this.prisma.moduleToken.update({
      where: { id: tokenRecord.id },
      data: { lastUsedAt: new Date() },
    });

    req.user = {
      userId: `module:${tokenRecord.moduleKey}`,
      email: `${tokenRecord.moduleKey}@plugin.local`,
      tenantId: tokenRecord.tenantId,
      employeeId: employee.id,
      employeeCode: employee.code,
      isOwner: false,
      setupStatus: tokenRecord.tenant.setupStatus,
      authType: 'MODULE_TOKEN',
      moduleKey: tokenRecord.moduleKey,
      scopes: tokenRecord.scopes,
    };

    return true;
  }
}
