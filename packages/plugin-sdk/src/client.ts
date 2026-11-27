import crypto from 'crypto';
import { EventEnvelope, PluginClientConfig } from './types';

/**
 * CompanyOsPluginClient
 * Used by future modules (CRM, Academic, Finance, HRMS, Inventory, Growth, LMS)
 * to securely connect to a specific Organization (tenant_id) in Company OS Core.
 *
 * Enforces:
 * - Scoped Module Token (Authorization: Bearer <moduleToken>)
 * - Organization Isolation (X-Tenant-Id: <tenantId>)
 * - Responsible Actor (X-Actor-Employee-Id: <EMP-XXXX>)
 * - Write Idempotency (Idempotency-Key)
 */
export class CompanyOsPluginClient {
  constructor(private readonly config: PluginClientConfig) {}

  private buildHeaders(actorEmployeeId: string, idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.moduleToken}`,
      'X-Tenant-Id': this.config.tenantId,
      'X-Actor-Employee-Id': actorEmployeeId,
      'X-Source-Module': this.config.moduleKey,
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return headers;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    actorEmployeeId: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const url = `${this.config.coreApiBaseUrl.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.buildHeaders(actorEmployeeId, idempotencyKey),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`CompanyOS Core API Error (${res.status}): ${errText}`);
    }
    return res.json() as Promise<T>;
  }

  /** Synchronously create a Student in Core Student Registry and receive STU-YYYY-XXXXXX */
  async createStudent(
    actorEmployeeId: string,
    data: {
      fullName: string;
      phone: string;
      email?: string;
      productId?: string;
      leadId?: string;
      guardianName?: string;
      guardianPhone?: string;
    },
    idempotencyKey?: string,
  ) {
    return this.request<{ id: string; code: string; fullName: string }>(
      'POST',
      '/core/students',
      actorEmployeeId,
      data,
      idempotencyKey || `stu-${crypto.randomUUID()}`,
    );
  }

  /** Fetch active employees of this Organization (optionally filtered by roleTag) */
  async listEmployees(actorEmployeeId: string, roleTag?: string) {
    const qs = roleTag ? `?roleTag=${encodeURIComponent(roleTag)}` : '';
    return this.request<Array<{ id: string; code: string; fullName: string; email: string; roleTags: string[] }>>(
      'GET',
      `/core/employees${qs}`,
      actorEmployeeId,
    );
  }

  /** Publish a canonical domain event into the Organization's Core Event Bus */
  async publishEvent<T extends Record<string, unknown>>(
    actorEmployeeId: string,
    eventName: string,
    payload: T,
    correlationId?: string,
  ) {
    const envelope: EventEnvelope<T> = {
      event_id: crypto.randomUUID(),
      event_name: eventName,
      version: 1,
      tenant_id: this.config.tenantId,
      occurred_at: new Date().toISOString(),
      actor_employee_id: actorEmployeeId,
      source_module: this.config.moduleKey,
      correlation_id: correlationId || `cor-${crypto.randomUUID().slice(0, 8)}`,
      payload,
    };
    return this.request<{ accepted: boolean; eventId: string }>(
      'POST',
      '/core/plugins/events/publish',
      actorEmployeeId,
      envelope,
      envelope.event_id,
    );
  }

  /** Sync plugin table rows directly into the Organization's Google Drive Spreadsheet */
  async syncSheetRows(
    actorEmployeeId: string,
    spreadsheetName: string,
    tabName: string,
    rows: Array<Record<string, unknown>>,
  ) {
    return this.request<{ queued: boolean }>(
      'POST',
      '/core/sheets/plugin-sync',
      actorEmployeeId,
      { spreadsheetName, tabName, rows },
    );
  }
}
