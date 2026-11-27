import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';

@Module({ controllers: [ProductsController] })
export class ProductsModule {}
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [ProductsController] })
export class ProductsModule {}
