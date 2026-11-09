import Link from "next/link";

export function generateMetadata({ params }: { params: { legal: string } }) {
  const isPrivacy = params.legal === "privacy";
  return {
    title: isPrivacy ? "Privacy Policy | MCCS" : "Terms of Service | MCCS",
    description: isPrivacy
      ? "Privacy Policy for MCCS - Miran Commercial Control System"
      : "Terms of Service for MCCS - Miran Commercial Control System",
  };
}

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-800">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Miran Commercial Control System</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: 4 October 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7">
          <section><h2 className="text-lg font-bold text-slate-900">1. Purpose</h2><p className="mt-2">MCCS (Miran Commercial Control System) is a business application used to support authorized commercial-control activities, including project, vendor, purchase order, invoice, payment, milestone, document and reporting workflows.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">2. Information we process</h2><p className="mt-2">MCCS may process account information needed for authentication and access control, business records entered or uploaded by authorized users, and technical information required to operate and secure the application.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">3. Google Drive access</h2><p className="mt-2">When an authorized administrator connects Google Drive, MCCS uses the permissions approved on Google&apos;s consent screen only to perform the Google Drive functions provided by MCCS, such as storing or managing application documents. Google authorization credentials are used only to maintain the requested integration and are not sold or used for advertising.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">4. How information is used</h2><p className="mt-2">Information is used to provide MCCS functionality, maintain authorized access, support document and commercial workflows, troubleshoot the service, and protect the application against unauthorized use.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">5. Sharing and disclosure</h2><p className="mt-2">MCCS does not sell personal information. Information may be processed by service providers required to operate the application and may be disclosed where required by applicable law or necessary to protect the security of the service.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">6. Security and retention</h2><p className="mt-2">Reasonable technical and organizational safeguards are used to protect application data. Information is retained only for as long as required for legitimate business, operational, security, contractual or legal purposes.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">7. Access and authorization</h2><p className="mt-2">MCCS is intended for authorized users. Access may be restricted, suspended or removed when authorization is no longer required or when necessary to protect the system.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">8. Contact</h2><p className="mt-2">Questions about this policy may be sent to the support or developer contact shown on the MCCS Google authorization consent screen.</p></section>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-sm"><Link className="font-semibold text-blue-600 hover:underline" href="/terms">Terms of Service</Link></div>
      </article>
    </main>
  );
}


function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-800">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Miran Commercial Control System</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: 4 October 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7">
          <section><h2 className="text-lg font-bold text-slate-900">1. Use of MCCS</h2><p className="mt-2">MCCS (Miran Commercial Control System) is provided for authorized business use. Users must use the application only for legitimate activities within the permissions granted to their accounts.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">2. Accounts and security</h2><p className="mt-2">Users are responsible for protecting their account credentials and must not share access with unauthorized persons. Access may be limited or revoked when required for security or administration.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">3. Business information</h2><p className="mt-2">Users are responsible for ensuring that information entered, uploaded or managed through MCCS is accurate, appropriate and authorized for business use.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">4. Google Drive integration</h2><p className="mt-2">MCCS may connect to Google Drive after an authorized administrator grants permission through Google OAuth. The integration is used only for MCCS document functions permitted by the administrator. Authorization may be revoked through the relevant Google account or application administration controls.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">5. Availability and changes</h2><p className="mt-2">The application may be updated, maintained or temporarily unavailable. Features and access controls may be changed when reasonably necessary for operational, security or business requirements.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">6. Prohibited use</h2><p className="mt-2">Users must not attempt unauthorized access, interfere with system security, misuse credentials, introduce malicious content, or use MCCS in violation of applicable law or organizational requirements.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">7. Privacy</h2><p className="mt-2">Use of information in MCCS is described in the MCCS Privacy Policy.</p></section>
          <section><h2 className="text-lg font-bold text-slate-900">8. Contact</h2><p className="mt-2">Questions about these terms may be sent to the support or developer contact shown on the MCCS Google authorization consent screen.</p></section>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-sm"><Link className="font-semibold text-blue-600 hover:underline" href="/privacy">Privacy Policy</Link></div>
      </article>
    </main>
  );
}


export default function LegalPage({ params }: { params: { legal: string } }) {
  if (params.legal === "privacy") return <PrivacyPage />;
  if (params.legal === "terms") return <TermsPage />;
  return <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-800"><div className="mx-auto max-w-3xl"><h1 className="text-3xl font-bold">Page not found</h1><p className="mt-4"><Link href="/">Return to MCCS</Link></p></div></main>;
}
