import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SheetsController } from './sheets.controller';
import { GoogleSheetsService } from './google-sheets.service';
import { SheetsSyncProcessor } from './sheets-sync.processor';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: 'sheets-sync' })],
  controllers: [SheetsController],
  providers: [GoogleSheetsService, SheetsSyncProcessor],
  exports: [GoogleSheetsService],
})
export class SheetsModule {}
