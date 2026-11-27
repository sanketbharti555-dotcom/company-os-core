# Company OS — Core Platform (Full-Stack Multi-Tenant SaaS)

**Company OS** is a **Microkernel ("Controlled Lego / ISS") Multi-Tenant SaaS Platform** built with **NestJS + PostgreSQL 16 (Prisma + RLS) + Redis (BullMQ) + Next.js 14 (Tailwind CSS)**.

## Key Capabilities Included in Core

1. **Multi-Tenant SaaS Auth & Mandatory Organization Setup Gate**:
   - Multiple companies can register via **Email + Password** or **Google OAuth 2.0**.
   - Every user must complete the **4-Step Organization Setup Wizard** (Company Branding → Academic/FY Session → Google Drive Connect → Launch) before any Core OS features unlock (`OrgSetupGuard`).
   - Users can belong to multiple organizations and switch organizations seamlessly.
2. **Automatic Google Drive Folder & Two-Way Google Sheets Sync**:
   - Connecting a Google account (at login or during Org Setup) automatically creates a Drive folder (`Company OS Data – <Org Name>`) and provisions `Core Data <Session>` with tabs (`Employees`, `Departments`, `Roles`, `Products`, `Students`, `Notices`, `Sync Errors`).
   - **DB → Sheets (Mirror)**: Outbox + BullMQ debounced queue with `batchUpdate` and exponential backoff on HTTP 429.
   - **Sheets → DB (Validated Two-Way Sync)**: Whitelisted editable columns, row-hash diffing, DB-wins conflict resolution, active Employee email validation, and automatic reversion + logging to `Sync Errors`.
3. **Core Platform Engines (Built Once, Used by Every Module)**:
   - Employee Master (`EMP-0001`), Departments & Heads
   - Hierarchical RBAC, Permission Clusters, **Attorney Delegation** (`Delegated <= Giver` with cascade revoke), and Multi-Workspace Skins
   - Student Registry (`STU-2026-000001` synchronous generation)
   - Product / Program Master & Fee Plans
   - Session Engine (Archive & Clone)
   - No-Code Form Builder & Custom Data Types
   - Single Task Engine + KRA/KPI Engine + Daily Operation Hub (BOD / EOD / 0–200% Scoring)
   - Immutable Audit Logs & Transactional Outbox/Inbox Event Bus
4. **Plugin Docking Station (Connecting Future Modules to an Organization)**:
   - Standard `manifest.json` registration, Tenant-Scoped Module API Tokens (`cos_mod_...`), automatic plugin Google Sheet creation inside the Organization's Drive folder, and `@company-os/plugin-sdk` + `plugins/sample-crm-plugin`.

## Quick Start (Local)

```bash
cp .env.example .env
# Fill GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET in .env
docker compose up -d --build
```

- Web App: `http://localhost:3000`
- Core API: `http://localhost:4000/api/v1`

See **`USER_MANUAL_DEPLOYMENT_GUIDE.md`** for the complete step-by-step live deployment manual, Google Cloud OAuth setup, and how to connect future plugins (CRM, Academic, Finance, HRMS) to any Organization.
