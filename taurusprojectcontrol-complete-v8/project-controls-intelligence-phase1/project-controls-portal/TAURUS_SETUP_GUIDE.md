# Taurus Project Control v8 — exact setup guide

## 1. GitHub folder and Vercel root

Replace the old application folder. After the upload, GitHub must contain:

`project-controls-intelligence-phase1/project-controls-portal/package.json`

In Vercel → Settings → Build and Deployment use:

- Root Directory: `project-controls-intelligence-phase1/project-controls-portal`
- Framework Preset: Next.js
- Build Command: default / Override OFF
- Install Command: default / Override OFF
- Output Directory: default / Override OFF

Do not add another wrapper folder and do not set the Output Directory to `public`, `dist` or `out`.

## 2. Supabase final repair

The Supabase account email may differ from the Taurus website-user email.

If migrations 0001–0003 were installed previously, run only:

`supabase/migrations/0005_final_portal_repair.sql`

Copy the complete file into Supabase → SQL Editor → New query and click **Run**. The result must show the Taurus owner as an active `super_admin` and return the `default_project_id`.

For a completely new database, run 0001, 0002, 0003 and 0005 in that order. Migration 0004 can remain installed; migration 0005 is idempotent.

## 3. Vercel environment variables

Add every variable separately and enable Production and Preview:

| Name | Exact value type |
|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL beginning with `https://` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The same project's `sb_publishable_` key |
| `SUPABASE_SERVICE_ROLE_KEY` | The same project's `sb_secret_` key |
| `DEFAULT_PROJECT_ID` | UUID returned by the SQL migration |

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

The supplied workbooks are below 1 MB, while the portal accepts XLSX files up to 8 MB each. Future updates can have new filenames, dates and row counts, but must preserve the supplied sheet names and row/column structure.

## 7. Progress rules

- Monthly discipline selector: Overall, Engineering, Procurement, Construction and Mobilization.
- Weekly discipline selector: Engineering and Construction because these are the weekly sheets present in the workbook.
- S-curves use cumulative values; sub-discipline incremental rows are accumulated automatically.
- SPI is `actual cumulative ÷ planned cumulative` at the latest date where actual progress was achieved.
- SV is actual cumulative minus planned cumulative at that same date.
- Weekly sheets do not contain a separate current-plan block, so weekly SPI uses the baseline cumulative series as the plan reference and labels this clearly.

## Troubleshooting

- `404 NOT_FOUND`: correct the Root Directory and keep Output Directory Override OFF.
- `permission denied for table profiles` or `audit_log`: run migration 0005 in the exact Supabase project used by Vercel.
- Upload failure mentioning the secret: confirm `SUPABASE_SERVICE_ROLE_KEY` is the `sb_secret_` key from the same project as `NEXT_PUBLIC_SUPABASE_URL`, save it, and redeploy.
- No live data: verify `DEFAULT_PROJECT_ID` equals the UUID returned by migration 0005, then upload the workbooks again.
- Workbook not recognized: use `.xlsx` and retain the original sheet/column format.
