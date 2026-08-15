# Taurus Project Control — exact setup guide

## 1. GitHub folder layout

Delete the old nested upload from the repository, then upload the folder supplied in this ZIP. After upload, GitHub must show this exact path:

`project-controls-intelligence-phase1/project-controls-portal/package.json`

Do not add another wrapper folder above `project-controls-intelligence-phase1`.

## 2. Supabase database and administrator

The email used to own the Supabase account can be different from the email used to sign in to this website.

1. Open Supabase > SQL Editor.
2. Run these files in order: `supabase/migrations/0001_initial_schema.sql`, `0002_user_access_management.sql`, and `0003_live_excel_publishing.sql`.
3. If the first two were already run successfully, run only `0003_live_excel_publishing.sql`.
4. Copy the `default_project_id` returned by the last SQL query. It is required by Vercel.
5. Open Authentication > Users > Add user. Create the website administrator using `sarwar.khalid@miranenergy.com`. Use a new private password; do not reuse a password posted in chat.
6. Open Project Settings > API Keys and copy the Project URL, publishable key, and secret key. Never expose the secret key in GitHub or in a browser variable.

Migration 0002 automatically promotes that administrator email to `super_admin` after the user signs in. A super administrator can add/remove users, issue temporary passwords, inspect activity, and set section permissions.

## 3. Vercel — exact root and build settings

1. Import `sarwar159200-hue/taurusprojectcontrol` into Vercel, or open the existing Vercel project.
2. Go to Settings > Build and Deployment.
3. Set **Root Directory** exactly to:

   `project-controls-intelligence-phase1/project-controls-portal`

4. Set Framework Preset to **Next.js**.
5. Leave Build Command, Install Command and Output Directory on **Vercel default / Override OFF**. Do not set Output Directory to `public`, `dist`, or `out`.
6. Save.

## 4. Vercel environment variables

Open Vercel > Project > Settings > Environment Variables. Add each variable separately and enable Production, Preview and Development.

| Name | Value |
|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL, starting with `https://` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key; keep it secret |
| `DEFAULT_PROJECT_ID` | UUID returned by migration 0003 |

The variable names are case-sensitive. Do not add quote marks or spaces. The Supabase URL is not the database connection string.

After saving, go to Deployments, open the latest deployment menu, choose Redeploy, clear/disable build cache, and redeploy.

## 5. Supabase authentication URLs

In Supabase > Authentication > URL Configuration:

- Site URL: `https://YOUR-VERCEL-DOMAIN.vercel.app`
- Redirect URL: `https://YOUR-VERCEL-DOMAIN.vercel.app/auth/callback`
- Redirect URL: `https://YOUR-VERCEL-DOMAIN.vercel.app/auth/update-password`

Replace the placeholder with the exact production domain shown by Vercel.

## 6. Sign in and publish new Excel updates

1. Visit the Vercel production domain and sign in with the Auth user created in Supabase.
2. Open **Import & Publish**.
3. Select the progress/MDR workbook, schedule workbook, or both. Use `.xlsx`, maximum 8 MB per file.
4. The portal validates, analyzes, and publishes automatically. There is no second Publish button.
5. All authorized users see the latest published analysis after refreshing.

Replacement files may have different filenames, dates and row counts, but must keep the same worksheets and column/row format as the supplied originals. The MDR file link is read from column D and opens in a new tab. That link may point to OneDrive, SharePoint, Box, or another authorized HTTPS location.

The portal stores the calculated analysis in Supabase. It does not upload the binary Excel workbook into OneDrive; keep the source workbooks in your controlled storage location.

## Troubleshooting

- Vercel `404 NOT_FOUND`: the Root Directory or Output Directory is wrong. Apply section 3 exactly and redeploy.
- Login fails: confirm the user exists in Supabase Authentication > Users, Email provider is enabled, Site URL is correct, and the three public variables are present in the production deployment.
- `DEFAULT_PROJECT_ID is missing or invalid`: rerun migration 0003 and copy its UUID without spaces.
- Upload gives a table error: migration 0003 was not run in the same Supabase project used by the Vercel variables.
