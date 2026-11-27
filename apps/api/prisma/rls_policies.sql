-- ============================================================================
-- Company OS Core — PostgreSQL Row-Level Security (RLS) Multi-Tenant Isolation
-- Run after initial Prisma migration: psql $DATABASE_URL -f prisma/rls_policies.sql
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
  tenant_tables TEXT[] := ARRAY[
    'Session', 'Department', 'Employee', 'PermissionCluster', 'Role',
    'UserRole', 'Delegation', 'Workspace', 'UserWorkspace',
    'ProductCategory', 'Product', 'Student', 'Form', 'FormSubmission',
    'DataType', 'DataRecord', 'Kra', 'Kpi', 'Task',
    'BodSnapshot', 'EodSubmission', 'DailyScore', 'ApprovalPolicy',
    'ApprovalRequest', 'Notice', 'TenantPlugin', 'ModuleToken',
    'EventOutbox', 'EventInbox', 'AuditLog', 'SheetConnection',
    'SheetMapping', 'SyncError'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
      EXECUTE format(
        'CREATE POLICY tenant_isolation_policy ON %I USING ("tenantId"::text = current_setting(''app.current_tenant_id'', true)) WITH CHECK ("tenantId"::text = current_setting(''app.current_tenant_id'', true));',
        tbl
      );
    END IF;
  END LOOP;
END $$;
