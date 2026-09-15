const WINDOWS_X64 = "https://miranenergy-my.sharepoint.com/:u:/p/sarwar_khalid/IQAABpw2vlakQIbq8oAINTI4AXbtFLd4Fjp6EzsS8vBx99A?e=f5BAnJ";
const WINDOWS_X86 = "https://miranenergy-my.sharepoint.com/:u:/p/sarwar_khalid/IQCFKWL_w9Z8S5tY-MTCxEqaAU9Xws1-HXnoAaJ67JSWfhY?e=O5TFuo";

export default function WindowsDownloadPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TAURUS WINDOWS</span>
          <h1>Download Windows App</h1>
          <p>Official Taurus Project Control desktop installers for 64-bit and 32-bit Windows.</p>
        </div>
      </div>

      <section className="panel download-app-panel">
        <div className="download-app-hero">
          <div className="download-app-icon" aria-hidden="true">⊞</div>
          <div>
            <span className="eyebrow">WINDOWS DESKTOP APPLICATION</span>
            <h2>Taurus Project Control</h2>
            <p>Choose the installer that matches your Windows architecture.</p>
          </div>
        </div>

        <div className="download-app-actions">
          <a className="primary-button" href={WINDOWS_X64} rel="noreferrer" target="_blank">Download 64-bit (x64)</a>
          <a className="secondary-button" href={WINDOWS_X86} rel="noreferrer" target="_blank">Download 32-bit (x86)</a>
        </div>

        <div className="installation-guide">
          <h3>Windows Installation</h3>
          <ol>
            <li>Double-click the downloaded Taurus Project Control setup installer: <strong>x64 for 64-bit Windows</strong> or <strong>x86 for 32-bit Windows</strong>.</li>
            <li>If Windows displays a Microsoft Defender SmartScreen warning, click <strong>More info</strong>. The warning may appear because this installer is not published through the Microsoft Store.</li>
            <li>Click <strong>Run anyway</strong>.</li>
            <li>Click <strong>Next</strong>. You may change the installation location if required; otherwise keep the default location and click <strong>Next</strong>.</li>
            <li>Click <strong>Next</strong> to continue the installation.</li>
            <li>When installation is complete, click <strong>Finish</strong>.</li>
          </ol>
        </div>

        <div className="callout success-callout">
          <strong>Live system</strong>
          <span>The Windows program connects to the live Taurus Project Control website. Normal website updates are therefore reflected in the Windows program without installing a separate application update.</span>
        </div>

        <div className="security-notice">
          <strong>Security notice</strong>
          <p>Install Taurus Project Control only from the official Taurus Energy SharePoint links shown on this page.</p>
        </div>
      </section>
    </>
  );
}
