import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';
import { OrgSetupGuard } from '../../common/guards/org-setup.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(HybridAuthGuard, OrgSetupGuard)
@Controller('core')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get('employees')
  list(@CurrentUser() user: AuthContext, @Query('roleTag') roleTag?: string) {
    return this.service.list(user.tenantId!, roleTag);
  }

  @Post('employees')
  create(
    @CurrentUser() user: AuthContext,
    @Body()
    body: {
      fullName: string;
      email: string;
      phone: string;
      departmentId?: string;
      designation?: string;
      employmentType?: string;
      roleTags?: string[];
    },
  ) {
    return this.service.create(user.tenantId!, user.employeeCode || user.email, body);
  }

  @Patch('employees/:id/deactivate')
  deactivate(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.service.deactivate(user.tenantId!, id, user.employeeCode || user.email);
  }

  @Get('departments')
  listDepartments(@CurrentUser() user: AuthContext) {
    return this.service.listDepartments(user.tenantId!);
  }

  @Post('departments')
  createDepartment(
    @CurrentUser() user: AuthContext,
    @Body() body: { name: string; code?: string; headEmployeeId?: string },
  ) {
    return this.service.createDepartment(user.tenantId!, body);
  }
}
