# Company OS Core — Complete User Manual & Live Deployment Guide

## 1. System Overview & Multi-Tenant SaaS Flow

**Company OS Core** is a multi-tenant SaaS Microkernel platform built on **NestJS + PostgreSQL 16 (Prisma + Row-Level Security) + Redis (BullMQ) + Next.js 14 (Tailwind CSS)**.

### End-to-End User Journey (SaaS Onboarding Gate)
1. **Sign Up / Login (`/auth/signup` or `/auth/login`)**: Any founder or company owner registers using Email + Password OR **Continue with Google**.
2. **Mandatory Organization Setup Wizard (`/onboarding`)**: Until an organization is created and marked `setupStatus = COMPLETED`, the backend `OrgSetupGuard` and frontend dashboard guard block all Core OS features.
   - **Step 1**: Company Profile & Branding (Name, Legal Name, Phone, GSTIN, Address).
   - **Step 2**: Active Session (`2026-27`), Timezone (`Asia/Kolkata`), Currency (`INR`).
   - **Step 3**: Automatic Google Drive Folder & Two-Way Sheets Sync provisioning.
3. **Unlock Full OS (`/dashboard`)**: Core auto-creates `TEN-XXXX`, founding Super Admin `EMP-0001`, default Departments, Roles, Workspaces, and (if Google is linked) creates the Drive folder `Company OS Data – <Org Name>` + `Core Data 2026-27` spreadsheet.
4. **Multi-Organization Support**: A single user can create or join multiple organizations and switch between them using the sidebar Organization Switcher.

---

## 2. Google Cloud Console Setup (Required for Login + Auto Drive Folder + Two-Way Sheets Sync)

1. Go to **Google Cloud Console** (`https://console.cloud.google.com`) and create a new project (e.g., `Company-OS-Prod`).
2. Enable these two APIs under **APIs & Services → Library**:
   - **Google Drive API**
   - **Google Sheets API**
3. Configure **OAuth Consent Screen**:
   - Choose **External** (for multi-tenant SaaS) and fill App Name (`Company OS`), Support Email, and Authorized Domains.
   - Add Scopes:
     - `openid`
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `.../auth/drive.file` *(least-privilege scope: app only accesses folders/sheets it creates)*
     - `.../auth/spreadsheets`
   - While testing before Google verification, add your team's Google emails under **Test Users**.
4. Create **OAuth 2.0 Client ID** (Application type: **Web Application**):
   - **Authorized JavaScript origins**:
     - Local: `http://localhost:3000`
     - Live: `https://app.yourdomain.com`
   - **Authorized redirect URIs**:
     - Local Login: `http://localhost:4000/api/v1/auth/google/callback`
     - Local Sheets: `http://localhost:4000/api/v1/core/sheets/oauth/callback`
     - Live Login: `https://api.yourdomain.com/api/v1/auth/google/callback`
     - Live Sheets: `https://api.yourdomain.com/api/v1/core/sheets/oauth/callback`
5. Copy **Client ID** and **Client Secret** into `.env`.

---

## 3. Running Locally (5-Minute Docker Setup)

1. Unzip `company-os-core-fullstack.zip` and open a terminal inside `company-os-core/`.
2. Copy environment file and generate strong secrets:
   ```bash
   cp .env.example .env
   openssl rand -hex 32   # Paste into ENCRYPTION_KEY_HEX
   ```
3. Paste your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `.env`.
4. Start PostgreSQL, Redis, Core API, and Next.js Web App:
   ```bash
   docker compose up -d --build
   ```
5. Enable PostgreSQL Row-Level Security (RLS) after initial schema push:
   ```bash
   docker exec -i companyos_postgres psql -U companyos -d company_os < apps/api/prisma/rls_policies.sql
   ```
6. Open `http://localhost:3000` in your browser!

---

## 4. How to Make Company OS Live in Production

### Option A — Fastest Managed Cloud (Zero Server Maintenance)
| Layer | Recommended Provider | Setup Steps |
|---|---|---|
| **PostgreSQL 16** | Neon / Supabase (Mumbai region `ap-south-1`) | Create DB → copy `DATABASE_URL` → run `prisma db push` + `rls_policies.sql` |
| **Redis** | Upstash Redis (Mumbai) | Create Redis DB → copy `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| **Core Backend API** | Render / Railway | Connect GitHub repo → Root Directory: `.` → Dockerfile: `apps/api/Dockerfile` → Add all `.env` variables → Bind custom domain `api.yourdomain.com` |
| **Next.js Frontend** | Vercel | Import GitHub repo → Root Directory: `apps/web` → Set `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1` → Bind `app.yourdomain.com` |

### Option B — Indian VPS / AWS EC2 Mumbai (`ap-south-1`, DPDP Compliant)
1. Provision an Ubuntu 22.04+ server (2 vCPU, 4 GB RAM minimum) in AWS Mumbai or Hostinger/DigitalOcean Bengaluru.
2. Install Docker & Docker Compose:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. Upload the project, configure `.env` with production domains (`https://app.yourdomain.com` and `https://api.yourdomain.com`), and run:
   ```bash
   docker compose up -d --build
   ```
4. Point DNS A-records for `app.yourdomain.com` and `api.yourdomain.com` to your server IP.
5. Configure **Nginx + Certbot (Free Let's Encrypt SSL)** reverse proxy:
   - `app.yourdomain.com` → `http://127.0.0.1:3000`
   - `api.yourdomain.com` → `http://127.0.0.1:4000`
   - Run `sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com`

---

## 5. Google Drive Auto-Folder & Two-Way Sheets Sync Rules

- **Source of Truth**: PostgreSQL is always the source of truth. Google Sheets is a live synchronized mirror.
- **Auto Folder Structure**:
  - Folder: `Company OS Data – <Organization Name>`
  - Core Spreadsheet: `Core Data <Session>` (Tabs: `Employees`, `Departments`, `Products`, `Students`, `Notices`, `Sync Errors`)
  - Future Plugin Spreadsheets: Automatically created inside the **same** Drive folder when a plugin is docked (e.g. `CRM Data 2026-27`, `Academic Data 2026-27`, `Finance Data 2026-27`).
- **DB → Sheets (Auto Mirror)**: Every mutation queues a debounced BullMQ job (5s debounce + exponential backoff on Google HTTP 429 limits).
- **Sheets → DB (Validated Two-Way Sync)**:
  - Only **whitelisted editable columns** (e.g., `Employees.designation`, `Employees.phone`, `Products.description`, `Students.guardianName`) can be changed from Sheets.
  - Locked columns (`code`, `email`, `status`) cannot be tampered with: invalid edits are automatically **reverted** and logged in the **`Sync Errors`** tab and Core Dashboard.
  - Every Sheet edit is validated against an **Active Employee ID** in that Organization.

---

## 6. How Future Modules (CRM, Academic, Finance, HRMS) Connect to an Organization

Core never contains CRM, Academic, or Finance business logic. Every future module connects to an Organization (`tenant_id`) in **3 standard steps without changing Core code**:

1. **Step 1 — Register Plugin Manifest (`POST /api/v1/core/plugins/register`)**:
   - Open **Core → Plugins & Org Docking** (`/dashboard/plugins`) and register the plugin's `manifest.json` (see `plugins/sample-crm-plugin/manifest.json`).
   - Core registers its Workspaces/Skins, Permissions, and **automatically creates its Google Spreadsheet inside that Organization's Drive Folder**.
2. **Step 2 — Issue a Tenant-Scoped Module Token (`POST /api/v1/core/plugins/tokens`)**:
   - The Organization's Super Admin generates a 90-day scoped token (`cos_mod_...`) bound strictly to `(tenant_id, module_key, scopes[])`.
   - The raw token is shown once and stored SHA-256 hashed. If leaked, revoking it affects only that module.
3. **Step 3 — Connect Using `@company-os/plugin-sdk`**:
   - Pass the Organization's `tenantId` + `moduleToken` into `CompanyOsPluginClient` (see `plugins/sample-crm-plugin/src/index.ts`):
     ```ts
     const client = new CompanyOsPluginClient({
       coreApiBaseUrl: 'https://api.yourdomain.com/api/v1',
       tenantId: '<ORG_TENANT_ID>',
       moduleToken: '<COS_MOD_TOKEN>',
       moduleKey: 'crm',
     });
     ```
   - Every plugin API call sends `Authorization: Bearer cos_mod_...`, `X-Tenant-Id`, and `X-Actor-Employee-Id`.
   - Core's `ModuleTokenGuard` verifies all three, applies PostgreSQL RLS for that Organization, executes Core APIs (e.g., synchronous `STU-2026-XXXXXX` creation), routes Events on the Organization's Event Bus, and mirrors plugin rows into that Organization's Google Drive Spreadsheet!

---

## 7. SaaS Platform Super-Admin Control Plane (Beta, Testing & Subscriptions)

1. Add your founder email(s) to `PLATFORM_ADMIN_EMAILS` in `.env` (e.g. `PLATFORM_ADMIN_EMAILS="founder@theprimeclasses.com"`).
2. Log in to Company OS — a gold **"SaaS Platform Control Panel"** button appears in the sidebar leading to `/platform-admin`.
3. From `/platform-admin`, you can:
   - **Control Global Rollout Stage**: Switch CRM, Academic, Finance, HRMS, Inventory, and Growth between `INTERNAL_TESTING` (hidden), `BETA` (override-only), and `PUBLIC` (plan-gated).
   - **Grant Company Overrides**: Give any specific Organization `TESTING_FREE`, `BETA_FREE` (with optional expiry days, e.g. 30 days), `PAID_ADDON`, or `BLOCKED` (instant kill switch).
   - **Manage Plans & Billing**: Upgrade/downgrade any Organization between `STARTER`, `GROWTH`, and `ENTERPRISE`, or connect Razorpay to `POST /api/v1/core/marketplace/billing/razorpay-webhook` for automatic subscription activation.
4. End-users simply open **App Store (1-Click Modules)** (`/dashboard/app-store`) and click **1-Click Install** — Core verifies entitlement, installs the module, creates its Google Sheet in the Org's Drive folder, and unlocks its Workspaces automatically!
