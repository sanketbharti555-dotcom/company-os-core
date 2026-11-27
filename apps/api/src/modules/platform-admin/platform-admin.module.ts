import { Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';
import { MarketplaceController } from './marketplace.controller';
import { EntitlementService } from './entitlement.service';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PluginsModule } from '../plugins/plugins.module';

@Module({
  imports: [PluginsModule],
  controllers: [PlatformAdminController, MarketplaceController],
  providers: [EntitlementService, PlatformAdminGuard],
  exports: [EntitlementService],
})
export class PlatformAdminModule {}
