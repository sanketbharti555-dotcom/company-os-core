import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgSetupGuard } from '../../common/guards/org-setup.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, OrgSetupGuard)
@Controller('core/sessions')
export class SessionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: AuthContext) {
    return this.prisma.session.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('clone')
  async startNewSession(
    @CurrentUser() user: AuthContext,
    @Body() body: { code: string; name: string; startDate: string; endDate: string },
  ) {
    const tenantId = user.tenantId!;
    return this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { tenantId, isCurrent: true },
        data: { isCurrent: false, status: 'ARCHIVED' },
      });
      return tx.session.create({
        data: {
          tenantId,
          code: body.code.trim(),
          name: body.name.trim(),
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          status: 'ACTIVE',
          isCurrent: true,
        },
      });
    });
  }
}
