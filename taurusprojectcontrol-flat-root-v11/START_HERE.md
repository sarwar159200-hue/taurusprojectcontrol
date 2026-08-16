# Taurus Project Control flat-root release — start here

This release keeps the reliable Excel publishing from v9 and upgrades both the Executive Overview and Progress pages with fully interactive discipline, sub-discipline and Year/Month/Week S-curves.

## 1. Replace the GitHub repository contents

Extract the ZIP. Open the extracted folder, select its contents, and upload those contents directly to the root of the GitHub repository.

GitHub must show this exact path:

`taurusprojectcontrol/package.json`

The `app`, `components`, `lib`, `public`, `supabase` and `tests` folders must appear on the repository's first page beside `package.json`. Do not upload the extracted folder itself as another wrapper folder.

Do not upload the outer ZIP/download folder, Excel files, `.env` files or passwords.

## 2. Run the two final Supabase repairs

Migrations 0001–0003 must already exist. Then:

1. Open Supabase → SQL Editor → New query.
2. Run the complete `supabase/migrations/0005_final_portal_repair.sql` file.
3. Then run the complete `supabase/migrations/0006_reliable_versioned_excel_publishing.sql` file.
4. Confirm migration 0006 returns two rows: `progress_version_id` and `schedule_version_id`.

Both migrations are safe to rerun. Migration 0006 replaces the oversized single-row publish with reliable batched version storage.

## 3. Confirm Vercel

Root Directory for this flat GitHub layout: **leave it empty**. Remove the old long path in Vercel and save.

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
- Every month is labelled on the chart. Long timelines scroll horizontally instead of hiding month labels.
- Project-week numbering starts with Week 29 on 15-Jan-2026; 05-Feb-2026 is Week 32.
