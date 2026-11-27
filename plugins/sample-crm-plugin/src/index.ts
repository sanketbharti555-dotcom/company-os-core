import { CompanyOsPluginClient } from '@company-os/plugin-sdk';

/**
 * EXAMPLE: How a future plugin (CRM, Academic, Finance, HRMS) connects to an Organization.
 *
 * Step 1: Register `manifest.json` in Core -> Plugins & Docking Station.
 * Step 2: Organization Super Admin enables the plugin & generates a Scoped Module Token.
 * Step 3: Initialize CompanyOsPluginClient with the Org's `tenantId` + `moduleToken`.
 *         Every API call, Event, and Google Sheet mirror automatically routes to that Organization!
 */
async function runAdmissionFlowExample() {
  const client = new CompanyOsPluginClient({
    coreApiBaseUrl: process.env.CORE_API_URL || 'http://localhost:4000/api/v1',
    tenantId: process.env.ORG_TENANT_ID || 'REPLACE_WITH_ORG_TENANT_ID',
    moduleToken: process.env.CRM_MODULE_TOKEN || 'REPLACE_WITH_SCOPED_MODULE_TOKEN',
    moduleKey: 'crm',
  });

  const actorEmployeeId = 'EMP-0001';

  // 1. Synchronously create Student in Core Student Registry (returns STU-2026-000001)
  const student = await client.createStudent(actorEmployeeId, {
    fullName: 'Aarav Sharma',
    phone: '+919876543210',
    email: 'parent.sharma@example.com',
    guardianName: 'Rajesh Sharma',
    guardianPhone: '+919876543210',
  });
  console.log('Student registered in Core:', student.code);

  // 2. Publish canonical event to Organization's Event Bus
  //    (Academic, Finance, KPI Engine, Daily Hub, and Sheets Sync react automatically!)
  await client.publishEvent(actorEmployeeId, 'admission.completed', {
    lead_id: 'LD-2026-000001',
    student_id: student.code,
    product_id: 'PRD-0001',
    fee_plan: { total_paise: 5000000 },
  });

  // 3. Mirror CRM Lead row into the Organization's Google Drive -> "CRM Data <Session>" -> "Leads" tab
  await client.syncSheetRows(actorEmployeeId, 'CRM Data', 'Leads', [
    {
      lead_id: 'LD-2026-000001',
      person_name: 'Aarav Sharma',
      phone: '+919876543210',
      product_code: 'PRD-0001',
      stage: 'Final Conversion',
      owner_emp_id: actorEmployeeId,
      notes: 'Admission completed via CRM Plugin',
      updated_at: new Date().toISOString(),
    },
  ]);

  console.log('Admission event published and mirrored to Organization Google Sheet!');
}

if (require.main === module) {
  runAdmissionFlowExample().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
