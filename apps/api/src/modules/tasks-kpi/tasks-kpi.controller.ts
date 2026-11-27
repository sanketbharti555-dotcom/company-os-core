import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgSetupGuard } from '../../common/guards/org-setup.guard';
import { AuthContext, CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, OrgSetupGuard)
@Controller('core')
export class TasksKpiController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('kra')
  listKras(@CurrentUser() user: AuthContext) {
    return this.prisma.kra.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      include: { kpis: true, department: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('kra')
  createKra(
    @CurrentUser() user: AuthContext,
    @Body()
    body: {
      name: string;
      departmentId?: string;
      roleTag?: string;
      frequency?: string;
      sopTitle?: string;
      sopContent?: string;
    },
  ) {
    return this.prisma.kra.create({
      data: {
        tenantId: user.tenantId!,
        name: body.name.trim(),
        departmentId: body.departmentId || null,
        roleTag: body.roleTag || null,
        frequency: body.frequency || 'DAILY',
        sopTitle: body.sopTitle || null,
        sopContent: body.sopContent || null,
      },
    });
  }

  @Post('kpi')
  createKpi(
    @CurrentUser() user: AuthContext,
    @Body()
    body: {
      kraId: string;
      name: string;
      targetValue: number;
      unit?: string;
      source?: string;
      sourceEvent?: string;
      weight?: number;
    },
  ) {
    return this.prisma.kpi.create({
      data: {
        tenantId: user.tenantId!,
        kraId: body.kraId,
        name: body.name.trim(),
        targetValue: Number(body.targetValue || 1),
        unit: body.unit || 'NUMBER',
        source: body.source || 'EVENT',
        sourceEvent: body.sourceEvent || null,
        weight: Number(body.weight || 100),
        formulaJson: { type: 'count', event: body.sourceEvent || 'manual' },
      },
    });
  }

  @Get('tasks')
  listTasks(@CurrentUser() user: AuthContext) {
    return this.prisma.task.findMany({
      where: { tenantId: user.tenantId!, deletedAt: null },
      include: { assignedTo: true },
      orderBy: { dueDate: 'desc' },
    });
  }

  @Post('tasks')
  createTask(
    @CurrentUser() user: AuthContext,
    @Body()
    body: {
      title: string;
      assignedToId?: string;
      targetValue?: number;
      inputType?: string;
      source?: string;
      dueDate?: string;
    },
  ) {
    return this.prisma.task.create({
      data: {
        tenantId: user.tenantId!,
        title: body.title.trim(),
        assignedToId: body.assignedToId || user.employeeId!,
        targetValue: Number(body.targetValue || 1),
        inputType: body.inputType || 'NUMBER',
        source: body.source || 'KPI',
        dueDate: body.dueDate ? new Date(body.dueDate) : new Date(),
      },
    });
  }

  @Post('hub/eod')
  async submitEod(
    @CurrentUser() user: AuthContext,
    @Body() body: { date?: string; actuals: Array<{ taskId: string; actualValue: number }>; notes?: string },
  ) {
    const date = body.date || new Date().toISOString().slice(0, 10);
    let totalWeighted = 0;
    let totalWeight = 0;

    for (const item of body.actuals || []) {
      const task = await this.prisma.task.findUnique({ where: { id: item.taskId } });
      if (!task) continue;
      const pct = Math.min(200, task.targetValue > 0 ? (item.actualValue / task.targetValue) * 100 : 100);
      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          actualValue: item.actualValue,
          scoreAuto: pct,
          status: item.actualValue >= task.targetValue ? 'DONE' : 'IN_PROGRESS',
          completedAt: item.actualValue >= task.targetValue ? new Date() : null,
        },
      });
      totalWeighted += pct * task.weight;
      totalWeight += task.weight;
    }

    const autoScore = totalWeight > 0 ? Math.round(totalWeighted / totalWeight) : 0;

    const eod = await this.prisma.eodSubmission.upsert({
      where: {
        tenantId_employeeId_date: {
          tenantId: user.tenantId!,
          employeeId: user.employeeId!,
          date,
        },
      },
      update: { actualsJson: body.actuals as object, notes: body.notes || null, status: 'SUBMITTED' },
      create: {
        tenantId: user.tenantId!,
        employeeId: user.employeeId!,
        date,
        actualsJson: body.actuals as object,
        notes: body.notes || null,
      },
    });

    await this.prisma.dailyScore.upsert({
      where: {
        tenantId_employeeId_date: {
          tenantId: user.tenantId!,
          employeeId: user.employeeId!,
          date,
        },
      },
      update: { autoScore, finalScore: autoScore },
      create: {
        tenantId: user.tenantId!,
        employeeId: user.employeeId!,
        date,
        autoScore,
        finalScore: autoScore,
      },
    });

    return { eod, autoScore };
  }

  /** Head Verification & 0–200% Override with mandatory reason */
  @Post('hub/score')
  async overrideScore(
    @CurrentUser() user: AuthContext,
    @Body() body: { employeeId: string; date: string; finalScore: number; reason: string },
  ) {
    if (body.finalScore < 0 || body.finalScore > 200) {
      throw new BadRequestException('Final score must be strictly between 0% and 200%.');
    }
    if (!body.reason?.trim()) {
      throw new BadRequestException('A mandatory reason is required for score overrides.');
    }
    return this.prisma.dailyScore.upsert({
      where: {
        tenantId_employeeId_date: {
          tenantId: user.tenantId!,
          employeeId: body.employeeId,
          date: body.date,
        },
      },
      update: {
        finalScore: body.finalScore,
        reason: body.reason.trim(),
        scoredByEmp: user.employeeCode || user.email,
      },
      create: {
        tenantId: user.tenantId!,
        employeeId: body.employeeId,
        date: body.date,
        autoScore: body.finalScore,
        finalScore: body.finalScore,
        reason: body.reason.trim(),
        scoredByEmp: user.employeeCode || user.email,
      },
    });
  }
}
