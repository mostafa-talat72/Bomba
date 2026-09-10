const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const net = require("net");
const crypto = require("crypto");

// ============================================================
// MTE Systems Desktop - Electron wrapper
// Spawns the Express + MongoDB backend locally, then opens the
// built frontend in a BrowserWindow. Single instance per machine.
// ============================================================

// Atlas URI ثابت — يعمل مباشرة بدون الحاجة لـ atlas-import.txt أو تشفير
// تحذير: الرابط يحتوي كلمة السر، لا تنشر المثبت خارج المؤسسة
const HARDCODED_ATLAS_URI = "mongodb+srv://Bomba:t1fp995Bde03vPQY@cluster0.yl9w7jv.mongodb.net/bomba?retryWrites=true&w=majority&appName=Cluster0&serverSelectionTimeoutMS=60000&socketTimeoutMS=120000&connectTimeoutMS=60000&maxPoolSize=10&minPoolSize=2&maxIdleTimeMS=60000&heartbeatFrequencyMS=10000";

const isDev = process.argv.includes("--dev");
const isPrintAgent = process.argv.includes("--print-agent");
const CASH_DRAWER_PULSES = [
  [0x1b, 0x70, 0x00, 0x19, 0xfa],
];

// Keep userData at a stable location across branding changes so all
// existing data (config, secrets, uploads, backups) is preserved.
app.setPath("userData", path.join(app.getPath("appData"), "bomba-desktop"));

let serverProcess = null;
let mongoProcess = null;
let splashWindow = null;
let mainWindow = null;
let isQuitting = false;
let localPrintServer = null;
let localBackendPort = 5000;
let cachedPrinters = null;
let cachedPrintersAt = 0;
let silentPrintWindow = null;
let silentPrintWindowQueue = Promise.resolve();

// ---- Paths (userData pinned to bomba-desktop for data compatibility) ----
const userDataDir = app.getPath("userData");
const dataDir = path.join(userDataDir, "data");
const configPath = path.join(userDataDir, "config.json");
const logPath = path.join(userDataDir, "server.log");

// ---- Global crash guard (covers failures BEFORE splash) ----
function showFatalAndQuit(title, message) {
  try {
    // Ensure splash doesn't hide the dialog
    try { if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close(); } catch {}
    splashWindow = null;
  } catch {}
  try {
    dialog.showMessageBoxSync({
      type: "error",
      title,
      message: title,
      detail: `${message}\n\nالسجل: ${logPath}`,
      buttons: ["إعادة المحاولة", "فتح السجل", "إغلاق"],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
  } catch {
    try { dialog.showErrorBox(title, `${message}\n\nالسجل: ${logPath}`); } catch {}
  }
  // Offer to open log and/or relaunch
  try {
    const choice = dialog.showMessageBoxSync({
      type: "question",
      title: "MTE Systems",
      message: "هل تريد فتح السجل أو إعادة المحاولة؟",
      detail: logPath,
      buttons: ["إعادة المحاولة", "فتح السجل", "إغلاق"],
      defaultId: 0,
      cancelId: 2,
    });
    // Note: showMessageBoxSync is sync, we handle after first dialog
  } catch {}
}

function handleStartupError(title, detail) {
  try { if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close(); } catch {}
  splashWindow = null;
  try {
    const res = dialog.showMessageBoxSync({
      type: "error",
      title,
      message: title,
      detail: `${detail}\n\nالسجل: ${logPath}`,
      buttons: ["إعادة المحاولة", "فتح السجل", "إغلاق"],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (res === 0) {
      app.relaunch();
      app.quit();
      return true; // handled
    }
    if (res === 1) {
      try { require("electron").shell.openPath(logPath); } catch {}
      // After showing log, offer relaunch again
      const r2 = dialog.showMessageBoxSync({
        type: "question",
        title: "MTE Systems",
        message: "إعادة المحاولة؟",
        buttons: ["إعادة المحاولة", "إغلاق"],
        defaultId: 0,
        cancelId: 1,
      });
      if (r2 === 0) { app.relaunch(); app.quit(); return true; }
    }
  } catch {
    try { dialog.showErrorBox(title, `${detail}\n\nالسجل: ${logPath}`); } catch {}
  }
  try { app.quit(); } catch {}
  return true;
}

process.on("uncaughtException", (err) => {
  try { require("fs").appendFileSync(logPath, `\n[uncaughtException] ${new Date().toISOString()} ${err?.stack || err?.message || String(err)}\n`); } catch {}
  handleStartupError("MTE Systems — خطأ غير متوقع", String(err?.stack || err?.message || err));
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
  try { require("fs").appendFileSync(logPath, `\n[unhandledRejection] ${new Date().toISOString()} ${msg}\n`); } catch {}
  handleStartupError("MTE Systems — خطأ غير متوقع", msg);
});

async function waitForPrintResources(printWindow) {
  // Fast path: wait for fonts/images only, measure height via scrollHeight.
  // (The old version scanned every DOM node with getBoundingClientRect which
  // added seconds on large receipts.)
  return printWindow.webContents.executeJavaScript(`
    (async () => {
      try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 150))]); } catch {}
      const viewportWidth = Math.max(1, document.documentElement.clientWidth);
      const rootStyle = document.documentElement.style;
      rootStyle.width = viewportWidth + "px";
      rootStyle.margin = "0";
      rootStyle.direction = "ltr";
      const bodyStyle = document.body.style;
      bodyStyle.width = "100%";
      bodyStyle.maxWidth = "100%";
      bodyStyle.margin = "0";
      bodyStyle.position = "relative";
      bodyStyle.left = "-3mm";
      bodyStyle.transform = "scale(0.93)";
      bodyStyle.transformOrigin = "top center";
      bodyStyle.paddingLeft = "0";
      bodyStyle.paddingRight = "0";
      bodyStyle.boxSizing = "border-box";
      bodyStyle.overflow = "visible";
      bodyStyle.direction = "ltr";
      bodyStyle.display = "flex";
      bodyStyle.flexDirection = "column";
      bodyStyle.alignItems = "stretch";
      const images = Array.from(document.images || []);
      return {
        failedImages: images
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.src || image.alt || "unknown image"),
        contentHeight: Math.max(document.documentElement.scrollHeight || 0, document.body.scrollHeight || 0),
        contentWidth: Math.max(document.documentElement.scrollWidth || 0, document.body.scrollWidth || 0),
        viewportWidth,
        widestElement: 0,
      };
    })();
  `, true);
}

async function getAvailablePrinters() {
  const now = Date.now();
  if (cachedPrinters?.length && now - cachedPrintersAt < 30000) return cachedPrinters;
  cachedPrinters = await mainWindow?.webContents?.getPrintersAsync() || [];
  cachedPrintersAt = now;
  return cachedPrinters;
}

const BOMBA_RAW_PRINT_CS = `using System;
using System.Runtime.InteropServices;
public static class BombaRawPrint {
  public static string LastError = "";
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DocInfo { public string DocName; public string OutputFile; public string DataType; }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern int StartDocPrinter(IntPtr handle, int level, DocInfo info);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);
  public static bool Send(string name, byte[] bytes, string doc) {
    IntPtr handle;
    if (!OpenPrinter(name, out handle, IntPtr.Zero)) {
      LastError = "OpenPrinter failed: " + Marshal.GetLastWin32Error();
      return false;
    }
    try {
      var info = new DocInfo { DocName = doc, DataType = "RAW" };
      if (StartDocPrinter(handle, 1, info) == 0) {
        LastError = "StartDocPrinter failed: " + Marshal.GetLastWin32Error();
        return false;
      }
      if (!StartPagePrinter(handle)) {
        LastError = "StartPagePrinter failed: " + Marshal.GetLastWin32Error();
        return false;
      }
      int written;
      var ok = WritePrinter(handle, bytes, bytes.Length, out written);
      var writeError = ok ? "" : "WritePrinter failed: " + Marshal.GetLastWin32Error();
      EndPagePrinter(handle); EndDocPrinter(handle);
      if (!ok || written != bytes.Length) {
        LastError = writeError.Length > 0 ? writeError : "WritePrinter wrote " + written + " of " + bytes.Length + " bytes";
        return false;
      }
      return true;
    } finally { ClosePrinter(handle); }
  }
}`;

function runRawPrintScript(encodedScript, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      encodedScript,
    ], { windowsHide: true });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Raw printer command timed out"));
    }, timeoutMs);
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else {
        const details = stderr
          .replace(/#< CLIXML[\s\S]*?<S S="Error">/g, "")
          .replace(/_x000D__x000A_/g, "\n")
          .replace(/<\/S>[\s\S]*?<\/Objs>/g, "")
          .trim();
        reject(new Error(details || `PowerShell exited with code ${code}`));
      }
    });
  });
}

// ---- Persistent PowerShell raw-print daemon (fast drawer) ----
// One PowerShell process with the WinSpool helper compiled ONCE at startup.
// Drawer kicks then take ~100ms instead of ~1s per one-shot spawn.
let rawPrintDaemon = null;
let rawPrintDaemonStarting = null;

function startRawPrintDaemon() {
  if (process.platform !== "win32") return Promise.resolve(null);
  if (rawPrintDaemon && !rawPrintDaemon.dead) return Promise.resolve(rawPrintDaemon);
  if (rawPrintDaemonStarting) return rawPrintDaemonStarting;
  rawPrintDaemonStarting = new Promise((resolve) => {
    let settled = false;
    const done = (daemon) => {
      if (settled) return;
      settled = true;
      rawPrintDaemonStarting = null;
      resolve(daemon);
    };
    try {
      const bootstrap = `$null = Add-Type -TypeDefinition @"
${BOMBA_RAW_PRINT_CS}
"@
[Console]::Out.WriteLine('READY')
while ($true) {
  $l = [Console]::In.ReadLine()
  if ($null -eq $l) { break }
  if ($l -eq '') { continue }
  try {
    $p = $l.Split('|')
    $sent = [BombaRawPrint]::Send($p[0], [Convert]::FromBase64String($p[1]), $p[2])
    if ($sent) { [Console]::Out.WriteLine('OK') } else { [Console]::Out.WriteLine('ERR ' + [BombaRawPrint]::LastError) }
  } catch { [Console]::Out.WriteLine('ERR ' + $_.Exception.Message) }
}`;
      const encoded = Buffer.from(bootstrap, "utf16le").toString("base64");
      const child = spawn("powershell.exe", [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        encoded,
      ], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      const daemon = { child, dead: false, ready: false, pending: [], queue: Promise.resolve() };
      rawPrintDaemon = daemon;
      let outBuf = "";
      const failAll = (err) => {
        daemon.dead = true;
        if (rawPrintDaemon === daemon) rawPrintDaemon = null;
        daemon.pending.splice(0).forEach((job) => job.reject(err));
      };
      child.stdout.on("data", (chunk) => {
        outBuf += chunk.toString();
        let idx;
        while ((idx = outBuf.indexOf("\n")) >= 0) {
          const line = outBuf.slice(0, idx).replace(/\r$/, "");
          outBuf = outBuf.slice(idx + 1);
          if (!daemon.ready) {
            if (line === "READY") done(daemon);
            continue;
          }
          const job = daemon.pending.shift();
          if (!job) continue;
          if (line === "OK") job.resolve();
          else job.reject(new Error(line.replace(/^ERR\s*/, "") || "Raw print failed"));
        }
      });
      child.stderr.on("data", () => {});
      child.on("error", (err) => { failAll(err); done(null); });
      child.on("close", () => { failAll(new Error("Print daemon exited")); done(null); });
      setTimeout(() => { if (!daemon.ready) { try { child.kill(); } catch {} failAll(new Error("Print daemon start timed out")); done(null); } }, 10000);
    } catch (err) {
      done(null);
    }
  });
  return rawPrintDaemonStarting;
}

// One ESC/POS job through the persistent daemon (serialized, single flight).
function daemonSend(printerName, bytes, doc) {
  return startRawPrintDaemon().then((daemon) => {
    if (!daemon || daemon.dead) throw new Error("daemon unavailable");
    const run = () => new Promise((resolve, reject) => {
      let flushed = false;
      const timer = setTimeout(() => {
        try { daemon.child.kill(); } catch {}
        daemon.dead = true;
        if (rawPrintDaemon === daemon) rawPrintDaemon = null;
        const err = new Error("Raw printer command timed out");
        // Bytes already flushed to the daemon almost certainly reached the
        // printer (it forwards immediately). Re-sending would kick the
        // drawer / reprint a SECOND time for one user tap.
        err.transmitted = flushed;
        reject(err);
      }, 3000);
      const job = {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => {
          clearTimeout(timer);
          const i = daemon.pending.indexOf(job);
          if (i >= 0) daemon.pending.splice(i, 1);
          reject(e);
        },
      };
      daemon.pending.push(job);
      daemon.child.stdin.write(
        `${printerName}|${Buffer.from(bytes).toString("base64")}|${doc || "Bomba printer command"}\n`,
        (err) => {
          if (err) job.reject(err);
          else flushed = true;
        }
      );
    });
    daemon.queue = daemon.queue.then(run, run);
    return daemon.queue;
  });
}

async function sendWindowsRawCommand(printerName, bytes) {
  if (process.platform !== "win32") {
    return { success: false, message: "Raw printer commands are supported on Windows only" };
  }
  try {
    await daemonSend(String(printerName), bytes, "Bomba printer command");
    return { success: true };
  } catch (daemonError) {
    // Timeout AFTER flush almost certainly already kicked/printed: reporting
    // failure here would make the caller re-send -> visible double-kick.
    if (daemonError && daemonError.transmitted) {
      console.log(`[raw-print] ${printerName}: no daemon ack but bytes were flushed - treating as sent (no resend)`);
      return { success: true };
    }
    try {
    // Fast path: bytes go as base64 CLI arg — no temp file, no disk read.
    const payload = Buffer.from(bytes).toString("base64");
    const escapedPrinter = String(printerName).replace(/'/g, "''");
    const script = `
$bytes = [Convert]::FromBase64String('${payload}')
Add-Type -TypeDefinition @"
${BOMBA_RAW_PRINT_CS}
"@
if (-not [BombaRawPrint]::Send('${escapedPrinter}', $bytes, 'Bomba printer command')) {
  throw [BombaRawPrint]::LastError
}
`;
    const encodedScript = Buffer.from(script, "utf16le").toString("base64");
    await runRawPrintScript(encodedScript, 4000);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message || "Raw printer command failed" };
  }
  }
}

// Send several ESC/POS jobs through the persistent daemon (no spawn at all).
// Used after printing: drawer kick + paper cut together instead of 2 spawns.
async function sendWindowsRawCommands(printerName, jobs) {
  if (process.platform !== "win32") {
    return { success: false, message: "Raw printer commands are supported on Windows only" };
  }
  try {
    for (const job of jobs) {
      await daemonSend(String(printerName), job.bytes, job.doc);
    }
    return { success: true };
  } catch (daemonError) {
    // Same rule as single commands: never re-send bytes that were already
    // flushed (that would reprint / re-kick). Only fall through when the
    // daemon never took the bytes.
    if (daemonError && daemonError.transmitted) {
      console.log(`[raw-print] ${printerName}: batch flushed without ack - treating as sent (no resend)`);
      return { success: true };
    }
    // Fall through to the one-shot PowerShell fallback below.
  }
  try {
    const escapedPrinter = String(printerName).replace(/'/g, "''");
    const sends = jobs.map((job) => {
      const payload = Buffer.from(job.bytes).toString("base64");
      const doc = String(job.doc || "Bomba printer command").replace(/'/g, "''");
      return `$b=[Convert]::FromBase64String('${payload}'); if(-not [BombaRawPrint]::Send('${escapedPrinter}',$b,'${doc}')){throw [BombaRawPrint]::LastError}`;
    }).join("\n");
    const script = `Add-Type -TypeDefinition @"\n${BOMBA_RAW_PRINT_CS}\n"@\n${sends}\n`;
    const encodedScript = Buffer.from(script, "utf16le").toString("base64");
    await runRawPrintScript(encodedScript, 5000);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message || "Raw printer command failed" };
  }
}

async function sendPrinterPostCommands(printerName, { openDrawer = false, cutPaper = false } = {}) {
  const warnings = [];
  const jobs = [];
  if (openDrawer) jobs.push({ bytes: CASH_DRAWER_PULSES[0], doc: "Bomba cash drawer" });
  if (cutPaper) jobs.push({ bytes: [0x1d, 0x56, 0x00], doc: "Bomba paper cut" });
  if (jobs.length === 0) return warnings;
  // One PowerShell spawn for drawer+cut together (was 2 sequential spawns).
  const combined = await sendWindowsRawCommands(printerName, jobs);
  if (combined.success) {
    if (openDrawer) console.log(`[cash-drawer] ${printerName}: command accepted`);
    return warnings;
  }
  // Fallback: drawer pulses one by one (different PIN/wiring), then cut alone.
  if (openDrawer) {
    let drawerOpened = false;
    let lastDrawerError = combined.message || "";
    for (const pulse of CASH_DRAWER_PULSES) {
      const drawer = await sendWindowsRawCommand(printerName, pulse);
      console.log(`[cash-drawer] ${printerName}: ${drawer.success ? "command accepted" : drawer.message}`);
      if (drawer.success) {
        drawerOpened = true;
        break;
      }
      lastDrawerError = drawer.message;
    }
    if (!drawerOpened) warnings.push(`Cash drawer: ${lastDrawerError || "Cash drawer command failed"}`);
    else if (cutPaper) {
      const cut = await sendWindowsRawCommand(printerName, [0x1d, 0x56, 0x00]);
      if (!cut.success) warnings.push(`Paper cut: ${cut.message}`);
    }
  } else if (cutPaper) {
    warnings.push(`Paper cut: ${combined.message || "Paper cut failed"}`);
  }
  return warnings;
}

// Hidden print window, created once and reused. Pre-warmed at startup so the
// first receipt doesn't pay BrowserWindow creation cost on click.
function ensureSilentPrintWindow(paperWidthMm = 80) {
  if (silentPrintWindow && !silentPrintWindow.isDestroyed()) return silentPrintWindow;
  silentPrintWindow = new BrowserWindow({
    show: false,
    skipTaskbar: true,
    useContentSize: true,
    width: Math.round(paperWidthMm * 3.78),
    height: 2400,
    backgroundColor: "#ffffff",
    webPreferences: { contextIsolation: true, sandbox: true, javascript: true },
    parent: mainWindow || undefined,
  });
  return silentPrintWindow;
}

async function printHtmlSilently(html, requestedPrinterName, paperWidthMm = 80) {
  let releasePrintWindow;
  const previousPrint = silentPrintWindowQueue;
  silentPrintWindowQueue = new Promise((resolve) => { releasePrintWindow = resolve; });
  await previousPrint;
  try {
    const normalizedPaperWidthMm = Math.max(58, Math.min(150, Number(paperWidthMm) || 80));
    const printCss = `
      <style id="bomba-agent-print-layout">
        @page { size: ${normalizedPaperWidthMm}mm auto; margin: 0 !important; }
        html, body {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          overflow: visible !important;
          white-space: normal !important;
          direction: ltr !important;
          position: relative !important;
          left: -3mm !important;
          transform: scale(0.93) !important;
          transform-origin: top center !important;
        }
        body > * { direction: rtl !important; }
        body {
          box-sizing: border-box !important;
          width: 100% !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
          direction: ltr !important;
          position: relative !important;
          left: -3mm !important;
          transform: scale(0.93) !important;
          transform-origin: top center !important;
        }
        body > * {
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          direction: rtl !important;
        }
        *, *::before, *::after {
          min-width: 0 !important;
          max-width: 100% !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
        }
        .stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .stat-card, .header, .footer { min-width: 0 !important; }
        table, thead, tbody, tr, th, td, div, img {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; }
        th, td {
          min-width: 0 !important;
          max-width: 100% !important;
          padding: 0.5mm 0 !important;
          overflow: visible !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          white-space: normal !important;
        }
        .footer, .thank-you, .qr-section { break-inside: avoid !important; page-break-inside: avoid !important; }
      </style>
    `;
    const printableHtml = /<\/head>/i.test(html)
      ? html.replace(/<\/head>/i, `${printCss}</head>`)
      : `${printCss}${html}`;
    const virtualPrinterNames = ["Microsoft Print to PDF", "Microsoft XPS", "OneNote", "Fax", "PDF24", "Adobe PDF", "Send To OneNote 2016"];
    let printerName = typeof requestedPrinterName === "string" ? requestedPrinterName.trim() : "";
    if (!printerName) {
      const printers = await getAvailablePrinters();
      printerName = (printers || []).find((printer) =>
        !virtualPrinterNames.some((name) => printer.name.toLowerCase().includes(name.toLowerCase()))
      )?.name || "";
    }
    if (!printerName) return { success: false, message: "No configured printer found" };

    ensureSilentPrintWindow(normalizedPaperWidthMm);
    silentPrintWindow.setSize(Math.round(normalizedPaperWidthMm * 3.78), 2400);
    await silentPrintWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printableHtml)}`);
    let resources = await waitForPrintResources(silentPrintWindow);
    if (resources?.failedImages?.length) {
      return { success: false, message: "Print content contains images that failed to load", failedImages: resources.failedImages };
    }
    const widthMicrons = Math.round(normalizedPaperWidthMm * 1000);
    const heightMicrons = Math.max(100000, Math.min(2000000, Math.round(
      (resources?.contentHeight || 2400) * 25400 / 96
    )));
    const printed = await new Promise((resolve) => {
      silentPrintWindow.webContents.print({
        silent: true,
        preview: false,
        printBackground: true,
        deviceName: printerName,
        margins: { marginType: "none" },
        pageSize: { width: widthMicrons, height: heightMicrons },
      }, (success, failureReason) => resolve({ success, failureReason }));
    });
    return printed.success
      ? { success: true, printerName }
      : { success: false, message: printed.failureReason || "Print job failed", printerName };
  } finally {
    releasePrintWindow();
  }
}

function startLocalPrintServer() {
  const completedPrints = new Map();
  localPrintServer = http.createServer(async (request, response) => {
    const requestOrigin = request.headers.origin;
    const allowedOrigins = new Set([
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      `http://127.0.0.1:${localBackendPort}`,
      `http://localhost:${localBackendPort}`,
    ]);
    if (requestOrigin && allowedOrigins.has(requestOrigin)) {
      response.setHeader("Access-Control-Allow-Origin", requestOrigin);
      response.setHeader("Vary", "Origin");
    }
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method !== "POST" || !["/print", "/cash-drawer"].includes(request.url)) {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ success: false, message: "Not found" }));
      return;
    }
    const bodyChunks = [];
    let bodySize = 0;
    let oversized = false;
    request.on("data", (chunk) => {
      bodyChunks.push(chunk);
      bodySize += chunk.length;
      if (bodySize > 50 * 1024 * 1024) oversized = true;
    });
    request.on("end", async () => {
      try {
        if (oversized) {
          response.writeHead(413, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ success: false, message: "Printable content is too large", maxBytes: 50 * 1024 * 1024 }));
          return;
        }
        const body = Buffer.concat(bodyChunks).toString("utf8");
        let payload;
        try {
          payload = JSON.parse(body);
        } catch (error) {
          throw new Error(`Invalid print request JSON: ${error.message}`);
        }
        if (request.url === "/cash-drawer") {
          const requestedPrinterName = typeof payload.printerName === "string" ? payload.printerName.trim() : "";
          const printerName = requestedPrinterName || (await getAvailablePrinters()).find((item) =>
            !["Microsoft Print to PDF", "Microsoft XPS", "OneNote", "Fax"].some((name) => item.name.toLowerCase().includes(name.toLowerCase()))
          )?.name;
          if (!printerName) {
            response.writeHead(422, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ success: false, message: "No configured printer found" }));
            return;
          }
          const results = [];
          for (const pulse of CASH_DRAWER_PULSES) {
            const result = await sendWindowsRawCommand(printerName, pulse);
            console.log(`[cash-drawer] ${printerName}: ${result.success ? "command accepted" : result.message}`);
            results.push(result);
            if (result.success) break;
            if (/OpenPrinter failed|StartDocPrinter failed|StartPagePrinter failed/.test(result.message || "")) break;
          }
          const result = results.find((item) => item.success) || results[results.length - 1];
          response.writeHead(result.success ? 200 : 503, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ ...result, printerName }));
          return;
        }
        if (typeof payload.html !== "string" || payload.html.length === 0) {
          response.writeHead(422, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ success: false, message: "Printable HTML is required" }));
          return;
        }
        const printKey = typeof payload.printKey === "string" ? payload.printKey : "";
        const previousPrint = printKey && completedPrints.get(printKey);
        if (previousPrint && Date.now() - previousPrint < 10000) {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ success: true, duplicate: true }));
          return;
        }
        const drawerPromise = payload.openDrawer
          ? (async () => {
              const requestedPrinterName = typeof payload.printerName === "string" ? payload.printerName.trim() : "";
              const printerName = requestedPrinterName || (await getAvailablePrinters()).find((item) =>
                !["Microsoft Print to PDF", "Microsoft XPS", "OneNote", "Fax"].some((name) => item.name.toLowerCase().includes(name.toLowerCase()))
              )?.name;
              return printerName
                ? sendPrinterPostCommands(printerName, { openDrawer: true })
                : [];
            })()
          : Promise.resolve([]);
        const printPromise = printHtmlSilently(payload.html, payload.printerName, payload.paperWidthMm);
        const [drawerWarnings, result] = await Promise.all([drawerPromise, printPromise]);
        if (result.success) {
          if (printKey) completedPrints.set(printKey, Date.now());
          result.warnings = drawerWarnings;
          // The printer driver cuts once when each print job finishes.
        } else if (drawerWarnings.length) {
          result.warnings = drawerWarnings;
        }
        response.writeHead(result.success ? 200 : 503, { "Content-Type": "application/json" });
        response.end(JSON.stringify(result));
      } catch (error) {
        console.error("Print request failed:", error);
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ success: false, message: error.message || "Invalid print request" }));
      }
    });
  });
  localPrintServer.on("error", (error) => console.error("Local print bridge error:", error.message));
  localPrintServer.listen(9100, "127.0.0.1");
}

// ---- Helpers ----

function ensureDirs() {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ---- Secret helpers (Windows DPAPI via Electron safeStorage) ----
// Secrets are stored ENCRYPTED in secrets.json. Plain text is only kept as
// a last resort when safeStorage is unavailable (rare) and is logged.

function encryptSecret(value) {
  if (safeStorage.isEncryptionAvailable()) {
    return { enc: safeStorage.encryptString(String(value)).toString("base64") };
  }
  console.warn("[secrets] safeStorage unavailable - storing plain text");
  return { plain: String(value) };
}

function decryptSecret(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return entry; // legacy plain value
  if (entry.enc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(entry.enc, "base64"));
    } catch (err) {
      console.error("Failed to decrypt secret:", err.message);
      return "";
    }
  }
  return entry.plain || "";
}

function loadOrCreateConfig() {
  const defaults = {
    port: 5000,
    databaseUri: "mongodb://localhost:27017/bomba?replicaSet=rs0",
    syncEnabled: true,
    bidirectionalSync: true,
    lanSyncEnabled: true,
    lanDiscoveryPort: 41234,
    lanHeartbeatInterval: 3000,
    lanElectionTimeout: 10000,
    timezone: "Africa/Cairo",
    appUrl: "",
    emailHost: "smtp.gmail.com",
    emailPort: 587,
    emailUser: "mr.robot192002@gmail.com",
    // Server logging (Logger) on/off. When true, server output — including
    // the [typeAudit] startup self-heal lines — is written to server.log.
    enableLogging: false,
  };

  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
      // NEVER silently wipe a hand-edited config (e.g. a missing comma would
      // otherwise delete keys like LAN_ADVERTISE_IP on the next write-back).
      // Back it up and start from defaults instead.
      try {
        const backup = `${configPath}.corrupt-${Date.now()}.bak`;
        fs.copyFileSync(configPath, backup);
        const msg = `config.json is not valid JSON (${err.message}) - backed up to ${backup}, starting from defaults. Fix the JSON to restore your settings.`;
        console.error(msg);
        try {
          fs.appendFileSync(logPath, `[config] ${msg}\n`);
        } catch {}
      } catch {}
      config = {};
    }
  }

  const full = { ...defaults, ...config };

  // ---- Secrets: encrypted store ----
  const secretsPath = path.join(userDataDir, "secrets.json");
  let store = {};
  if (fs.existsSync(secretsPath)) {
    try {
      store = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    } catch (err) {
      console.error("Failed to read secrets.json:", err.message);
    }
  }

  let secretsChanged = false;

  // Migrate plain-text legacy values (old config.json fields) into the
  // encrypted store, then strip them from config.json.
  const migrateToEncrypted = (key, plainValue) => {
    if (plainValue && !store[key]) {
      store[key] = encryptSecret(plainValue);
      secretsChanged = true;
    }
  };
  migrateToEncrypted("atlasUri", config.atlasUri);
  migrateToEncrypted("emailPass", config.emailPass);
  delete full.atlasUri;
  delete full.emailPass;

  // JWT secrets (generated once, survive app updates) - encrypt too.
  if (!store.jwtSecret) {
    store.jwtSecret = encryptSecret(crypto.randomBytes(32).toString("hex"));
    secretsChanged = true;
  } else if (typeof store.jwtSecret === "string") {
    store.jwtSecret = encryptSecret(store.jwtSecret);
    secretsChanged = true;
  }
  if (!store.jwtRefreshSecret) {
    store.jwtRefreshSecret = encryptSecret(crypto.randomBytes(32).toString("hex"));
    secretsChanged = true;
  } else if (typeof store.jwtRefreshSecret === "string") {
    store.jwtRefreshSecret = encryptSecret(store.jwtRefreshSecret);
    secretsChanged = true;
  }

  // Atlas URI import channel: the user drops a plain text file
  // (atlas-import.txt) into the userData folder with the new link; we
  // encrypt it and delete the file so no plain text stays on disk.
  const importPath = path.join(userDataDir, "atlas-import.txt");
  if (fs.existsSync(importPath)) {
    try {
      const raw = fs.readFileSync(importPath, "utf8").trim();
      if (raw) {
        store.atlasUri = encryptSecret(raw);
        secretsChanged = true;
        console.log("[secrets] Atlas URI updated from atlas-import.txt");
      }
      fs.unlinkSync(importPath);
    } catch (err) {
      console.error("Failed to process atlas-import.txt:", err.message);
    }
  }

  if (secretsChanged) {
    try {
      fs.writeFileSync(secretsPath, JSON.stringify(store, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to write secrets.json:", err.message);
    }
  }

  // Persist config back (public settings only - no secrets).
  try {
    fs.writeFileSync(configPath, JSON.stringify(full, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write config.json:", err.message);
  }

  // Decrypt for in-memory use by the server env.
  const secrets = {
    jwtSecret: decryptSecret(store.jwtSecret),
    jwtRefreshSecret: decryptSecret(store.jwtRefreshSecret),
    atlasUri: decryptSecret(store.atlasUri) || HARDCODED_ATLAS_URI,
    emailPass: decryptSecret(store.emailPass),
  };

  return { config: full, secrets };
}

function buildServerEnv(config, secrets, distDir) {
  const effectiveAtlasUri = secrets.atlasUri || HARDCODED_ATLAS_URI;
  const syncEnabled = config.syncEnabled === true && effectiveAtlasUri;

  return {
    ...process.env,
    NODE_ENV: "production",
    ENABLE_LOGGING: config.enableLogging === true ? "true" : "false",
    PORT: String(config.port || 5000),
    // Bind all interfaces so a peer device on the same LAN can connect.
    // (Windows Firewall still needs inbound TCP PORT + inbound UDP 41234.)
    HOST: "0.0.0.0",
    MONGODB_LOCAL_URI: config.databaseUri,
    MONGODB_URI: config.databaseUri,
    MONGODB_ATLAS_URI: effectiveAtlasUri || "",
    SYNC_ENABLED: syncEnabled ? "true" : "false",
    BIDIRECTIONAL_SYNC_ENABLED:
      config.bidirectionalSync === true && syncEnabled ? "true" : "false",
    INITIAL_SYNC_ENABLED: syncEnabled ? "true" : "false",
    SKIP_ATLAS_WHEN_OFFLINE: "true",
    // LAN sync (B+C) - enabled by default for desktop, works with or without Atlas
    LAN_SYNC_ENABLED: String(config.lanSyncEnabled !== false ? "true" : "false"),
    // Pinned LAN IP (multi-NIC machines): honored from config.json so the key
    // users actually edit is the one the server reads.
    LAN_ADVERTISE_IP: config.LAN_ADVERTISE_IP || config.advertiseIp || process.env.LAN_ADVERTISE_IP || "",
    LAN_DISCOVERY_PORT: String(config.lanDiscoveryPort || 41234),
    LAN_HEARTBEAT_INTERVAL: String(config.lanHeartbeatInterval || 3000),
    LAN_ELECTION_TIMEOUT: String(config.lanElectionTimeout || 10000),
    JWT_SECRET: secrets.jwtSecret,
    JWT_REFRESH_SECRET: secrets.jwtRefreshSecret,
    FRONTEND_URL: `http://127.0.0.1:${config.port || 5000}`,
    APP_TIMEZONE: config.timezone || "Africa/Cairo",
    EMAIL_HOST: config.emailHost || "smtp.gmail.com",
    EMAIL_PORT: String(config.emailPort || 587),
    EMAIL_USER: config.emailUser || "",
    EMAIL_PASS: secrets.emailPass || "",
    DESKTOP_DATA_DIR: dataDir,
    DESKTOP_BACKUP_DIR: path.join(dataDir, "backups"),
    DESKTOP_DIST_PATH: distDir,
    SYNC_QUEUE_PATH: path.join(dataDir, "sync-queue.json"),
    LAN_SYNC_QUEUE_PATH: path.join(dataDir, "lan-queue.json"),
  };
}

function spawnServer(serverDir, env) {
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  logStream.write(
    `\n===== MTE Systems server started ${new Date().toISOString()} =====\n`
  );

  const child = spawn(process.execPath, [path.join(serverDir, "server.js")], {
    cwd: serverDir,
    env: {
      ...env,
      ELECTRON_RUN_AS_NODE: "1",
      ELECTRON_NO_ASAR: "1",
      ELECTRON_ENABLE_STACK_DUMPING: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  child.on("exit", (code, signal) => {
    logStream.end();
    if (!isQuitting) {
      dialog.showErrorBox(
        "MTE Systems",
        `فشل تشغيل الخادم الداخلي (رمز الخروج: ${code ?? signal}).\n\nسجل الأخطاء: ${logPath}`
      );
      app.quit();
    }
  });

  return child;
}

function waitForHealth(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          clearInterval(timer);
          res.resume();
          resolve();
        } else {
          res.resume();
        }
      });
      req.on("error", () => {});
      req.setTimeout(2000, () => req.destroy());
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Server did not become healthy within ${timeoutMs}ms`));
      }
    }, 500);
  });
}

// Is the thing on this port OUR already-healthy backend (e.g. orphaned by a
// force-killed previous run)? If yes, attach a window to it instead of
// spawning a second server (which would die on EADDRINUSE).
async function healthyOwnServer(port) {
  try {
    const body = await new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      });
      req.on("error", () => resolve(null));
      req.setTimeout(3000, () => {
        try {
          req.destroy();
        } catch {}
        resolve(null);
      });
    });
    return !!(body && body.app === "mte-systems" && body.status === "success");
  } catch {
    return false;
  }
}

// Immediate splash so a slow cold boot (mongod + replica election + server)
// never looks like a hang. Shown before any heavy work.
// ---- Orphan cleanup (PIDs of OUR processes from the previous run) ----
function pidFilePath() {
  try {
    return path.join(userDataDir, "app.pids.json");
  } catch {
    return null;
  }
}

function writePidFile() {
  try {
    const p = pidFilePath();
    if (!p) return;
    fs.writeFileSync(
      p,
      JSON.stringify(
        {
          serverPid: serverProcess && !serverProcess.killed ? serverProcess.pid : null,
          mongoPid: mongoProcess && mongoProcess.exitCode === null ? mongoProcess.pid : null,
          backendPort: localBackendPort || null,
          mongoPort: activeMongoPort,
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf8"
    );
  } catch {}
}

function clearPidFile() {
  try {
    const p = pidFilePath();
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

function processAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function processCommandLine(pid) {
  try {
    const { execFile } = await import("child_process");
    const out = await new Promise((res) =>
      execFile(
        "powershell.exe",
        ["-NoProfile", "-Command", `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}').CommandLine`],
        { windowsHide: true, timeout: 10000 },
        (_e, stdout) => res(String(stdout || ""))
      )
    );
    return out;
  } catch {
    return "";
  }
}

// Kill OUR orphaned backend (force-killed previous run) so its port frees up.
// Verifies identity via command line first — NEVER touches foreign processes.
// Returns true if the port is free afterwards.
async function killOwnOrphanServer(port, serverDir) {
  try {
    const p = pidFilePath();
    if (!p || !fs.existsSync(p)) return false;
    let info = null;
    try {
      info = JSON.parse(fs.readFileSync(p, "utf8") || "{}");
    } catch {
      return false;
    }
    const pid = info && info.serverPid;
    if (!pid || !processAlive(pid)) return false;
    const norm = (s) => String(s || "").toLowerCase().replace(/\//g, "\\");
    const cmd = await processCommandLine(pid);
    if (!cmd || !(norm(cmd).includes("server.js") && norm(cmd).includes(norm(serverDir)))) {
      mongoLogLine(`port ${port} occupant PID ${pid} is not our server - leaving it alone`);
      return false;
    }
    mongoLogLine(`stopping our orphaned server (PID ${pid}) to free port ${port}...`);
    try {
      process.kill(pid);
    } catch {}
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (!(await probePort(port, 500))) {
        mongoLogLine(`port ${port} freed`);
        return true;
      }
    }
    mongoLogLine(`port ${port} still busy after stopping orphan`);
    return !(await probePort(port, 1000));
  } catch (e) {
    mongoLogLine(`orphan cleanup failed: ${e.message}`);
    return false;
  }
}

function showSplash() {
  try {
    if (splashWindow && !splashWindow.isDestroyed()) return;
    splashWindow = new BrowserWindow({
      width: 400,
      height: 210,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      center: true,
      backgroundColor: "#1e1e2e",
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
      body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1e1e2e;color:#fff;font-family:Segoe UI,Tahoma,sans-serif}
      .t{font-size:20px;font-weight:bold;margin-bottom:6px}
      .s{font-size:13px;color:#c4b5fd;min-height:20px}
      .spin{width:34px;height:34px;border:4px solid #4c1d95;border-top-color:#fb923c;border-radius:50%;animation:sp 1s linear infinite;margin-bottom:14px}
      @keyframes sp{to{transform:rotate(360deg)}}
    </style></head><body><div class="spin"></div><div class="t">MTE Systems</div><div class="s" id="st">...</div></body></html>`;
    splashWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    splashWindow.on("closed", () => {
      splashWindow = null;
    });
  } catch {}
}

function setSplashStatus(text) {
  try {
    if (splashWindow && !splashWindow.isDestroyed() && splashWindow.webContents) {
      splashWindow.webContents.executeJavaScript(
        `document.getElementById("st").textContent=${JSON.stringify(String(text))};`
      ).catch(() => {});
    }
  } catch {}
}

function closeSplash() {
  try {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  } catch {}
  splashWindow = null;
}

// ---- Bundled MongoDB runtime ----
// The installer ships a portable mongod (prepared/mongo/bin). On startup we
// make sure MongoDB is listening on 27017 as a replica set named rs0, then
// the backend connects via MONGODB_LOCAL_URI. Without a bundled mongod we
// fall back to a system MongoDB (previous behaviour).

function probePort(port, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const sock = net.connect({ host: "127.0.0.1", port });
      sock.on("connect", () => {
        sock.destroy();
        clearInterval(timer);
        resolve(true);
      });
      sock.on("error", () => sock.destroy());
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 250);
  });
}

function mongoLogLine(msg) {
  try {
    fs.appendFileSync(logPath, `[mongo] ${msg}\n`);
  } catch (err) {}
}

async function ensureReplicaSet() {
  // The mongodb driver is bundled with the backend (mongoose dependency; on
  // npm >= 8 it lands in node_modules/mongoose/node_modules/mongodb).
  const serverModules = app.isPackaged
    ? path.join(process.resourcesPath, "app", "prepared", "server", "node_modules")
    : path.resolve(__dirname, "..", "prepared", "server", "node_modules");
  const driverPath = [
    path.join(serverModules, "mongodb"),
    path.join(serverModules, "mongoose", "node_modules", "mongodb"),
  ].find((p) => fs.existsSync(p));
  if (!driverPath) {
    mongoLogLine("mongodb driver not found - cannot ensure replica set");
    return;
  }
  const { MongoClient } = require(driverPath);
  const client = new MongoClient(`mongodb://127.0.0.1:${activeMongoPort}/?directConnection=true`, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  try {
    await client.connect();
    let initiated = false;
    try {
      const status = await client.db("admin").command({ replSetGetStatus: 1 });
      mongoLogLine(`replica set OK: ${status.set} (primary=${status.myState === 1})`);
      initiated = true;
    } catch (err) {
      // Slow first boots (HDD/Defender scan) need retries — never fail silently.
      for (let attempt = 1; attempt <= 3 && !initiated; attempt++) {
        mongoLogLine(`replica set not initialized - initiating (attempt ${attempt}/3) ...`);
        try {
          await client.db("admin").command({
            replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: `127.0.0.1:${activeMongoPort}` }] },
          });
          mongoLogLine("replSetInitiate executed");
          initiated = true;
        } catch (err2) {
          mongoLogLine(`replSetInitiate attempt ${attempt} failed (non-fatal): ${err2.message}`);
          if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
    // Wait for the primary election so the backend's replicaSet=rs0
    // connection succeeds on the very first boot.
    if (initiated) {
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        try {
          const status = await client.db("admin").command({ replSetGetStatus: 1 });
          if (status.myState === 1) {
            mongoLogLine("primary elected");
            break;
          }
        } catch (err) {}
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } catch (err) {
    mongoLogLine(`mongo connect failed: ${err.message}`);
  } finally {
    try {
      await client.close();
    } catch (err) {}
  }
}

// Effective local Mongo port for this run. Auto-switches to 27018 when 27017
// is held by a foreign (non-rs0) mongod, so the app boots with zero user steps.
let activeMongoPort = 27017;
// In-memory handle on the loaded config (kept in sync when we auto-switch ports).
let appConfig = null;
// Set when the user cancels boot from a prompt (foreign-port dialog).
let bootCancelled = false;

// Frees a local TCP port by stopping its LISTENING owners.
// ONLY called after the user's explicit approval in a dialog — never automatic.
async function freeLocalPort(port) {
  try {
    const { execFile } = await import("child_process");
    const run = (file, args) =>
      new Promise((res) =>
        execFile(file, args, { windowsHide: true, timeout: 10000 }, (_err, stdout) =>
          res(String(stdout || ""))
        )
      );
    const out = await run("netstat", ["-ano"]);
    const pids = new Set();
    const re = new RegExp(`TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, "gi");
    let m;
    while ((m = re.exec(out))) {
      const pid = parseInt(m[1], 10);
      if (pid && pid !== process.pid) pids.add(pid);
    }
    try {
      if (mongoProcess && mongoProcess.pid) pids.delete(mongoProcess.pid);
    } catch {}
    if (pids.size === 0) {
      mongoLogLine(`free port ${port}: no LISTENING owner found (already free or TIME_WAIT)`);
      return !(await probePort(port, 3000));
    }
    for (const pid of pids) {
      mongoLogLine(`freeing port ${port}: stopping PID ${pid} (user approved)`);
      await run("taskkill", ["/F", "/PID", String(pid)]);
    }
    await new Promise((r) => setTimeout(r, 1500));
    const free = !(await probePort(port, 3000));
    mongoLogLine(free ? `port ${port} is now free` : `port ${port} still busy after kill attempt`);
    return free;
  } catch (e) {
    mongoLogLine(`free port ${port} failed: ${e.message}`);
    return false;
  }
}

// Asks what to do when 27017 is held by a foreign MongoDB.
// Returns 'auto27018' | 'free27017' | 'quit'. Remembers a checked choice.
async function askForeignPortChoice() {
  try {
    const remembered = appConfig && appConfig.mongoPortMode;
    if (remembered === "auto27018" || remembered === "free27017") {
      mongoLogLine(`foreign 27017 occupant: using remembered choice (${remembered})`);
      return remembered;
    }
  } catch {}
  try {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.setAlwaysOnTop(false);
  } catch {}
  let response = 0;
  let checkboxChecked = false;
  try {
    const r = await dialog.showMessageBox({
      type: "question",
      title: "MTE Systems",
      message: "منفذ قاعدة البيانات 27017 مشغول ببرنامج MongoDB آخر (ليس الخاص بنا).",
      detail:
        "الاختيار الآمن: المتابعة على 27018 مع نقل بياناتك تلقائياً.\n\n" +
        "أو: تحرير 27017 (إيقاف البرنامج الآخر) والمتابعة عليه.\n\n" +
        "يدوياً:\nnetstat -ano | findstr :27017\ntaskkill /F /PID <الرقم>",
      buttons: ["المتابعة على 27018 (موصى به)", "تحرير 27017 والمتابعة عليه", "إلغاء التشغيل"],
      defaultId: 0,
      cancelId: 2,
      checkboxLabel: "تذكر اختياري ولا تسألني مجدداً",
      checkboxChecked: false,
    });
    response = r.response;
    checkboxChecked = !!r.checkboxChecked;
  } catch {
    response = 0;
  }
  try {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.setAlwaysOnTop(true);
  } catch {}
  if (response === 2) return "quit";
  const mode = response === 1 ? "free27017" : "auto27018";
  if (checkboxChecked) {
    try {
      appConfig.mongoPortMode = mode;
      fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), "utf8");
      mongoLogLine(`remembered foreign-port choice: ${mode}`);
    } catch (e) {
      mongoLogLine(`could not persist port choice: ${e.message}`);
    }
  }
  return mode;
}

// Classify whoever owns a busy Mongo port:
//   'exact'   - our own dbpath serving rs0 (e.g. orphaned previous run) -> reuse
//   'shared'  - a different dbpath but healthy rs0 primary (e.g. system MongoDB
//               on a dev machine) -> reuse so the app and `npm run dev` see ONE database
//   'foreign' - anything else (no rs, wrong set, unreachable) -> run ours elsewhere
async function classifyMongoOccupant(port, ourDbPath) {
  const { MongoClient } = await loadMongoDriver();
  if (!MongoClient) return "foreign";
  const norm = (p) => String(p || "").toLowerCase().replace(/\//g, "\\");
  const client = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, {
    serverSelectionTimeoutMS: 3000,
    connectTimeoutMS: 3000,
  });
  try {
    await client.connect();
    const status = await client.db("admin").command({ replSetGetStatus: 1 }).catch(() => null);
    if (!status || status.set !== "rs0" || status.myState !== 1) return "foreign";
    try {
      const opts = await client.db("admin").command({ getCmdLineOpts: 1 });
      const dbPath = opts?.parsed?.storage?.dbPath || "";
      if (dbPath && ourDbPath && norm(dbPath) === norm(ourDbPath)) return "exact";
    } catch {}
    return "shared";
  } catch {
    return "foreign";
  } finally {
    try {
      await client.close();
    } catch {}
  }
}

async function occupantIsOurReplicaSet(port) {
  return (await classifyMongoOccupant(port)) !== "foreign";
}

async function loadMongoDriver() {
  try {
    const serverModules = app.isPackaged
      ? path.join(process.resourcesPath, "app", "prepared", "server", "node_modules")
      : path.resolve(__dirname, "..", "prepared", "server", "node_modules");
    const driverPath = [
      path.join(serverModules, "mongodb"),
      path.join(serverModules, "mongoose", "node_modules", "mongodb"),
    ].find((p) => fs.existsSync(p));
    if (!driverPath) return {};
    return require(driverPath);
  } catch {
    return {};
  }
}

async function ensureBundledMongo() {
  const mongodPath = app.isPackaged
    ? path.join(process.resourcesPath, "app", "prepared", "mongo", "bin", "mongod.exe")
    : path.resolve(__dirname, "..", "prepared", "mongo", "bin", "mongod.exe");
  if (!fs.existsSync(mongodPath)) {
    mongoLogLine("no bundled mongod - relying on system MongoDB");
    return;
  }
  const mongoDbPath = path.join(userDataDir, "mongo-data");
  if (await probePort(27017, 1500)) {
    const kind = await classifyMongoOccupant(27017, mongoDbPath);
    if (kind !== "foreign") {
      mongoLogLine(
        kind === "exact"
          ? "MongoDB already listening on 27017 (our data, rs0) - reusing it"
          : "MongoDB already listening on 27017 (healthy rs0 primary, shared system DB) - reusing it so app and dev see one database"
      );
      activeMongoPort = 27017;
      persistDatabaseUriForPort(27017);
      await ensureReplicaSet();
      return;
    }
    // Foreign mongod (e.g. a system MongoDB without rs0) owns 27017.
    // Ask once: auto-switch to 27018 (safe default), free 27017 with the
    // user's explicit approval, or cancel boot. Remembered when checked.
    const choice = await askForeignPortChoice();
    if (choice === "quit") {
      mongoLogLine("boot cancelled by user at foreign-port prompt");
      bootCancelled = true;
      return;
    }
    if (choice === "free27017") {
      setSplashStatus("تحرير منفذ قاعدة البيانات...");
      if (await freeLocalPort(27017)) {
        mongoLogLine("port 27017 freed by user choice - using it");
        activeMongoPort = 27017;
        persistDatabaseUriForPort(27017);
      } else {
        mongoLogLine("could not free 27017 - falling back to 27018");
        activeMongoPort = 27018;
        persistDatabaseUriForPort(27018);
      }
    } else {
      mongoLogLine("Port 27017 is held by a foreign MongoDB (not rs0) - switching bundled mongod to 27018 automatically");
      activeMongoPort = 27018;
      persistDatabaseUriForPort(27018);
    }
  }
  fs.mkdirSync(mongoDbPath, { recursive: true });
  const mongoLog = fs.openSync(path.join(userDataDir, "mongod.log"), "a");
  const child = spawn(
    mongodPath,
    ["--dbpath", mongoDbPath, "--port", String(activeMongoPort), "--bind_ip", "127.0.0.1", "--replSet", "rs0", "--quiet"],
    { stdio: ["ignore", mongoLog, mongoLog], windowsHide: true }
  );
  mongoProcess = child;
  child.on("exit", () => {
    if (mongoProcess === child) mongoProcess = null;
  });
  child.on("error", (err) => mongoLogLine(`mongod spawn error: ${err.message}`));
  child.on("exit", (code) => mongoLogLine(`mongod exited (code ${code})`));
  mongoLogLine(`starting bundled mongod (dbpath: ${mongoDbPath}, port: ${activeMongoPort}) ...`);
  const up = await probePort(activeMongoPort, 60000);
  if (!up) {
    mongoLogLine(`mongod did not open port ${activeMongoPort} within 60s`);
    return;
  }
  // Fresh spawn on our own port: make sure the backend URI points here
  // (converges back to 27017 if a previous boot had failed over to 27018).
  persistDatabaseUriForPort(activeMongoPort);
  // Emergency failover just happened: pull our data along so the user still
  // sees their bills (runs once — skipped whenever our DB already has data).
  if (activeMongoPort !== 27017) {
    try {
      const dbName = dbNameFromUri(appConfig && appConfig.databaseUri);
      await migrateForeignDbToBundled(27017, activeMongoPort, dbName);
    } catch (e) {
      mongoLogLine(`failover migration error (non-fatal): ${e.message}`);
    }
  }
  mongoLogLine("mongod is up - ensuring replica set");
  await ensureReplicaSet();
}

function dbNameFromUri(uri) {
  try {
    const m = String(uri || "").match(/^mongodb(?:\+srv)?:\/\/[^/]*\/([^?]*)/);
    const name = decodeURIComponent((m && m[1]) || "");
    return name || "bomba";
  } catch {
    return "bomba";
  }
}

// One-time emergency migration: copy db `bomba` from the foreign mongod
// (read-only) into our bundled DB, preserving _ids and indexes, so the user
// keeps seeing their data after a 27018 failover.
// Runs ONLY when our home DB is empty — never merges over existing data.
async function migrateForeignDbToBundled(sourcePort, targetPort, dbName) {
  const { MongoClient } = await loadMongoDriver();
  if (!MongoClient) {
    mongoLogLine("failover migration skipped: no mongo driver");
    return;
  }
  const opts = { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 };
  const src = new MongoClient(`mongodb://127.0.0.1:${sourcePort}/?directConnection=true`, opts);
  const dst = new MongoClient(`mongodb://127.0.0.1:${targetPort}/?directConnection=true`, opts);
  try {
    await src.connect();
    await dst.connect();
    const sdb = src.db(dbName);
    const ddb = dst.db(dbName);
    let homeDocs = 0;
    try {
      const homeCols = await ddb.listCollections().toArray();
      for (const c of homeCols) {
        if (!c || !c.name || c.name.startsWith("system.")) continue;
        try {
          homeDocs += await ddb.collection(c.name).estimatedDocumentCount();
        } catch {}
        if (homeDocs > 0) break;
      }
    } catch {}
    if (homeDocs > 0) {
      mongoLogLine("failover migration skipped: bundled DB already has data (keeping it, no merge)");
      return;
    }
    setSplashStatus("نقل بيانات...");
    let total = 0;
    let cols = [];
    try {
      cols = await sdb.listCollections().toArray();
    } catch (e) {
      mongoLogLine(`failover migration: cannot list source collections: ${e.message}`);
      return;
    }
    for (const c of cols) {
      const name = c && c.name;
      if (!name || name.startsWith("system.")) continue;
      let count = 0;
      try {
        count = await sdb.collection(name).estimatedDocumentCount();
      } catch {
        continue;
      }
      if (!count) continue;
      mongoLogLine(`migrating ${count} docs: ${dbName}.${name} (${sourcePort} -> bundled) ...`);
      try {
        const srcIdx = await sdb.collection(name).listIndexes().toArray().catch(() => []);
        for (const ix of srcIdx) {
          if (!ix || ix.name === "_id_" || !ix.key) continue;
          try {
            const ixOpts = {};
            if (ix.unique) ixOpts.unique = true;
            if (ix.sparse) ixOpts.sparse = true;
            if (ix.expireAfterSeconds !== undefined) ixOpts.expireAfterSeconds = ix.expireAfterSeconds;
            if (ix.partialFilterExpression) ixOpts.partialFilterExpression = ix.partialFilterExpression;
            await ddb.collection(name).createIndex(ix.key, ixOpts);
          } catch {}
        }
      } catch {}
      try {
        const cursor = sdb.collection(name).find({});
        let batch = [];
        const flush = async () => {
          if (!batch.length) return;
          try {
            const r = await ddb.collection(name).insertMany(batch, { ordered: false });
            total += r.insertedCount || 0;
          } catch (e) {
            mongoLogLine(`migration insert warning ${name}: ${String((e && e.message) || e).slice(0, 160)}`);
          }
          batch = [];
        };
        for await (const doc of cursor) {
          batch.push(doc);
          if (batch.length >= 1000) await flush();
        }
        await flush();
      } catch (e) {
        mongoLogLine(`migration read failed ${name} (non-fatal, continuing): ${e.message}`);
      }
    }
    mongoLogLine(`failover migration done: ${total} docs copied into bundled DB`);
  } catch (e) {
    mongoLogLine(`failover migration skipped/failed (non-fatal, booting anyway): ${e.message}`);
  } finally {
    try {
      await src.close();
    } catch {}
    try {
      await dst.close();
    } catch {}
  }
}

// Persist an auto-switched local Mongo port so the backend URI follows it
// on this boot and every boot after (zero user steps).
function persistDatabaseUriForPort(port) {
  try {
    let cfg = {};
    if (fs.existsSync(configPath)) {
      cfg = JSON.parse(fs.readFileSync(configPath, "utf8") || "{}");
    }
    const current = String(cfg.databaseUri || "mongodb://localhost:27017/bomba?replicaSet=rs0");
    const next = current.replace(/localhost:\d+/, `localhost:${port}`);
    if (next !== current) {
      cfg.databaseUri = next;
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf8");
    }
    // Keep the in-memory config used for this boot in sync as well.
    try {
      if (typeof appConfig === "object" && appConfig !== null) {
        appConfig.databaseUri = cfg.databaseUri || next;
      }
    } catch {}
    mongoLogLine(`local database URI now uses port ${port}`);
  } catch (err) {
    mongoLogLine(`could not persist databaseUri for port ${port}: ${err.message}`);
  }
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 850,
    minWidth: 1024,
    minHeight: 640,
    title: "MTE Systems",
    autoHideMenuBar: true,
    backgroundColor: "#1e1e2e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(url);
  void getAvailablePrinters().catch((error) => {
    console.warn("Printer list prewarm failed:", error.message);
  });
  // Pre-warm the silent print window + raw-print daemon while the user logs in,
  // so the first print/drawer click pays no init cost.
  setTimeout(() => {
    try { ensureSilentPrintWindow(80); } catch {}
    if (process.platform === "win32") startRawPrintDaemon().catch(() => {});
  }, 4000);

mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith(url) || targetUrl === "about:blank" || targetUrl === "") {
      return {
        action: "allow",
        // Popup windows (e.g. bill view) must get the preload too, otherwise
        // bombaDesktop is undefined and API calls fall back to localhost.
        // about:blank windows are used for printing - keep them white so the
        // receipt HTML (not the dark app UI) is what gets printed.
        overrideBrowserWindowOptions: {
          backgroundColor: "#ffffff",
          webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
          },
        },
      };
    }

    async function createPrintAgentWindow() {
      mainWindow = new BrowserWindow({
        show: false,
        skipTaskbar: true,
        webPreferences: {
          contextIsolation: true,
          sandbox: true,
          javascript: false,
        },
      });
      await mainWindow.loadURL("about:blank");
    }
    require("electron").shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (!isDev) app.quit();
  });

  // ---- IPC handlers for printing ----
  // The renderer performs the actual printing via its own utilities
  // (printBill / printOrder); these handlers only acknowledge the events.
  ipcMain.on('print-bill', (event, data) => {
    event.returnValue = true;
  });

  ipcMain.on('print-kitchen-order', (event, orderData) => {
    event.returnValue = true;
  });

  ipcMain.on('print-order', (event, orderData) => {
    event.returnValue = true;
  });

  ipcMain.on('print-preview', (event) => {
    // Show the native Electron print preview (not a browser popup)
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.print({ preview: true });
    }
  });

  // Direct print receipt HTML to the first available non-virtual printer.
  ipcMain.handle('direct-print', async (event, data = {}) => {
    let printWindow = null;
    try {
      if (!data.html || typeof data.html !== 'string') {
        return { success: false, message: 'Printable HTML is required' };
      }

      const printers = await getAvailablePrinters();
      const virtualPrinterNames = ['Microsoft Print to PDF', 'Microsoft XPS', 'OneNote', 'Fax', 'PDF24', 'Adobe PDF', 'Send To OneNote 2016', 'Microsoft Print to PDF'];
      const filteredPrinters = (printers || []).filter(printer =>
        !virtualPrinterNames.some(name => printer.name.toLowerCase().includes(name.toLowerCase()))
      );
      const availablePrinter = filteredPrinters[0] || (printers || [])[0];
      const printerName = data.printerName || availablePrinter?.name;
      if (!printerName) {
        return { success: false, message: 'No physical printer detected' };
      }

      const paperWidthMm = Math.max(58, Math.min(150, Number(data.paperWidthMm) || 80));
      const printCss = `
        <style id="bomba-fallback-print-layout">
          @page { size: ${paperWidthMm}mm auto; margin: 0 !important; }
          html, body {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            overflow: visible !important;
            direction: ltr !important;
          }
          body > * { direction: rtl !important; }
          body {
            width: 100% !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            direction: ltr !important;
          }
          body > * {
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            direction: rtl !important;
          }
          *, *::before, *::after {
            min-width: 0 !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }
          table, thead, tbody, tr, th, td, div, img {
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; }
          th, td {
            min-width: 0 !important;
            max-width: 100% !important;
            padding: 1mm 0.5mm !important;
            overflow: visible !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            white-space: normal !important;
          }
        </style>
      `;
      const printableHtml = /<\/head>/i.test(data.html)
        ? data.html.replace(/<\/head>/i, `${printCss}</head>`)
        : `${printCss}${data.html}`;

      // Use the exact same HTML/CSS as browser print, but hidden and silent:
      // this keeps the same receipt layout while avoiding the preview popup.
      printWindow = new BrowserWindow({
        show: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        useContentSize: true,
        width: Math.round(paperWidthMm * 3.78),
        height: 2400,
        backgroundColor: '#ffffff',
        webPreferences: {
          contextIsolation: true,
          sandbox: true,
          offscreen: false,
          javascript: true
        },
        parent: mainWindow || undefined
      });
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printableHtml)}`);
      const resources = await waitForPrintResources(printWindow);
      if (resources?.failedImages?.length) {
        return { success: false, message: "Print content contains images that failed to load", failedImages: resources.failedImages };
      }
      const widthMicrons = Math.round(paperWidthMm * 1000);
      const heightMicrons = Math.max(100000, Math.min(2000000, Math.round(
        (resources?.contentHeight || 2400) * 25400 / 96
      )));

      const printed = await new Promise((resolve) => {
        printWindow.webContents.print({
          silent: true,
          printBackground: true,
          deviceName: printerName,
          preview: false,
          margins: { marginType: 'none' },
          pageSize: { width: widthMicrons, height: heightMicrons },
          // Let the selected printer/driver provide its configured paper size.
        }, (success, failureReason) => resolve({ success, failureReason }));
      });

      if (!printed.success) {
        return { success: false, message: printed.failureReason || 'Electron print failed', printerName };
      }
      return { success: true, message: 'Printed successfully', printerName };
    } catch (error) {
      console.error('Direct print error:', error);
      return { success: false, message: error.message || 'Direct print error' };
    } finally {
      if (printWindow && !printWindow.isDestroyed()) printWindow.close();
    }
  });
}

// ---- App lifecycle ----

// Agent mode never takes the Electron single-instance lock: it must coexist
// with the main app (bridge exclusivity is enforced via port 9100 instead,
// so a boot-time agent can never block the main window from opening).
// Main mode keeps the lock so double-clicks focus instead of duplicating.
const gotLock = isPrintAgent ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else if (splashWindow && !splashWindow.isDestroyed()) {
      // Still booting (splash visible) — bring it forward instead of silence.
      splashWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try { showSplash(); setSplashStatus("جاري التحضير..."); } catch {}
    ensureDirs();

    // Zero-config LAN: silently open firewall for TCP 5000 + UDP 41234 so a
    // direct Ethernet cable just works (APIPA, no manual IP). Fire-and-forget.
    try {
      if (process.platform === "win32") {
        const { execFile: _execFile } = await import("child_process");
        const _run = (args) => new Promise((res) => _execFile("netsh", args, { windowsHide: true, timeout: 15000 }, () => res()));
        _run(["advfirewall", "firewall", "add", "rule", "name=MTE Systems LAN (TCP)", "dir=in", "action=allow", "protocol=TCP", "localport=5000", "profile=private,domain", "enable=yes"]).catch(() => {});
        _run(["advfirewall", "firewall", "add", "rule", "name=MTE Systems LAN Discovery (UDP)", "dir=in", "action=allow", "protocol=UDP", "localport=41234", "profile=private,domain", "enable=yes"]).catch(() => {});
      }
    } catch {}
    if (isPrintAgent) {
      // Boot-time agent: Mongo isn't up yet, so start/wait for it first
      // instead of erroring (then quit quietly if a bridge already runs).
      try { setSplashStatus("تشغيل قاعدة البيانات..."); } catch {}
      await ensureBundledMongo();
      if (bootCancelled) {
        try { closeSplash(); } catch {}
        app.quit();
        return;
      }
      try { setSplashStatus("انتظار جاهزية قاعدة البيانات..."); } catch {}
      await ensureReplicaSet();
      if (await probePort(9100, 1500)) {
        console.log("Print bridge already running elsewhere - agent exiting quietly");
        try { closeSplash(); } catch {}
        app.quit();
        return;
      }
      await createPrintAgentWindow();
      startLocalPrintServer();
      try { closeSplash(); } catch {}
      console.log("Bomba Print Agent listening on http://127.0.0.1:9100");
      return;
    }
    const { config, secrets } = loadOrCreateConfig();
    appConfig = config;
    const port = config.port || 5000;
    localBackendPort = port;
    // Print bridge: reuse the boot-time agent's bridge if it's already up,
    // otherwise run it in-process. Either way printing works from app start.
    if (await probePort(9100, 1500)) {
      console.log("Print bridge already running (agent) - reusing it");
    } else {
      startLocalPrintServer();
      console.log("Print bridge listening on http://127.0.0.1:9100 (in-process)");
    }
    // Pre-warm the persistent raw-print PowerShell so the FIRST drawer kick
    // is already fast (~100ms) instead of paying the C# compile cost on click.
    setTimeout(() => {
      if (process.platform === "win32") startRawPrintDaemon().catch(() => {});
    }, 4000);

    if (isDev) {
      // Dev mode: expects `npm run dev` (vite on :3000) already running
      const devUrl = "http://localhost:3000";
      try {
        await waitForHealth(devUrl, 30000);
        closeSplash();
        createWindow(devUrl);
      } catch (err) {
        dialog.showErrorBox(
          "MTE Systems (dev)",
          `Vite dev server غير شغال على ${devUrl}. شغّل أولاً من جذر المشروع: npm run dev\n\n${err.message}`
        );
        app.quit();
      }
      return;
    }

    const appDir = path.join(process.resourcesPath, "app");
    const serverDir = app.isPackaged
      ? path.join(appDir, "prepared", "server")
      : path.resolve(__dirname, "..", "prepared", "server");
    const distDir = app.isPackaged
      ? path.join(appDir, "prepared", "dist")
      : path.resolve(__dirname, "..", "prepared", "dist");

    if (!fs.existsSync(path.join(serverDir, "server.js"))) {
      dialog.showErrorBox("MTE Systems", `لم يتم العثور على الخادم في: ${serverDir}`);
      app.quit();
      return;
    }

    setSplashStatus("تشغيل قاعدة البيانات...");
    await ensureBundledMongo();
    if (bootCancelled) {
      try {
        closeSplash();
      } catch {}
      app.quit();
      return;
    }
    // Port busy? Either attach to our own healthy orphan, or clean up our
    // dead orphan so we can bind. A foreign occupant gets a clear dialog.
    let skipSpawn = false;
    if (await probePort(port, 1500)) {
      if (await healthyOwnServer(port)) {
        mongoLogLine(`backend already healthy on ${port} - attaching window instead of spawning`);
        skipSpawn = true;
      } else {
        setSplashStatus("تنظيف تشغيل سابق...");
        if (await killOwnOrphanServer(port, serverDir)) {
          mongoLogLine("orphan cleaned - proceeding to spawn fresh server");
        } else {
          closeSplash();
          dialog.showErrorBox(
            "MTE Systems",
            `المنفذ ${port} مشغول ببرنامج آخر (ليس الخادم الخاص بنا).\n\n` +
              `أغلق البرنامج الذي يستخدمه، أو اعرف رقمه بالأمر:\nnetstat -ano | findstr :${port}\n\n` +
              `السجل: ${logPath}`
          );
          app.quit();
          return;
        }
      }
    }
    if (!skipSpawn) {
      setSplashStatus("تشغيل الخادم الداخلي...");
      const env = buildServerEnv(config, secrets, distDir);
      serverProcess = spawnServer(serverDir, env);
      writePidFile();
    }

    try {
      setSplashStatus("انتظار جاهزية الخادم...");
      await waitForHealth(`http://127.0.0.1:${port}/health`, 90000);
        closeSplash();
        createWindow(`http://127.0.0.1:${port}`);
      } catch (err) {
        handleStartupError("MTE Systems — فشل الاتصال بالخادم الداخلي", `تأكد أن MongoDB شغال محليًا (mongod)\nالسجل: ${logPath}\n\n${err?.message || String(err)}`);
        return;
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    isQuitting = true;
    if (silentPrintWindow && !silentPrintWindow.isDestroyed()) {
      silentPrintWindow.close();
      silentPrintWindow = null;
    }
    if (localPrintServer) {
      localPrintServer.close();
      localPrintServer = null;
    }
    if (serverProcess && !serverProcess.killed) {
      try {
        serverProcess.kill();
      } catch (err) {
        console.error("Failed to stop server process:", err.message);
      }
    }
    // Don't orphan mongod: only kill if OUR child is still running
    // (exitCode null = alive; avoids killing a reused PID).
    try {
      if (mongoProcess && mongoProcess.exitCode === null && mongoProcess.signalCode === null) {
        mongoProcess.kill();
      }
    } catch (err) {
      console.error("Failed to stop mongod process:", err.message);
    }
    mongoProcess = null;
    clearPidFile();
  });
}
