# Taurus Project Control v26 — exact setup guide

## 1. GitHub folder and Vercel root

Replace the old application folder. Using the same upload method as your v8 screenshot, GitHub must contain:

`package.json`

In Vercel → Settings → Build and Deployment use:

- Root Directory: leave blank / `./`
- Framework Preset: Next.js
- Build Command: default / Override OFF
- Install Command: default / Override OFF
- Output Directory: default / Override OFF

Do not add another wrapper folder and do not set the Output Directory to `public`, `dist` or `out`.

## 2. Supabase final repair

The Supabase account email may differ from the Taurus website-user email.

If migrations 0001–0003 were installed previously, confirm these are installed in order:

`supabase/migrations/0005_final_portal_repair.sql`

`supabase/migrations/0006_reliable_versioned_excel_publishing.sql`

`supabase/migrations/0007_document_control_command_center.sql`

`supabase/migrations/0008_user_presence_and_admin_repair.sql`

Copy each complete file into Supabase → SQL Editor → New query and click **Run**. Migration 0005 must show the Taurus owner as an active `super_admin`. Migration 0006 must return `progress_version_id` and `schedule_version_id`. Migration 0007 adds the MDR workflow fields. Migration 0008 repairs user presence and administration. v26 does not add another SQL migration.

For a completely new database, run 0001 through 0008 in numerical order. The repair migrations are idempotent.

## 3. Vercel environment variables

Add every variable separately and enable Production and Preview:

| Name | Exact value type |
|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL beginning with `https://` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The same project's `sb_publishable_` key |
| `SUPABASE_SERVICE_ROLE_KEY` | The same project's `sb_secret_` key |
| `DEFAULT_PROJECT_ID` | UUID returned by the SQL migration |
| `PROJECT_CONTROL_URL` | Production portal URL, for example `https://taurusprojectcontrol.vercel.app` |
| `RESEND_API_KEY` | Server-only API key from Resend |
| `PROJECT_NOTIFICATION_FROM_EMAIL` | Verified sender, for example `Taurus Project Control <notifications@updates.example.com>` |

Do not include `NAME=` inside a Value field. Do not add quotes, Markdown links or repeated URLs. Never put the `sb_secret_` value in GitHub or in a `NEXT_PUBLIC_` variable.

## 4. Authentication URLs

In Supabase → Authentication → URL Configuration:

- Site URL: `https://taurusprojectcontrol.vercel.app`
- Redirect URL: `https://taurusprojectcontrol.vercel.app/auth/callback`
- Redirect URL: `https://taurusprojectcontrol.vercel.app/auth/update-password`

## 5. Redeploy

Commit the new folder to `main`. In Vercel → Deployments choose **Redeploy** for the latest commit and redeploy without the old build cache.

## 6. Excel update workflow

1. Sign in as `sarwar.khalid@miranenergy.com`.
2. Open **Import & Publish**.
3. Select the progress/MDR workbook, schedule workbook, or both.
4. Wait for **Ready / Live**.
5. Refresh any open dashboard tab.
6. If the signed-in user is an Admin or Super Admin, click **Email update notification** to notify every other active project member.

The Project Schedule workbook controls the portal Data Date. The progress/MDR data date is used only when no schedule has ever been published. Email delivery is individual, so recipients do not see other users' addresses.

After installing migration 0007, upload the MDR workbook again. The portal will calculate each active document's contractual clock from the MDR dates: Taurus has 14 calendar days after ENKA submission, and ENKA has 14 calendar days after Taurus response/comment.

The supplied workbooks are below 1 MB, while the portal accepts XLSX files up to 8 MB each. Future updates can have new filenames, dates and row counts, but must preserve the supplied sheet names and row/column structure.

## 7. Progress rules

- Monthly discipline selector: Overall, Engineering, Procurement, Construction and Mobilization.
- Weekly discipline selector: Engineering and Construction because these are the weekly sheets present in the workbook.
- S-curves use cumulative values; sub-discipline incremental rows are accumulated automatically.
- SPI is `actual cumulative ÷ approved baseline cumulative` at the latest date where actual progress was achieved.
- SV is actual cumulative minus approved baseline cumulative at that same date.
- Monthly and weekly SPI/SV use actual divided by or minus the approved baseline at the same latest reporting point. Current Plan is not used in controlled performance KPIs.

## Troubleshooting

- `404 NOT_FOUND`: correct the Root Directory and keep Output Directory Override OFF.
- `permission denied for table profiles` or `audit_log`: run migration 0005 in the exact Supabase project used by Vercel.
- Upload failure mentioning database upgrade 0006: run `0006_reliable_versioned_excel_publishing.sql`, then retry without another deployment.
- Upload failure mentioning `due_date`, `responsible_party` or database upgrade 0007: run `0007_document_control_command_center.sql`, then upload the MDR workbook again.
- Upload failure mentioning the secret applies to user creation/removal; confirm `SUPABASE_SERVICE_ROLE_KEY` is the `sb_secret_` key from the same project as `NEXT_PUBLIC_SUPABASE_URL`.
- No live data: verify `DEFAULT_PROJECT_ID` equals the UUID returned by migration 0005, then upload the workbooks again.
- Workbook not recognized: use `.xlsx` and retain the original sheet/column format.
- Header shows an old progress date: upload the Project Schedule workbook with its `Data Date` column; v26 gives that date priority.
- Email button reports missing configuration: add `RESEND_API_KEY`, `PROJECT_NOTIFICATION_FROM_EMAIL` and `PROJECT_CONTROL_URL` in Vercel, verify the sender domain, then redeploy.
