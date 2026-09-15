type ProjectUpdateEmailInput = {
  administratorName: string;
  dashboardUrl: string;
  dataDate: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayDataDate(value: string | null) {
  if (!value) return "Not stated";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

export function projectDashboardUrl(requestUrl: string) {
  const configured = process.env.PROJECT_CONTROL_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || new URL(requestUrl).origin;
  const base = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  return new URL("/dashboard", base.endsWith("/") ? base : `${base}/`).toString();
}

export function buildProjectUpdateEmail(input: ProjectUpdateEmailInput) {
  const administratorName = input.administratorName.trim() || "A Taurus Project Control administrator";
  const dashboardUrl = input.dashboardUrl;
  const dataDate = displayDataDate(input.dataDate);
  const safeAdministrator = escapeHtml(administratorName);
  const safeDashboardUrl = escapeHtml(dashboardUrl);
  const safeDataDate = escapeHtml(dataDate);

  return {
    subject: "Taurus Project Control dashboard updated",
    text: [
      "Dear Taurus Project Control User,",
      "",
      `${administratorName} has published a recent update to the Taurus Project Control dashboard. Please use the link below to review the latest project information and changes.`,
      "",
      `Project data date: ${dataDate}`,
      "",
      dashboardUrl,
      "",
      "Best regards,",
      "Project Control Team"
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#14263b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fa;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dce5ef;border-radius:14px;overflow:hidden">
          <tr><td style="background:#071b2c;padding:24px 30px;color:#ffffff">
            <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#7ce8be;font-weight:700">Taurus Project Control</div>
            <div style="font-size:24px;font-weight:700;margin-top:7px">Dashboard update published</div>
          </td></tr>
          <tr><td style="padding:30px">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.6">Dear Taurus Project Control User,</p>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.65"><strong>${safeAdministrator}</strong> has published a recent update to the Taurus Project Control dashboard. Please review the latest project information and changes using the secure link below.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f5f9fc;border-left:4px solid #2ecf91;border-radius:8px">
              <tr><td style="padding:14px 16px;font-size:14px;color:#496176"><strong style="color:#14263b">Project data date:</strong> ${safeDataDate}</td></tr>
            </table>
            <p style="margin:0 0 24px;text-align:center"><a href="${safeDashboardUrl}" style="display:inline-block;background:#0877d1;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 22px;border-radius:8px">Open Project Control Dashboard</a></p>
            <p style="margin:0 0 6px;font-size:13px;line-height:1.55;color:#6b7e91">If the button does not open, copy this address into your browser:</p>
            <p style="margin:0 0 28px;font-size:13px;line-height:1.55;word-break:break-all"><a href="${safeDashboardUrl}" style="color:#0877d1">${safeDashboardUrl}</a></p>
            <p style="margin:0;font-size:15px;line-height:1.6">Best regards,<br><strong>Project Control Team</strong></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
  };
}

export async function sendProjectUpdateEmail(input: ProjectUpdateEmailInput & {
  recipientEmail: string;
  idempotencyKey: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = (process.env.PROJECT_NOTIFICATION_FROM_EMAIL || process.env.RESEND_FROM_EMAIL)?.trim();
  if (!apiKey || !from) {
    throw new Error("Email notifications require RESEND_API_KEY and PROJECT_NOTIFICATION_FROM_EMAIL in Vercel.");
  }

  const content = buildProjectUpdateEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey.slice(0, 256)
    },
    body: JSON.stringify({
      from,
      to: [input.recipientEmail],
      subject: content.subject,
      html: content.html,
      text: content.text
    }),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!response.ok || !payload.id) {
    throw new Error(payload.message || payload.name || `Email service returned HTTP ${response.status}.`);
  }
  return payload.id;
}
