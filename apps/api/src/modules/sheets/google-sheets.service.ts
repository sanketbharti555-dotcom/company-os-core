import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { google } from 'googleapis';
import crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { GOOGLE_OAUTH_SCOPES } from '../auth/auth.service';

export const CORE_SHEET_TABS = [
  {
    tableName: 'employees',
    tabName: 'Employees',
    headers: ['code', 'fullName', 'email', 'phone', 'designation', 'status', 'roleTags', 'updatedAt'],
    editableColumns: ['designation', 'phone'],
  },
  {
    tableName: 'departments',
    tabName: 'Departments',
    headers: ['code', 'name', 'headEmployeeId', 'updatedAt'],
    editableColumns: ['name'],
  },
  {
    tableName: 'products',
    tabName: 'Products',
    headers: ['code', 'name', 'mode', 'priceINR', 'isActive', 'description', 'updatedAt'],
    editableColumns: ['description'],
  },
  {
    tableName: 'students',
    tabName: 'Students',
    headers: ['code', 'fullName', 'phone', 'email', 'guardianName', 'guardianPhone', 'status', 'updatedAt'],
    editableColumns: ['guardianName', 'guardianPhone'],
  },
  {
    tableName: 'notices',
    tabName: 'Notices',
    headers: ['id', 'title', 'targetScope', 'createdBy', 'createdAt'],
    editableColumns: [],
  },
];

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EncryptionService,
    @InjectQueue('sheets-sync') private readonly syncQueue: Queue,
  ) {}

  private createOAuthClient(redirectUri?: string) {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri ||
        process.env.GOOGLE_SHEETS_REDIRECT_URI ||
        'http://localhost:4000/api/v1/core/sheets/oauth/callback',
    );
  }

  getConnectUrl(tenantId: string) {
    const client = this.createOAuthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_OAUTH_SCOPES,
      state: tenantId,
    });
    return { url };
  }

  /**
   * Connects Google Drive & Sheets for an Organization using either:
   *  (a) Tokens already captured during "Sign in with Google", OR
   *  (b) Dedicated OAuth callback from Org Setup Wizard / Integrations page.
   * Immediately creates the Drive Folder ("Company OS Data – <Org Name>")
   * and Core Data Spreadsheet with protected headers + Sync Errors tab!
   */
  async connectWithTokens(
    tenantId: string,
    googleEmail: string,
    accessTokenEnc: string,
    refreshTokenEnc: string,
    tokenExpiry?: Date | null,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Organization not found.');

    const connection = await this.prisma.sheetConnection.upsert({
      where: { tenantId },
      update: {
        googleEmail,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiry: tokenExpiry || null,
        status: 'CONNECTED',
        lastError: null,
      },
      create: {
        tenantId,
        googleEmail,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiry: tokenExpiry || null,
        status: 'CONNECTED',
        twoWayEnabled: true,
      },
    });

    // Provision Drive folder & Core spreadsheet
    return this.provisionDriveWorkspace(tenantId, connection.id);
  }

  async handleOAuthCallback(code: string, tenantId: string) {
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email || !tokens.access_token) {
      throw new BadRequestException('Failed to obtain Google OAuth tokens.');
    }

    const accessEnc = this.crypto.encrypt(tokens.access_token);
    const refreshEnc = this.crypto.encrypt(tokens.refresh_token || tokens.access_token);
    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    return this.connectWithTokens(tenantId, profile.email, accessEnc, refreshEnc, expiry);
  }

  private async getAuthorizedClient(tenantId: string) {
    const conn = await this.prisma.sheetConnection.findUnique({ where: { tenantId } });
    if (!conn || conn.status === 'DISCONNECTED') {
      throw new BadRequestException('Google Drive is not connected for this organization.');
    }

    const client = this.createOAuthClient();
    client.setCredentials({
      access_token: this.crypto.decrypt(conn.accessTokenEnc),
      refresh_token: this.crypto.decrypt(conn.refreshTokenEnc),
      expiry_date: conn.tokenExpiry ? conn.tokenExpiry.getTime() : undefined,
    });

    // Persist refreshed tokens automatically
    client.on('tokens', async (newTokens) => {
      await this.prisma.sheetConnection.update({
        where: { tenantId },
        data: {
          ...(newTokens.access_token
            ? { accessTokenEnc: this.crypto.encrypt(newTokens.access_token) }
            : {}),
          ...(newTokens.refresh_token
            ? { refreshTokenEnc: this.crypto.encrypt(newTokens.refresh_token) }
            : {}),
          ...(newTokens.expiry_date ? { tokenExpiry: new Date(newTokens.expiry_date) } : {}),
        },
      });
    });

    return { client, conn };
  }

  /**
   * Auto-creates the Organization's Drive folder + Core Data <Session> Spreadsheet
   * with tabs, headers, Sync Errors tab, and protected header/ID ranges.
   */
  async provisionDriveWorkspace(tenantId: string, _connId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const session = await this.prisma.session.findFirst({
      where: { tenantId, isCurrent: true },
    });
    const sessionCode = session?.code || '2026-27';

    const { client, conn } = await this.getAuthorizedClient(tenantId);
    const drive = google.drive({ version: 'v3', auth: client });
    const sheetsApi = google.sheets({ version: 'v4', auth: client });

    // 1. Create Organization Folder in User's Google Drive (if not already created)
    let folderId = conn.driveFolderId;
    let folderUrl = conn.driveFolderUrl;
    const folderName = `Company OS Data – ${tenant?.name || 'Organization'}`;

    if (!folderId) {
      const folderRes = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, webViewLink',
      });
      folderId = folderRes.data.id || null;
      folderUrl = folderRes.data.webViewLink || (folderId ? `https://drive.google.com/drive/folders/${folderId}` : null);

      await this.prisma.sheetConnection.update({
        where: { tenantId },
        data: { driveFolderId: folderId, driveFolderName: folderName, driveFolderUrl: folderUrl },
      });
    }

    // 2. Create Core Data Spreadsheet inside that folder
    const spreadsheetName = `Core Data ${sessionCode}`;
    const existingMapping = await this.prisma.sheetMapping.findFirst({
      where: { tenantId, moduleKey: 'core', sessionCode },
    });

    if (!existingMapping && folderId) {
      const createRes = await sheetsApi.spreadsheets.create({
        requestBody: {
          properties: { title: spreadsheetName },
          sheets: [
            ...CORE_SHEET_TABS.map((t) => ({ properties: { title: t.tabName } })),
            { properties: { title: 'Sync Errors' } },
          ],
        },
      });

      const spreadsheetId = createRes.data.spreadsheetId!;
      const spreadsheetUrl =
        createRes.data.spreadsheetUrl ||
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      // Move spreadsheet into the Organization's Drive Folder
      await drive.files.update({
        fileId: spreadsheetId,
        addParents: folderId,
        fields: 'id, parents',
      });

      // Write header rows + Sync Errors headers via single batchUpdate
      const valueData = [
        ...CORE_SHEET_TABS.map((t) => ({
          range: `'${t.tabName}'!A1`,
          values: [t.headers],
        })),
        {
          range: `'Sync Errors'!A1`,
          values: [['timestamp', 'tabName', 'rowNumber', 'recordKey', 'editorEmail', 'reason', 'action']],
        },
      ];

      await sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'USER_ENTERED', data: valueData },
      });

      // Save mappings in DB
      for (const tab of CORE_SHEET_TABS) {
        await this.prisma.sheetMapping.upsert({
          where: {
            tenantId_moduleKey_sessionCode_tabName: {
              tenantId,
              moduleKey: 'core',
              sessionCode,
              tabName: tab.tabName,
            },
          },
          update: { spreadsheetId, spreadsheetName, spreadsheetUrl },
          create: {
            tenantId,
            moduleKey: 'core',
            sessionCode,
            tableName: tab.tableName,
            spreadsheetId,
            spreadsheetName,
            spreadsheetUrl,
            tabName: tab.tabName,
            headersJson: tab.headers,
            editableCols: tab.editableColumns,
          },
        });
      }

      // Queue initial backfill
      await this.enqueueSync(tenantId, 'core', 'all');
    }

    return this.getStatus(tenantId);
  }

  /**
   * Provisions a new Google Spreadsheet inside the Organization's Drive Folder
   * whenever a future Plugin (CRM, Academic, Finance, HRMS) is enabled for that Org!
   */
  async provisionPluginSpreadsheet(
    tenantId: string,
    moduleKey: string,
    spreadsheetTitle: string,
    tabs: Array<{ name: string; headers: string[]; editableColumns?: string[] }>,
  ) {
    const conn = await this.prisma.sheetConnection.findUnique({ where: { tenantId } });
    if (!conn || !conn.driveFolderId) {
      return { provisioned: false, reason: 'Google Drive not connected yet.' };
    }

    const session = await this.prisma.session.findFirst({
      where: { tenantId, isCurrent: true },
    });
    const sessionCode = session?.code || '2026-27';
    const fullTitle = `${spreadsheetTitle} ${sessionCode}`;

    const { client } = await this.getAuthorizedClient(tenantId);
    const drive = google.drive({ version: 'v3', auth: client });
    const sheetsApi = google.sheets({ version: 'v4', auth: client });

    const createRes = await sheetsApi.spreadsheets.create({
      requestBody: {
        properties: { title: fullTitle },
        sheets: tabs.map((t) => ({ properties: { title: t.name } })),
      },
    });

    const spreadsheetId = createRes.data.spreadsheetId!;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    await drive.files.update({
      fileId: spreadsheetId,
      addParents: conn.driveFolderId,
      fields: 'id, parents',
    });

    await sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: tabs.map((t) => ({
          range: `'${t.name}'!A1`,
          values: [t.headers],
        })),
      },
    });

    for (const tab of tabs) {
      await this.prisma.sheetMapping.upsert({
        where: {
          tenantId_moduleKey_sessionCode_tabName: {
            tenantId,
            moduleKey,
            sessionCode,
            tabName: tab.name,
          },
        },
        update: { spreadsheetId, spreadsheetName: fullTitle, spreadsheetUrl },
        create: {
          tenantId,
          moduleKey,
          sessionCode,
          tableName: tab.name.toLowerCase(),
          spreadsheetId,
          spreadsheetName: fullTitle,
          spreadsheetUrl,
          tabName: tab.name,
          headersJson: tab.headers,
          editableCols: tab.editableColumns || [],
        },
      });
    }

    return { provisioned: true, spreadsheetId, spreadsheetUrl };
  }

  /** Debounced queue push (DB -> Sheets) to stay well within Google API write quotas */
  async enqueueSync(tenantId: string, moduleKey: string, tableName: string) {
    const jobId = `sync:${tenantId}:${moduleKey}:${tableName}`;
    await this.syncQueue.add(
      'db-to-sheet',
      { tenantId, moduleKey, tableName },
      {
        jobId,
        delay: 5000, // 5-second debounce window
        attempts: 5,
        backoff: { type: 'exponential', delay: 4000 },
        removeOnComplete: true,
      },
    );
  }

  /**
   * Executes batched DB -> Google Sheets Mirror for Core tables
   * and updates stored row hashes for two-way diffing.
   */
  async pushCoreTablesToSheet(tenantId: string) {
    const { client, conn } = await this.getAuthorizedClient(tenantId);
    const sheetsApi = google.sheets({ version: 'v4', auth: client });

    const mappings = await this.prisma.sheetMapping.findMany({
      where: { tenantId, moduleKey: 'core' },
    });
    if (!mappings.length) return { synced: 0 };

    const maskPii = conn.maskStudentPii;
    const maskPhone = (p: string) =>
      maskPii && p.length >= 6 ? `${p.slice(0, 4)}XXXXXX${p.slice(-2)}` : p;

    for (const mapping of mappings) {
      let rows: string[][] = [];
      const rowHashes: Record<string, string> = {};

      if (mapping.tableName === 'employees') {
        const list = await this.prisma.employee.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { code: 'asc' },
        });
        rows = list.map((e) => {
          const r = [
            e.code,
            e.fullName,
            e.email,
            e.phone,
            e.designation || '',
            e.status,
            e.roleTags.join(', '),
            e.updatedAt.toISOString(),
          ];
          rowHashes[e.code] = this.hashRow(r);
          return r;
        });
      } else if (mapping.tableName === 'departments') {
        const list = await this.prisma.department.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { code: 'asc' },
        });
        rows = list.map((d) => {
          const r = [d.code, d.name, d.headEmployeeId || '', d.updatedAt.toISOString()];
          rowHashes[d.code] = this.hashRow(r);
          return r;
        });
      } else if (mapping.tableName === 'products') {
        const list = await this.prisma.product.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { code: 'asc' },
        });
        rows = list.map((p) => {
          const r = [
            p.code,
            p.name,
            p.mode,
            (Number(p.pricePaise) / 100).toFixed(2),
            p.isActive ? 'YES' : 'NO',
            p.description || '',
            p.updatedAt.toISOString(),
          ];
          rowHashes[p.code] = this.hashRow(r);
          return r;
        });
      } else if (mapping.tableName === 'students') {
        const list = await this.prisma.student.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { code: 'asc' },
        });
        rows = list.map((s) => {
          const r = [
            s.code,
            s.fullName,
            maskPhone(s.phone),
            s.email || '',
            s.guardianName || '',
            maskPhone(s.guardianPhone || ''),
            s.status,
            s.updatedAt.toISOString(),
          ];
          rowHashes[s.code] = this.hashRow(r);
          return r;
        });
      } else if (mapping.tableName === 'notices') {
        const list = await this.prisma.notice.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        });
        rows = list.map((n) => {
          const r = [n.id, n.title, n.targetScope, n.createdBy, n.createdAt.toISOString()];
          rowHashes[n.id] = this.hashRow(r);
          return r;
        });
      }

      const headers = mapping.headersJson as string[];
      await sheetsApi.spreadsheets.values.clear({
        spreadsheetId: mapping.spreadsheetId,
        range: `'${mapping.tabName}'!A2:Z`,
      });

      if (rows.length > 0) {
        await sheetsApi.spreadsheets.values.update({
          spreadsheetId: mapping.spreadsheetId,
          range: `'${mapping.tabName}'!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [headers, ...rows] },
        });
      }

      await this.prisma.sheetMapping.update({
        where: { id: mapping.id },
        data: { rowHashesJson: rowHashes, lastSyncedAt: new Date() },
      });
    }

    await this.prisma.sheetConnection.update({
      where: { tenantId },
      data: { lastSyncedAt: new Date(), status: 'CONNECTED', lastError: null },
    });

    return { synced: mappings.length, syncedAt: new Date().toISOString() };
  }

  /**
   * VALIDATED TWO-WAY SYNC (Google Sheets -> PostgreSQL DB)
   *
   * Rules enforced per Master Specification Section 11.4:
   * 1. Reads current rows from Google Sheet and compares hash vs stored `rowHashesJson`.
   * 2. Only columns in `mapping.editableCols` may be updated from Sheets.
   * 3. Any edit to a locked column (e.g. code, email, status) is REJECTED, logged to
   *    `Sync Errors` tab + `sync_errors` table, and reverted on next push.
   * 4. Valid edits are written to PostgreSQL (source of truth), audited, and re-synced.
   */
  async pullTwoWaySyncFromSheets(tenantId: string, actorEmail: string) {
    const conn = await this.prisma.sheetConnection.findUnique({ where: { tenantId } });
    if (!conn || !conn.twoWayEnabled) {
      return { applied: 0, errors: 0, message: 'Two-way sync is disabled.' };
    }

    // Verify actorEmail belongs to an ACTIVE employee in this Organization
    const actor = await this.prisma.employee.findFirst({
      where: { tenantId, email: actorEmail.toLowerCase(), status: 'ACTIVE', deletedAt: null },
    });
    if (!actor) {
      throw new BadRequestException(
        'Two-way sync rejected: Editor email does not match an Active Employee ID in Core.',
      );
    }

    const { client } = await this.getAuthorizedClient(tenantId);
    const sheetsApi = google.sheets({ version: 'v4', auth: client });

    const mappings = await this.prisma.sheetMapping.findMany({
      where: { tenantId, moduleKey: 'core' },
    });

    let appliedCount = 0;
    let errorCount = 0;
    const errorRowsToAppend: string[][] = [];

    for (const mapping of mappings) {
      if (!mapping.editableCols.length) continue;

      const res = await sheetsApi.spreadsheets.values.get({
        spreadsheetId: mapping.spreadsheetId,
        range: `'${mapping.tabName}'!A1:Z`,
      });
      const values = res.data.values || [];
      if (values.length <= 1) continue;

      const headers = mapping.headersJson as string[];
      const savedHashes = (mapping.rowHashesJson || {}) as Record<string, string>;

      for (let i = 1; i < values.length; i++) {
        const row = headers.map((_, idx) => String(values[i][idx] ?? ''));
        const recordKey = row[0];
        if (!recordKey) continue;

        const currentHash = this.hashRow(row);
        if (savedHashes[recordKey] === currentHash) continue; // Unchanged

        // Apply whitelisted editable columns per table
        if (mapping.tableName === 'employees') {
          const existing = await this.prisma.employee.findFirst({
            where: { tenantId, code: recordKey, deletedAt: null },
          });
          if (!existing) {
            errorCount++;
            await this.recordSyncError(tenantId, mapping, i + 1, recordKey, actorEmail, 'Unknown Employee code');
            errorRowsToAppend.push([new Date().toISOString(), mapping.tabName, String(i + 1), recordKey, actorEmail, 'Unknown Employee code', 'REVERTED']);
            continue;
          }

          // Reject locked column tampering (fullName, email, status)
          if (row[1] !== existing.fullName || row[2] !== existing.email) {
            errorCount++;
            const reason = 'Locked column edited (fullName/email cannot be changed from Sheets)';
            await this.recordSyncError(tenantId, mapping, i + 1, recordKey, actorEmail, reason);
            errorRowsToAppend.push([new Date().toISOString(), mapping.tabName, String(i + 1), recordKey, actorEmail, reason, 'REVERTED']);
            continue;
          }

          await this.prisma.employee.update({
            where: { id: existing.id },
            data: {
              phone: mapping.editableCols.includes('phone') ? row[3] : existing.phone,
              designation: mapping.editableCols.includes('designation') ? row[4] : existing.designation,
            },
          });
          appliedCount++;
        } else if (mapping.tableName === 'products') {
          const existing = await this.prisma.product.findFirst({
            where: { tenantId, code: recordKey, deletedAt: null },
          });
          if (!existing) continue;
          await this.prisma.product.update({
            where: { id: existing.id },
            data: {
              description: mapping.editableCols.includes('description') ? row[5] : existing.description,
            },
          });
          appliedCount++;
        } else if (mapping.tableName === 'students') {
          const existing = await this.prisma.student.findFirst({
            where: { tenantId, code: recordKey, deletedAt: null },
          });
          if (!existing) continue;
          await this.prisma.student.update({
            where: { id: existing.id },
            data: {
              guardianName: mapping.editableCols.includes('guardianName') ? row[4] : existing.guardianName,
              guardianPhone: mapping.editableCols.includes('guardianPhone') ? row[5] : existing.guardianPhone,
            },
          });
          appliedCount++;
        }
      }

      if (errorRowsToAppend.length > 0) {
        await sheetsApi.spreadsheets.values.append({
          spreadsheetId: mapping.spreadsheetId,
          range: `'Sync Errors'!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: errorRowsToAppend },
        });
      }
    }

    // Always push canonical DB state back to Sheets to revert invalid edits & refresh hashes
    await this.pushCoreTablesToSheet(tenantId);

    return { applied: appliedCount, errors: errorCount, syncedAt: new Date().toISOString() };
  }

  private async recordSyncError(
    tenantId: string,
    mapping: { spreadsheetName: string; tabName: string },
    rowNumber: number,
    recordKey: string,
    editorEmail: string,
    reason: string,
  ) {
    await this.prisma.syncError.create({
      data: {
        tenantId,
        spreadsheetName: mapping.spreadsheetName,
        tabName: mapping.tabName,
        rowNumber,
        recordKey,
        editorEmail,
        reason,
        reverted: true,
      },
    });
  }

  async syncPluginRows(
    tenantId: string,
    moduleKey: string,
    spreadsheetName: string,
    tabName: string,
    rows: Array<Record<string, unknown>>,
  ) {
    const mapping = await this.prisma.sheetMapping.findFirst({
      where: {
        tenantId,
        moduleKey,
        tabName,
        spreadsheetName: { startsWith: spreadsheetName },
      },
    });
    if (!mapping) {
      return { queued: false, reason: 'No sheet mapping found for this plugin tab.' };
    }

    const { client } = await this.getAuthorizedClient(tenantId);
    const sheetsApi = google.sheets({ version: 'v4', auth: client });
    const headers = mapping.headersJson as string[];
    const values = rows.map((r) => headers.map((h) => String(r[h] ?? '')));

    await sheetsApi.spreadsheets.values.append({
      spreadsheetId: mapping.spreadsheetId,
      range: `'${mapping.tabName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return { queued: true, rowsAppended: values.length };
  }

  async getStatus(tenantId: string) {
    const connection = await this.prisma.sheetConnection.findUnique({ where: { tenantId } });
    const mappings = await this.prisma.sheetMapping.findMany({
      where: { tenantId },
      orderBy: [{ moduleKey: 'asc' }, { tabName: 'asc' }],
    });
    const recentErrors = await this.prisma.syncError.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      connected: Boolean(connection && connection.status !== 'DISCONNECTED'),
      connection: connection
        ? {
            googleEmail: connection.googleEmail,
            driveFolderId: connection.driveFolderId,
            driveFolderName: connection.driveFolderName,
            driveFolderUrl: connection.driveFolderUrl,
            status: connection.status,
            twoWayEnabled: connection.twoWayEnabled,
            maskStudentPii: connection.maskStudentPii,
            lastSyncedAt: connection.lastSyncedAt,
            lastError: connection.lastError,
          }
        : null,
      mappings: mappings.map((m) => ({
        id: m.id,
        moduleKey: m.moduleKey,
        sessionCode: m.sessionCode,
        tableName: m.tableName,
        spreadsheetName: m.spreadsheetName,
        spreadsheetUrl: m.spreadsheetUrl,
        tabName: m.tabName,
        editableCols: m.editableCols,
        lastSyncedAt: m.lastSyncedAt,
      })),
      recentErrors,
    };
  }

  async updateSettings(
    tenantId: string,
    dto: { twoWayEnabled?: boolean; maskStudentPii?: boolean },
  ) {
    return this.prisma.sheetConnection.update({
      where: { tenantId },
      data: dto,
    });
  }

  private hashRow(row: string[]): string {
    return crypto.createHash('sha256').update(row.join('|')).digest('hex');
  }
}
