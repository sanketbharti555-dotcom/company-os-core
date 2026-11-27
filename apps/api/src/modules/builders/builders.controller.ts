import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgSetupGuard } from '../../common/guards/org-setup.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('core')
export class BuildersController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard, OrgSetupGuard)
  @Get('forms')
  listForms(@CurrentUser() user: AuthContext) {
    return this.prisma.form.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(JwtAuthGuard, OrgSetupGuard)
  @Post('forms')
  createForm(
    @CurrentUser() user: AuthContext,
    @Body() body: { title: string; formType?: string; fieldsJson: unknown; actionType?: string },
  ) {
    const slug = `${body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    return this.prisma.form.create({
      data: {
        tenantId: user.tenantId!,
        title: body.title.trim(),
        formType: body.formType || 'CUSTOM',
        fieldsJson: (body.fieldsJson as object) || [],
        actionType: body.actionType || 'SAVE_RECORD',
        isPublished: true,
        publicSlug: slug,
      },
    });
  }

  @Post('forms/:slug/submit')
  async submitPublicForm(@Param('slug') slug: string, @Body() dataJson: Record<string, unknown>) {
    const form = await this.prisma.form.findUnique({ where: { publicSlug: slug } });
    if (!form || !form.isPublished) return { submitted: false, error: 'Form not found' };
    const sub = await this.prisma.formSubmission.create({
      data: { tenantId: form.tenantId, formId: form.id, dataJson: dataJson as object },
    });
    return { submitted: true, submissionId: sub.id };
  }
}
