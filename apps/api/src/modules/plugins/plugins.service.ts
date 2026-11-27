import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { GoogleSheetsService } from '../sheets/google-sheets.service';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class PluginsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
    private readonly sheetsService: GoogleSheetsService,
    private readonly eventBus: EventBusService,
  ) {}

  async listPlugins(tenantId: string) {
    const plugins = await this.prisma.tenantPlugin.findMany({
      where: { tenantId },
      orderBy: { installedAt: 'desc' },
    });
    const tokens = await this.prisma.moduleToken.findMany({
      where: { tenantId },
      select: {
        id: true,
        moduleKey: true,
        label: true,
        tokenPrefix: true,
        scopes: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { plugins, tokens };
  }

  /**
   * 3-Step Plugin Docking for an Organization:
   * 1. Validates Plugin Manifest (`core-v1`)
   * 2. Registers plugin's Workspaces & Permissions for this Organization
   * 3. Automatically provisions the Plugin's Google Spreadsheet inside the Org's Drive Folder!
   */
  async registerPlugin(
    tenantId: string,
    manifest: {
      module: string;
      name: string;
      version: string;
      contract: string;
      workspaces?: Array<{ key: string; label?: string; menus: string[] }>;
      sheets?: Array<{
        spreadsheet: string;
        sheets: Array<{ name: string; headers: string[]; editableColumns?: string[] }>;
      }>;
    },
  ) {
    if (!manifest.module || manifest.contract !== 'core-v1') {
      throw new BadRequestException('Invalid Plugin Manifest: contract must be "core-v1".');
    }

    const plugin = await this.prisma.tenantPlugin.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: manifest.module } },
      update: {
        name: manifest.name || manifest.module.toUpperCase(),
        version: manifest.version || '1.0.0',
        manifestJson: manifest as object,
        status: 'ENABLED',
      },
      create: {
        tenantId,
        moduleKey: manifest.module,
        name: manifest.name || manifest.module.toUpperCase(),
        version: manifest.version || '1.0.0',
        manifestJson: manifest as object,
        status: 'ENABLED',
      },
    });

    // Register plugin workspaces for this Organization
    for (const ws of manifest.workspaces || []) {
      await this.prisma.workspace.upsert({
        where: { tenantId_key: { tenantId, key: ws.key } },
        update: { name: ws.label || ws.key, menusJson: ws.menus, isActive: true },
        create: {
          tenantId,
          key: ws.key,
          name: ws.label || ws.key,
          moduleKey: manifest.module,
          menusJson: ws.menus,
        },
      });
    }

    // Auto-create plugin Google Spreadsheets inside the Organization's Drive Folder
    const provisionedSheets: unknown[] = [];
    for (const sp of manifest.sheets || []) {
      try {
        const res = await this.sheetsService.provisionPluginSpreadsheet(
          tenantId,
          manifest.module,
          sp.spreadsheet,
          sp.sheets,
        );
        provisionedSheets.push(res);
      } catch {
        // Drive may not be connected yet; plugin still registers cleanly
      }
    }

    return { plugin, provisionedSheets };
  }

  /**
   * Issues a Tenant-Scoped Module Token (shown ONCE to admin) so the future module
   * (CRM / Academic / Finance / HRMS) can authenticate against this Organization!
   */
  async issueModuleToken(
    tenantId: string,
    createdByEmp: string,
    dto: { moduleKey: string; label: string; scopes: string[]; expiryDays?: number },
  ) {
    const { raw, hash, prefix } = this.crypto.generateScopedToken('cos_mod_');
    const expiresAt = new Date(Date.now() + (dto.expiryDays || 90) * 24 * 60 * 60 * 1000);

    const record = await this.prisma.moduleToken.create({
      data: {
        tenantId,
        moduleKey: dto.moduleKey,
        label: dto.label,
        tokenPrefix: prefix,
        tokenHash: hash,
        scopes: dto.scopes || ['core.employees.read', 'core.students.create', 'core.events.publish'],
        createdByEmp,
        expiresAt,
      },
    });

    return {
      id: record.id,
      moduleKey: record.moduleKey,
      label: record.label,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
      // Returned ONCE — store securely in the plugin's .env or tenant connection config
      rawToken: raw,
    };
  }

  async revokeToken(tenantId: string, tokenId: string) {
    return this.prisma.moduleToken.updateMany({
      where: { id: tokenId, tenantId },
      data: { revokedAt: new Date() },
    });
  }

  async publishPluginEvent(
    tenantId: string,
    actorEmpCode: string,
    sourceModule: string,
    body: { event_name: string; payload: Record<string, unknown>; correlation_id?: string },
  ) {
    const outbox = await this.eventBus.publish({
      tenantId,
      eventName: body.event_name,
      actorEmployeeId: actorEmpCode,
      sourceModule,
      payload: body.payload,
      correlationId: body.correlation_id,
    });
    return { accepted: true, eventId: outbox.id };
  }
}
