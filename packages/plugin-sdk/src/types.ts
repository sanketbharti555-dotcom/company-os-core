export interface PluginWorkspaceDef {
  key: string;
  label: string;
  menus: string[];
}

export interface PluginSheetDef {
  spreadsheet: string;
  sheets: {
    name: string;
    headers: string[];
    editableColumns?: string[];
  }[];
}

export interface PluginManifest {
  module: string;
  name: string;
  version: string;
  contract: 'core-v1';
  provides_entities: string[];
  needs_apis: string[];
  events_publish: string[];
  events_subscribe: string[];
  permissions: string[];
  workspaces: PluginWorkspaceDef[];
  kpi_sources?: string[];
  task_sources?: string[];
  sheets?: PluginSheetDef[];
}

export interface EventEnvelope<T = Record<string, unknown>> {
  event_id: string;
  event_name: string;
  version: number;
  tenant_id: string;
  occurred_at: string;
  actor_employee_id: string;
  source_module: string;
  correlation_id: string;
  payload: T;
}

export interface PluginClientConfig {
  coreApiBaseUrl: string;   // e.g. https://api.companyos.com/api/v1
  tenantId: string;         // Organization UUID (or code)
  moduleToken: string;      // Scoped Module Token issued by Organization Admin
  moduleKey: string;        // e.g. "crm", "academic", "finance"
}
