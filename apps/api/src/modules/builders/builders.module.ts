import { Module } from '@nestjs/common';
import { BuildersController } from './builders.controller';

@Module({ controllers: [BuildersController] })
export class BuildersModule {}
