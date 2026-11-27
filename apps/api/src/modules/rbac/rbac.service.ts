import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const SCOPE_RANK: Record<string, number> = {
  OWN: 1,
  TEAM: 2,
  DEPARTMENT: 3,
  ALL: 4,
};

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  async createRole(
    tenantId: string,
    dto: { name: string; description?: string; permissionKeys: string[]; workspaceKeys?: string[] },
  ) {
    return this.prisma.role.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: dto.description || null,
        permissionKeys: dto.permissionKeys || [],
        workspaceKeys: dto.workspaceKeys || ['personal_space'],
      },
    });
  }

  async listWorkspaces(tenantId: string) {
    return this.prisma.workspace.findMany({ where: { tenantId, isActive: true } });
  }

  async listDelegations(tenantId: string) {
    return this.prisma.delegation.findMany({
      where: { tenantId, isRevoked: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Attorney Delegation Engine — Strictly enforces Master Spec Rule:
   * Delegated permission can NEVER exceed the giver's own scope or amount limit!
   */
  async createDelegation(
    tenantId: string,
    giverEmpId: string,
    isOwner: boolean,
    dto: {
      receiverEmpId: string;
      permissionKey: string;
      scope: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ALL';
      maxAmountPaise?: number;
      validTill?: string;
    },
  ) {
    if (!isOwner) {
      const giverRoles = await this.prisma.userRole.findMany({
        where: { tenantId, employeeId: giverEmpId },
        include: { role: true },
      });

      const matching = giverRoles.filter(
        (ur) =>
          ur.role.permissionKeys.includes('*') ||
          ur.role.permissionKeys.includes(dto.permissionKey),
      );

      if (!matching.length) {
        throw new ForbiddenException('You cannot delegate a permission you do not hold.');
      }

      const maxGiverRank = Math.max(...matching.map((m) => SCOPE_RANK[m.scope] || 1));
      const requestedRank = SCOPE_RANK[dto.scope] || 1;
      if (requestedRank > maxGiverRank) {
        throw new BadRequestException(
          `Delegation rejected: requested scope (${dto.scope}) exceeds giver's scope.`,
        );
      }
    }

    return this.prisma.delegation.create({
      data: {
        tenantId,
        giverEmpId,
        receiverEmpId: dto.receiverEmpId,
        permissionKey: dto.permissionKey,
        scope: dto.scope,
        maxAmount: dto.maxAmountPaise ? BigInt(dto.maxAmountPaise) : null,
        validTill: dto.validTill ? new Date(dto.validTill) : null,
      },
    });
  }

  /** Cascade revoke: revoking a delegation automatically revokes downstream grants */
  async revokeDelegation(tenantId: string, id: string) {
    const target = await this.prisma.delegation.update({
      where: { id },
      data: { isRevoked: true, revokedAt: new Date() },
    });
    await this.prisma.delegation.updateMany({
      where: { tenantId, parentGrantId: id, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
    return target;
  }
}
