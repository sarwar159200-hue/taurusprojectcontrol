# Taurus Project Control v9 — start here

This replacement fixes Excel publishing and administrative permission errors, then adds the exact monthly/weekly discipline hierarchy and cumulative S-curve logic from the supplied workbook.

## 1. Replace the GitHub folder

Upload the extracted `taurusprojectcontrol-complete-v9` folder to the root of the GitHub repository, using the same method shown in your v8 screenshot.

GitHub must contain this exact file path:

`taurusprojectcontrol-complete-v9/project-controls-intelligence-phase1/project-controls-portal/package.json`

Do not upload the outer ZIP/download folder, Excel files, `.env` files or passwords.

## 2. Run the two final Supabase repairs

Migrations 0001–0003 must already exist. Then:

1. Open Supabase → SQL Editor → New query.
2. Run the complete `supabase/migrations/0005_final_portal_repair.sql` file.
3. Then run the complete `supabase/migrations/0006_reliable_versioned_excel_publishing.sql` file.
4. Confirm migration 0006 returns two rows: `progress_version_id` and `schedule_version_id`.

Both migrations are safe to rerun. Migration 0006 replaces the oversized single-row publish with reliable batched version storage.

## 3. Confirm Vercel

Root Directory for that GitHub layout:

`taurusprojectcontrol-complete-v9/project-controls-intelligence-phase1/project-controls-portal`

Required variables:

```text
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=https://zgnrylnogmsvmtslpgpf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=the sb_publishable_ key from this project
SUPABASE_SERVICE_ROLE_KEY=the sb_secret_ key from this same project
DEFAULT_PROJECT_ID=bedaf64e-e2e5-4992-ac57-3cffcab6f6cc
```

Apply them to Production and Preview. Keep the secret only in Vercel.

## 4. Redeploy and upload

Redeploy the latest commit without the old cache. Sign in, open **Import & Publish**, and select either workbook or both together. New filenames and updated dates/rows are accepted when the worksheet layout remains the same. The upload screen now displays the exact database error if setup is incomplete.

## Progress hierarchy included

- Monthly: Overall, Engineering, Procurement, Construction and Mobilization.
- Engineering monthly/weekly: Plant Design, Architecture & Civil, Electrical, I&C, Process and Mechanical.
- Procurement monthly: Key Equipment, Civil, Electrical, Instrumentation Control, Mechanical and PD.
- Construction monthly/weekly: Earthworks, Civil Works, Steel Erection, Architectural, Piping Works, E&I Works, Mechanical Equipment, ST & GT Erection Works, H.V.A.C Works, Fire Fighting Works, Heat Insulation Works, Painting & Coating Works and Start-Up.
- S-curves always use cumulative values.
- SPI and SV use planned and actual values from the same latest actual reporting point. Weekly sheets without a separate current-plan series use the workbook baseline as the weekly plan reference.
