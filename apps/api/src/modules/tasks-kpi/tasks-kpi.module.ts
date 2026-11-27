import { Module } from '@nestjs/common';
import { TasksKpiController } from './tasks-kpi.controller';

@Module({ controllers: [TasksKpiController] })
export class TasksKpiModule {}
