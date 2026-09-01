const { app, BrowserWindow, shell } = require("electron");

const PORTAL_URL = process.env.TAURUS_PORTAL_URL || "https://taurusprojectcontrol.vercel.app";

app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-component-update");

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#071b2d",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: true
    }
  });

  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Keep the portal in-app; open external sites in the user's browser.
    if (url.startsWith(PORTAL_URL)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadURL(PORTAL_URL, { userAgent: `${win.webContents.getUserAgent()} TaurusProjectControl/1.0` });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
