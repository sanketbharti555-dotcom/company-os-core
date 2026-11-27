import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GoogleSheetsService } from './google-sheets.service';

@Processor('sheets-sync')
export class SheetsSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SheetsSyncProcessor.name);

  constructor(private readonly sheetsService: GoogleSheetsService) {
    super();
  }

  async process(job: Job<{ tenantId: string; moduleKey: string; tableName: string }>) {
    const { tenantId, moduleKey } = job.data;
    this.logger.log(`Syncing ${moduleKey} tables to Google Sheets for tenant ${tenantId}`);
    try {
      await this.sheetsService.pushCoreTablesToSheet(tenantId);
    } catch (err) {
      this.logger.error(`Sheets sync failed for tenant ${tenantId}: ${(err as Error).message}`);
      throw err; // BullMQ retries with exponential backoff
    }
  }
}
