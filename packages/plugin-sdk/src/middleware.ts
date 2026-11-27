/**
 * Generic request context extractor for future plugin backends.
 * Ensures every incoming request carries a verified tenant_id and actor_employee_id.
 */
export interface PluginRequestContext {
  tenantId: string;
  actorEmployeeId: string;
  correlationId: string;
}

export function extractOrgContext(headers: Record<string, string | string[] | undefined>): PluginRequestContext {
  const tenantId = String(headers['x-tenant-id'] || '').trim();
  const actorEmployeeId = String(headers['x-actor-employee-id'] || '').trim();
  const correlationId = String(headers['x-correlation-id'] || `cor-${Date.now()}`).trim();

  if (!tenantId) {
    throw new Error('Missing X-Tenant-Id header: Every plugin request must be scoped to an Organization.');
  }
  if (!actorEmployeeId) {
    throw new Error('Missing X-Actor-Employee-Id header: Every write requires a valid active Employee ID.');
  }

  return { tenantId, actorEmployeeId, correlationId };
}
