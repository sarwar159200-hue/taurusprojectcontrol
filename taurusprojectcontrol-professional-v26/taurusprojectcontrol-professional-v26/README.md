# Taurus Project Control — secure portal

This package is the complete replacement folder for the Taurus Project Control portal. It uses Next.js, Vercel and Supabase and keeps the existing Vercel root-directory structure.

## Included

- Taurus-branded email/username and password login.
- Forced password change after an administrator issues a temporary password.
- Protected super-administrator account for `sarwar.khalid@miranenergy.com`.
- Administrator creation of users with email, username, role and temporary password.
- Temporary-password generator and secure copy button.
- User role and section-by-section access levels: no access, view or manage.
- Safe user-access removal with self-removal and super-administrator safeguards.
- User activity history for sign-in, sign-out, page access, password changes, user administration and workbook validation.
- Protected executive, document-control, progress, schedule and import pages.
- Automatic Excel validation, analysis and live publication for the supplied progress/MDR and schedule formats.
- Interactive S-curves for all available years at year, month and week level.
- Exact workbook discipline/sub-discipline filters, workbook-faithful cumulative curves, baseline-only reporting-point SPI/SV, expected-finish forecast and a paginated full schedule table.
- Complete English, Kurdish Sorani and Arabic interface switching with UK, Kurdistan Region and Iraqi flags and right-to-left layouts.
- Persistent light/dark appearance switching throughout the login and protected portal pages.
- Controlled project reporting-week labels (`05-Feb-2026 = W32`), with exact date and values available on hover.
- Faster authenticated navigation through request-level query reuse, parallel paged Supabase reads, reduced progress payloads and an immediate dashboard loading state.
- Source-backed Document Control Command Center using the MDR tab, with universal search, live filters, status mix, 12-week review throughput, discipline health, aging, priority actions and a paginated register.
- Contractual workflow control: Taurus response is due 14 calendar days after ENKA submission; ENKA comment incorporation is due 14 calendar days after the Taurus response. Every active document shows its due date, responsible party and live overdue days.
- Row Level Security and a server-only Supabase service key.

Passwords are handled by Supabase Auth. They are never stored in the application database, source code or activity log.

## Important password requirement

Do not use any password that has been posted in chat or stored in GitHub. Create a new unique administrator password directly in Supabase Authentication. The database password, Supabase account password and Taurus website password must be different.

## A. Complete Supabase first

### 1. Create the first Auth user

In the Frankfurt Supabase project:

1. Open **Authentication → Users**.
2. Click **Add user → Create new user**.
3. Enter `sarwar.khalid@miranenergy.com`.
4. Enter a new private password of at least 12 characters.
5. Enable **Auto confirm user**.
6. Create the user.

If this Auth user already exists, do not create it again.

### 2. Install the access-management upgrade

The original schema has already been installed. Now open **SQL Editor → New query**, paste the complete contents of:

`supabase/migrations/0002_user_access_management.sql`

Click **Run**. This migration:

- Promotes the named Taurus owner to `super_admin`.
- Gives the owner `manage` permission for every section.
- Adds temporary-password and section-permission controls.
- Creates or updates the controlled `BAZYAN-II` project.
- Adds the owner as a project member.

Then run `supabase/migrations/0003_live_excel_publishing.sql` and
`supabase/migrations/0005_final_portal_repair.sql`, followed by
`supabase/migrations/0006_reliable_versioned_excel_publishing.sql`, then
`supabase/migrations/0007_document_control_command_center.sql`.
Migration 0005 displays `default_project_id`; copy that UUID for Vercel.

If migrations 0001–0004 are already installed, run migrations 0005, 0006 and 0007. They are idempotent. Migration 0006 stores document, progress and schedule rows in reliable batches; migration 0007 adds MDR contractual due dates, responsibility and delay-analysis fields.

### 3. Obtain Supabase connection values

From the same Frankfurt project, copy:

- Project URL.
- Publishable key.
- Secret/service-role key.
- The `default_project_id` returned by migration 0003.

Never put the secret/service-role key in GitHub or in a variable beginning with `NEXT_PUBLIC_`.

## B. Replace the GitHub folder

The expected repository layout is:

```text
taurusprojectcontrol-professional-v26/
├── app/
├── components/
├── lib/
├── public/
├── supabase/
└── package.json
```

Upload the extracted `taurusprojectcontrol-professional-v26` folder. Keep the old folder until v26 deploys successfully. Do not upload Excel, XER, `.env` or `.env.local` files.

## C. Configure Vercel

Keep the Vercel **Root Directory** as:

```text
taurusprojectcontrol-professional-v26
```

Add these environment variables under **Vercel → Project Settings → Environment Variables**:

```text
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-FRANKFURT-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SB_SECRET_KEY
DEFAULT_PROJECT_ID=THE_UUID_RETURNED_BY_0003
PROJECT_CONTROL_URL=https://YOUR-PROJECT-CONTROL-DOMAIN
RESEND_API_KEY=YOUR_SERVER_ONLY_RESEND_KEY
PROJECT_NOTIFICATION_FROM_EMAIL=Taurus Project Control <notifications@YOUR-VERIFIED-DOMAIN>
```

Apply each variable to Production and Preview, then redeploy. Keep the Resend and Supabase secret keys server-only.

## D. First login and user administration

1. Open the Vercel production URL.
2. Sign in with `sarwar.khalid@miranenergy.com` and the new password created in Supabase.
3. Open **User Access**.
4. Select **Create user account**.
5. Enter the user's name, username and email.
6. Generate a temporary password and copy it before submitting.
7. Choose a role and access level for every portal section.
8. Send the email/username and temporary password to the user through a secure channel.

At first login, the user is redirected to create a new private password. Administrators can later edit permissions, issue another temporary password or remove portal access. Administrators cannot view anyone's private password.

## Security controls

- Anonymous users cannot access project pages or data.
- Every protected page checks the signed-in user's section permission on the server.
- Every server operation first checks the signed-in user's section permission.
- Workbook publishing uses the signed-in administrator and the versioned RLS policies installed by migration 0006. The server-only Supabase secret remains limited to Auth user creation, password administration and access removal.
- A non-super-administrator cannot assign or modify the `super_admin` role.
- The owner cannot delete their own account or remove their own super-administrator role.
- A super-administrator account cannot be deleted through the portal.
- Temporary passwords are not written to logs.
- Public self-registration should remain disabled in Supabase.
- Original workbooks are excluded from GitHub.

## Data-import scope

The portal validates, analyzes and publishes replacement XLSX progress/MDR and schedule files that retain the supplied workbook formats. Compact dashboard summaries and version pointers are stored in `published_project_updates`; document, cumulative progress and schedule rows are written to their normalized version tables in small batches. Document hyperlinks are read from MDR column D. Active due dates use MDR columns T and V with the two approved 14-calendar-day workflow rules. Monthly disciplines are Overall, Engineering, Procurement, Construction and Mobilization. Weekly curves are available for Engineering and Construction. Their exact workbook sub-disciplines are normalized to readable labels. All S-curves use controlled cumulative values. SPI, SV, schedule signal and expected finish compare actual only with the approved baseline at the same reporting point; Current Plan is not used in performance KPIs. Binary workbook storage in OneDrive and native Primavera XER logic are not included in this release.
