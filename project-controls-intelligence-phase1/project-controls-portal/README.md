# Project Controls Intelligence Portal — Phase 1

This is the deployable first step for a secure project-controls website using GitHub, Vercel and Supabase. It validates the two supplied workbook structures and provides the foundation for OneDrive/SharePoint storage in Phase 2.

## Included in this phase

- Secure username/email and password login using Supabase Auth.
- Password-reset flow.
- Administrator invitation page with controlled roles.
- Protected executive, document-control, progress and schedule pages.
- Responsive dashboard based on the supplied reference screenshots.
- Multi-file Excel upload and validation preview.
- Automatic recognition of:
  - The seven-sheet progress/MDR workbook.
  - The 17-column schedule Excel export.
- Validation for required sheets and columns, unique documents, discipline/status distributions, progress curves, activity counts, criticality and broken WBS/discipline values.
- Supabase database schema, project membership model, audit log and Row Level Security.

The original Excel files are deliberately excluded from the source package and `.gitignore` so they are never published accidentally.

## Verified source structures

The original progress workbook currently resolves to 914 unique MDR documents, with separate monthly, construction-weekly and engineering-weekly progress sheets. The schedule export resolves to 2,709 activities/milestones plus 554 WBS/summary rows.

The schedule Excel file is suitable for a visual preview, but it does not contain predecessors, successors, calendars, constraints or resources. A native Primavera XER importer is the Phase 2 source for a fully logical Gantt.

## 1. Create a private GitHub repository

Use a **private** repository because the production portal will handle company project data.

1. Create a new empty private repository in GitHub.
2. Upload everything inside this project folder.
3. Do not upload any Excel, XER, XML, `.env` or `.env.local` files.

## 2. Configure Supabase

The Supabase account may use a different email from GitHub and Vercel.

1. Create a new Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/migrations/0001_initial_schema.sql`.
4. In **Authentication → Users**, create the first user with email and password.
5. In SQL Editor, promote that account:

```sql
update public.profiles
set role = 'super_admin', username = 'admin', full_name = 'Project Administrator'
where email = 'YOUR-ADMIN-EMAIL';
```

6. Create the first controlled project and copy the returned ID:

```sql
insert into public.projects (code, name, created_by)
select 'BAZYAN-II', 'Bazian II Power Plant Conversion Project', id
from public.profiles
where email = 'YOUR-ADMIN-EMAIL'
returning id;
```

7. Keep public user sign-up disabled. New users should be created through the portal invitation page.
8. In **Authentication → URL Configuration**, add the Vercel production URL and callback URL:
   - `https://YOUR-DOMAIN/auth/callback`

## 3. Configure Vercel

1. Import the private GitHub repository into Vercel.
2. Add the environment variables listed in `.env.example`.
3. Keep `NEXT_PUBLIC_DEMO_MODE=false` in production.
4. Deploy.

Required production variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
DEFAULT_PROJECT_ID
```

The service-role key is server-only. Never expose it in browser code or prefix it with `NEXT_PUBLIC_`.

## 4. Run locally (optional)

```bash
cp .env.example .env.local
npm install
npm run dev
```

For local UI demonstration only, set `NEXT_PUBLIC_DEMO_MODE=true` and set a private `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD`. Never enable demo mode on Vercel.

## 5. Test the first controlled import

1. Sign in as the administrator.
2. Open **Import & Publish**.
3. Select both original `.xlsx` files.
4. Confirm the progress workbook is detected as **Progress & MDR**.
5. Confirm the schedule workbook is detected as **Schedule export**.
6. Review warnings before continuing.

The **Publish update** button is intentionally disabled in Phase 1. Phase 2 will add direct-to-OneDrive upload sessions, staging tables, an atomic publish transaction, update notifications and rollback.

## Security decisions already built in

- Project data is inaccessible to anonymous users.
- Role and project access are enforced in PostgreSQL Row Level Security, not only in the interface.
- Service credentials stay server-side.
- User passwords are handled by Supabase Auth; administrators cannot read them.
- Imports are limited to XLSX ZIP signatures and 4 MB during this first server-preview phase.
- Original workbooks are not stored in GitHub.

## Phase 2 scope

- Microsoft Entra application registration.
- OneDrive for Business / SharePoint document-library connection.
- Resumable browser-to-OneDrive uploads.
- Native XER parser with WBS, relationships, calendars, constraints, resources and activity codes.
- Versioned staging and atomic publishing.
- Searchable MDR table with protected document links.
- Real-time user refresh, import history and rollback.
- Admin-configurable discipline and subdiscipline mappings.
