import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';
import { OrgSetupGuard } from '../../common/guards/org-setup.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(HybridAuthGuard, OrgSetupGuard)
@Controller('core/students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Get()
  list(@CurrentUser() user: AuthContext, @Query('search') search?: string) {
    return this.service.list(user.tenantId!, search);
  }

  @Post()
  create(
    @CurrentUser() user: AuthContext,
    @Body()
    body: {
      fullName: string;
      phone: string;
      email?: string;
      productId?: string;
      leadId?: string;
      guardianName?: string;
      guardianPhone?: string;
    },
  ) {
    return this.service.create(user.tenantId!, user.employeeCode || user.email, body);
  }
}
