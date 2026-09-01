# Taurus Project Control v26 — start here

This release reconciles the portal to the supplied Excel workbook, detects weekly disciplines directly from the available weekly sheets, and improves page and publication response time. It retains the Project Schedule as the governing source for the portal Data Date and the controlled update-email workflow for Admin and Super Admin users.

## 1. Replace the GitHub folder

Upload the extracted `taurusprojectcontrol-professional-v26` folder to the root of the GitHub repository.

GitHub must contain this exact file path:

`package.json`

Do not upload the outer ZIP/download folder, Excel files, `.env` files or passwords.

## 2. Confirm the Supabase repairs

Migrations 0001–0003 must already exist. Then:

1. Open Supabase → SQL Editor → New query.
2. Run migrations `0005`, `0006`, `0007` and `0008` if they were not already installed for v24.
3. Confirm migration 0006 returns `progress_version_id` and `schedule_version_id`.
4. Confirm migration 0007 returns `due_date`, `responsible_party` and `review_cycle_days`.
5. Migration 0008 enables reliable user presence and administration.

No new Supabase migration is required for v26.

## 3. Confirm Vercel

Exact Root Directory for that GitHub layout:

`taurusprojectcontrol-professional-v26`

Required variables:

```text
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=https://zgnrylnogmsvmtslpgpf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=the sb_publishable_ key from this project
SUPABASE_SERVICE_ROLE_KEY=the sb_secret_ key from this same project
DEFAULT_PROJECT_ID=bedaf64e-e2e5-4992-ac57-3cffcab6f6cc
PROJECT_CONTROL_URL=https://YOUR-PROJECT-CONTROL-DOMAIN
RESEND_API_KEY=your Resend API key
PROJECT_NOTIFICATION_FROM_EMAIL=Taurus Project Control <notifications@YOUR-VERIFIED-DOMAIN>
```

Apply them to Production and Preview. Keep the secret only in Vercel.

## 4. Redeploy and upload

Redeploy the latest commit without the old cache. Sign in, open **Import & Publish**, and select either workbook or both together. New filenames and updated dates/rows are accepted when the worksheet layout remains the same. The upload screen now displays the exact database error if setup is incomplete.

After a successful publish, Admin and Super Admin users see **Email update notification**. The action emails every other active project member privately and records the result in the Activity Log. Configure and verify the sender domain before using this action.

The header Data Date is controlled by the Project Schedule workbook. In the supplied schedule, the exact imported date is `2026-08-22`; a later progress-only upload will not replace that schedule-controlled date.

## Progress hierarchy included

- Monthly: Overall, Engineering, Procurement, Construction and Mobilization.
- Engineering monthly/weekly: Plant Design, Architecture & Civil, Electrical, I&C, Process and Mechanical.
- Procurement monthly: Key Equipment, Civil, Electrical, Instrumentation Control, Mechanical and PD.
- Construction monthly/weekly: Earthworks, Civil Works, Steel Erection, Architectural, Piping Works, Electrical Works, I&C Works, Mechanical Equipment, ST & GT Erection Works, H.V.A.C Works, Fire Fighting Works, Heat Insulation Works, Painting & Coating Works and Start-Up.
- S-curves always use cumulative values.
- SPI and SV use only actual and approved baseline at the same latest reporting point.
- Expected finish uses approved baseline duration divided by the same-date SPI.
- The S-curve displays only approved baseline and cumulative actual; Current Plan is excluded from all performance KPIs.
- Every reporting period remains in the chart. Weekly labels follow the workbook's project-week sequence (`05-Feb-2026 = W32`), month bands remain visible, and hovering shows the exact date/value. The complete S-curve fits from start to finish without horizontal scrolling.
- Executive Overview includes live discipline/sub-discipline filters and professional radial gauges for actual and approved baseline progress.
- The executive KPI cards are shown first, followed by the discipline/sub-discipline control panel and then the selected S-curve.
- English uses the UK flag, Kurdish Sorani uses the Kurdistan Region flag, and Arabic uses the Iraqi flag. Arabic and Sorani use right-to-left layout.
- The moon/sun control switches the full portal between light and dark mode and remembers the user's selection.

## Document Control workflow included

- Taurus response due date = latest ENKA submission date + 14 calendar days.
- ENKA comment-incorporation due date = latest Taurus response date + 14 calendar days.
- Every active MDR row displays the responsible party, contractual due date and current overdue/remaining days.
- Universal search checks document number, title, discipline, revision, status, action, responsibility, dates, transmittal and delay-analysis fields.
- Status, discipline, responsibility, review-stage and due-date filters update the KPIs, charts and register together.
- File links come directly from the MDR worksheet.
