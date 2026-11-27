import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GoogleSheetsService } from '../sheets/google-sheets.service';
import { HybridAuthGuard } from '../../common/guards/hybrid-auth.guard';
import { OrgSetupGuard } from '../../common/guards/org-setup.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(HybridAuthGuard, OrgSetupGuard)
@Controller('core/products')
export class ProductsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sheetsService: GoogleSheetsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthContext) {
    return this.prisma.product.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  @Post()
  async create(
    @CurrentUser() user: AuthContext,
    @Body()
    body: {
      name: string;
      mode?: string;
      priceInr?: number;
      description?: string;
      feePlansJson?: unknown;
    },
  ) {
    const count = await this.prisma.product.count({ where: { tenantId: user.tenantId! } });
    const code = `PRD-${String(count + 1).padStart(4, '0')}`;
    const pricePaise = BigInt(Math.round((body.priceInr || 0) * 100));

    const product = await this.prisma.product.create({
      data: {
        tenantId: user.tenantId!,
        code,
        name: body.name.trim(),
        mode: body.mode || 'OFFLINE',
        pricePaise,
        description: body.description || null,
        feePlansJson: (body.feePlansJson as object) || [],
      },
    });
    await this.sheetsService.enqueueSync(user.tenantId!, 'core', 'products').catch(() => {});
    return product;
  }
}
