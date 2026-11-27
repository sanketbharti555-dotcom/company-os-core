import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgSetupGuard } from '../../common/guards/org-setup.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, OrgSetupGuard)
@Controller('core')
export class RbacController {
  constructor(private readonly service: RbacService) {}

  @Get('roles')
  listRoles(@CurrentUser() user: AuthContext) {
    return this.service.listRoles(user.tenantId!);
  }

  @Post('roles')
  createRole(
    @CurrentUser() user: AuthContext,
    @Body()
    body: { name: string; description?: string; permissionKeys: string[]; workspaceKeys?: string[] },
  ) {
    return this.service.createRole(user.tenantId!, body);
  }

  @Get('workspaces')
  listWorkspaces(@CurrentUser() user: AuthContext) {
    return this.service.listWorkspaces(user.tenantId!);
  }

  @Get('delegations')
  listDelegations(@CurrentUser() user: AuthContext) {
    return this.service.listDelegations(user.tenantId!);
  }

  @Post('delegations')
  createDelegation(
    @CurrentUser() user: AuthContext,
    @Body()
    body: {
      receiverEmpId: string;
      permissionKey: string;
      scope: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ALL';
      maxAmountPaise?: number;
      validTill?: string;
    },
  ) {
    return this.service.createDelegation(user.tenantId!, user.employeeId!, user.isOwner, body);
  }

  @Patch('delegations/:id/revoke')
  revokeDelegation(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.revokeDelegation(user.tenantId!, id);
  }
}
