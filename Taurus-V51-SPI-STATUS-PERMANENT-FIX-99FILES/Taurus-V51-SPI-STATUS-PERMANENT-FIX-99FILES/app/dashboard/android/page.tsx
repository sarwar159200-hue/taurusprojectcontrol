import { requireSection } from "@/lib/auth";

const APK_URL = "https://miranenergy-my.sharepoint.com/:u:/p/sarwar_khalid/IQAiF09qjYQHSLDaZN1dQqC1Af0ymOKJV7pIszgyBkY0TB8?e=LKBLXX";

export default async function AndroidDownloadPage() {
  await requireSection("overview");
  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">TAURUS MOBILE</span><h1>Download Android App</h1><p>Official Taurus Project Control Android installation package.</p></div>
      </div>
      <section className="dashboard-grid lower-grid">
        <article className="panel wide-panel">
          <div className="panel-heading"><div><span className="eyebrow">ANDROID INSTALLATION</span><h2>Taurus-Project-Control-V25</h2></div></div>
          <ol className="android-install-steps">
            <li>Download and open <strong>Taurus-Project-Control-V25</strong>.</li>
            <li>If Android blocks installation, open <strong>Settings</strong> and enable <strong>Allow from this source</strong>.</li>
            <li>Return and select <strong>Install</strong>.</li>
            <li>If Play Protect warns you, select <strong>More details → Install anyway</strong>.</li>
            <li>When finished, open <strong>Taurus-Project-Control</strong>.</li>
          </ol>
          <a className="primary-button android-download-button" href={APK_URL} rel="noopener noreferrer" target="_blank">↓ Download Taurus Android App</a>
          <div className="security-notice"><strong>Security notice:</strong> Install Taurus-Project-Control only from the official Taurus Energy SharePoint link shown on this page. Android may warn because the app is distributed outside Google Play.</div>
        </article>
      </section>
    </>
  );
}
