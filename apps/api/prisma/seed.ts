import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORE_PERMISSIONS = [
  { key: 'core.tenant.manage', resource: 'tenant', action: 'manage', description: 'Manage organization profile, branding & settings' },
  { key: 'core.employees.read', resource: 'employees', action: 'read', description: 'View employee directory' },
  { key: 'core.employees.manage', resource: 'employees', action: 'manage', description: 'Create, edit, import & deactivate employees' },
  { key: 'core.departments.manage', resource: 'departments', action: 'manage', description: 'Create & manage departments and heads' },
  { key: 'core.rbac.manage', resource: 'rbac', action: 'manage', description: 'Manage roles, clusters, workspaces & delegations' },
  { key: 'core.students.read', resource: 'students', action: 'read', description: 'View Core Student Registry' },
  { key: 'core.students.create', resource: 'students', action: 'create', description: 'Register new student and issue STU-ID' },
  { key: 'core.products.read', resource: 'products', action: 'read', description: 'View products, programs & fee plans' },
  { key: 'core.products.manage', resource: 'products', action: 'manage', description: 'Manage products, categories & fee plans' },
  { key: 'core.sessions.manage', resource: 'sessions', action: 'manage', description: 'Start, clone & archive sessions' },
  { key: 'core.builders.manage', resource: 'builders', action: 'manage', description: 'Build no-code forms and custom data types' },
  { key: 'core.tasks.manage', resource: 'tasks', action: 'manage', description: 'Create tasks, KRAs, KPIs & score EODs' },
  { key: 'core.sheets.manage', resource: 'sheets', action: 'manage', description: 'Connect Google Drive & configure two-way Sheets sync' },
  { key: 'core.plugins.manage', resource: 'plugins', action: 'manage', description: 'Register plugins & issue scoped module tokens' },
  { key: 'core.audit.read', resource: 'audit', action: 'read', description: 'Search immutable audit logs' },
];

const GLOBAL_MODULES = [
  {
    moduleKey: 'crm',
    name: 'CRM & Admissions Engine',
    description: 'Leads, per-product pipelines, sales vs feedback calls, follow-ups, duplicate guard, and admission handoff.',
    version: '1.0.0',
    releaseStage: 'PUBLIC',
    requiredPlan: 'GROWTH',
    addonPricePaise: BigInt(149900),
    manifestJson: {
      module: 'crm',
      name: 'CRM & Admissions Engine',
      version: '1.0.0',
      contract: 'core-v1',
      workspaces: [
        { key: 'crm_admin', label: 'CRM Admin', menus: ['dashboard', 'leads', 'payments', 'config'] },
        { key: 'crm_exec', label: 'CRM Executive', menus: ['dashboard', 'leads', 'calls', 'reports'] },
      ],
      sheets: [
        {
          spreadsheet: 'CRM Data',
          sheets: [
            { name: 'Leads', headers: ['lead_id', 'person_name', 'phone', 'product_code', 'stage', 'owner_emp_id', 'notes', 'updated_at'], editableColumns: ['notes'] },
            { name: 'Followups', headers: ['followup_id', 'lead_id', 'due_at', 'status', 'assigned_to', 'notes'], editableColumns: ['status', 'notes'] },
            { name: 'Payments', headers: ['payment_id', 'student_id', 'product_code', 'amount_inr', 'mode', 'received_by', 'date'], editableColumns: [] },
          ],
        },
      ],
    },
  },
  {
    moduleKey: 'academic',
    name: 'Academic Management',
    description: 'Batches, conflict-free schedule builder, syllabus tracker, percentage-only exams, leaderboard, and Teacher App.',
    version: '1.0.0',
    releaseStage: 'BETA',
    requiredPlan: 'GROWTH',
    addonPricePaise: BigInt(199900),
    manifestJson: {
      module: 'academic',
      name: 'Academic Management',
      version: '1.0.0',
      contract: 'core-v1',
      workspaces: [
        { key: 'academic_head', label: 'Academic Head Portal', menus: ['dashboard', 'batches', 'schedules', 'syllabus', 'exams'] },
        { key: 'teacher_app', label: 'Teacher App', menus: ['today', 'syllabus', 'attendance', 'homework'] },
      ],
      sheets: [
        {
          spreadsheet: 'Academic Data',
          sheets: [
            { name: 'Batches', headers: ['batch_code', 'program', 'mode', 'capacity', 'status'], editableColumns: [] },
            { name: 'Syllabus', headers: ['syllabus_id', 'batch_code', 'subject', 'chapter', 'target_date', 'status'], editableColumns: ['status'] },
            { name: 'Attendance', headers: ['date', 'batch_code', 'student_id', 'status', 'marked_by'], editableColumns: [] },
          ],
        },
      ],
    },
  },
  {
    moduleKey: 'finance',
    name: 'Finance & Accounting Ledger',
    description: 'Double-entry Cash In/Out ledger, Fund vs Revenue separation, Burn/Runway/ROI, Salary run, and CA export.',
    version: '1.0.0',
    releaseStage: 'INTERNAL_TESTING',
    requiredPlan: 'ENTERPRISE',
    addonPricePaise: BigInt(249900),
    manifestJson: {
      module: 'finance',
      name: 'Finance & Accounting Ledger',
      version: '1.0.0',
      contract: 'core-v1',
      workspaces: [{ key: 'finance_portal', label: 'Finance Portal', menus: ['cashbook', 'approvals', 'salary', 'reports'] }],
      sheets: [
        {
          spreadsheet: 'Finance Data',
          sheets: [
            { name: 'Cash Book', headers: ['voucher_no', 'date', 'type', 'category', 'amount_inr', 'mode', 'employee_id'], editableColumns: [] },
            { name: 'Receivables', headers: ['student_id', 'product_code', 'due_date', 'amount_inr', 'paid_inr', 'status'], editableColumns: [] },
          ],
        },
      ],
    },
  },
  {
    moduleKey: 'hrms',
    name: 'HRMS & Payroll Inputs',
    description: 'Employee onboarding, biometric attendance sync, leave quotas, profile change approvals, and exit handover.',
    version: '1.0.0',
    releaseStage: 'INTERNAL_TESTING',
    requiredPlan: 'ENTERPRISE',
    addonPricePaise: BigInt(99900),
    manifestJson: {
      module: 'hrms',
      name: 'HRMS & Payroll Inputs',
      version: '1.0.0',
      contract: 'core-v1',
      workspaces: [{ key: 'hrms_portal', label: 'HRMS Portal', menus: ['attendance', 'leaves', 'onboarding', 'exits'] }],
      sheets: [
        {
          spreadsheet: 'HR Data',
          sheets: [
            { name: 'Employee Attendance', headers: ['employee_id', 'date', 'in_time', 'out_time', 'status'], editableColumns: [] },
            { name: 'Leaves', headers: ['leave_id', 'employee_id', 'from_date', 'to_date', 'type', 'status'], editableColumns: [] },
          ],
        },
      ],
    },
  },
  {
    moduleKey: 'inventory',
    name: 'Inventory & Asset Register',
    description: 'Books, uniforms, stationery stock in/out, student/employee issue register, and durable asset tracking.',
    version: '1.0.0',
    releaseStage: 'INTERNAL_TESTING',
    requiredPlan: 'GROWTH',
    addonPricePaise: BigInt(79900),
    manifestJson: {
      module: 'inventory',
      name: 'Inventory & Asset Register',
      version: '1.0.0',
      contract: 'core-v1',
      workspaces: [{ key: 'inventory_portal', label: 'Inventory', menus: ['items', 'stock', 'issues', 'assets'] }],
      sheets: [
        {
          spreadsheet: 'Inventory Data',
          sheets: [
            { name: 'Items', headers: ['item_code', 'name', 'category', 'qty', 'reorder_level'], editableColumns: [] },
          ],
        },
      ],
    },
  },
  {
    moduleKey: 'growth',
    name: 'Growth & Social Media Workspace',
    description: 'Content calendar, UTM campaign register, ad ROI tracking, and video editor delivery KPIs.',
    version: '1.0.0',
    releaseStage: 'BETA',
    requiredPlan: 'GROWTH',
    addonPricePaise: BigInt(79900),
    manifestJson: {
      module: 'growth',
      name: 'Growth & Social Media Workspace',
      version: '1.0.0',
      contract: 'core-v1',
      workspaces: [{ key: 'growth_workspace', label: 'Growth & Social', menus: ['calendar', 'campaigns', 'roi'] }],
      sheets: [],
    },
  },
];

async function main() {
  for (const perm of CORE_PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: perm.key }, update: perm, create: perm });
  }
  for (const mod of GLOBAL_MODULES) {
    await prisma.globalModuleCatalog.upsert({
      where: { moduleKey: mod.moduleKey },
      update: {
        name: mod.name,
        description: mod.description,
        version: mod.version,
        manifestJson: mod.manifestJson as object,
      },
      create: mod as never,
    });
  }
  console.log(`Seeded ${CORE_PERMISSIONS.length} permissions and ${GLOBAL_MODULES.length} Global SaaS Modules.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
