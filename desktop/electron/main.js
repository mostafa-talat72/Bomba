const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
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

// Keep userData at a stable location across branding changes so all
// existing data (config, secrets, uploads, backups) is preserved.
app.setPath("userData", path.join(app.getPath("appData"), "bomba-desktop"));

let serverProcess = null;
let mainWindow = null;
let isQuitting = false;
let localPrintServer = null;
let localBackendPort = 5000;

// ---- Paths (userData pinned to bomba-desktop for data compatibility) ----
const userDataDir = app.getPath("userData");
const dataDir = path.join(userDataDir, "data");
const configPath = path.join(userDataDir, "config.json");
const logPath = path.join(userDataDir, "server.log");

async function waitForPrintResources(printWindow) {
  return printWindow.webContents.executeJavaScript(`
    (async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const images = Array.from(document.images);
      await Promise.all(images.map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          })));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        failedImages: images
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.src || image.alt || "unknown image"),
      };
    })();
  `, true);
}

async function sendWindowsRawCommand(printerName, bytes) {
  if (process.platform !== "win32") {
    return { success: false, message: "Raw printer commands are supported on Windows only" };
  }
  const tempPath = path.join(os.tmpdir(), `bomba-print-command-${Date.now()}-${crypto.randomUUID()}.bin`);
  try {
    fs.writeFileSync(tempPath, Buffer.from(bytes));
    const escapedPath = tempPath.replace(/'/g, "''");
    const escapedPrinter = String(printerName).replace(/'/g, "''");
    const script = `
$bytes = [System.IO.File]::ReadAllBytes('${escapedPath}')
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class BombaRawPrint {
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
  public static bool Send(string name, byte[] bytes) {
    IntPtr handle;
    if (!OpenPrinter(name, out handle, IntPtr.Zero)) return false;
    try {
      var info = new DocInfo { DocName = "Bomba printer command", DataType = "RAW" };
      if (StartDocPrinter(handle, 1, info) == 0 || !StartPagePrinter(handle)) return false;
      int written;
      var ok = WritePrinter(handle, bytes, bytes.Length, out written);
      EndPagePrinter(handle); EndDocPrinter(handle);
      return ok && written == bytes.Length;
    } finally { ClosePrinter(handle); }
  }
}
"@
if (-not [BombaRawPrint]::Send('${escapedPrinter}', $bytes)) { throw 'Raw printer command failed' }
`;
    const encodedScript = Buffer.from(script, "utf16le").toString("base64");
    await execPromise(`powershell -NoProfile -EncodedCommand ${encodedScript}`, { timeout: 10000 });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message || "Raw printer command failed" };
  } finally {
    try { fs.unlinkSync(tempPath); } catch {}
  }
}

async function sendPrinterPostCommands(printerName, { openDrawer = false, cutPaper = false } = {}) {
  const warnings = [];
  if (openDrawer) {
    const drawer = await sendWindowsRawCommand(printerName, [0x1b, 0x70, 0x00, 0x19, 0xfa]);
    if (!drawer.success) warnings.push(`Cash drawer: ${drawer.message}`);
  }
  if (cutPaper) {
    const cut = await sendWindowsRawCommand(printerName, [0x1d, 0x56, 0x00]);
    if (!cut.success) warnings.push(`Paper cut: ${cut.message}`);
  }
  return warnings;
}

async function printHtmlSilently(html, requestedPrinterName, paperWidthMm = 80) {
  let printWindow = null;
  try {
    const printers = await mainWindow?.webContents?.getPrintersAsync();
    const virtualPrinterNames = ["Microsoft Print to PDF", "Microsoft XPS", "OneNote", "Fax", "PDF24", "Adobe PDF", "Send To OneNote 2016"];
    const physicalPrinters = (printers || []).filter((printer) =>
      !virtualPrinterNames.some((name) => printer.name.toLowerCase().includes(name.toLowerCase()))
    );
    const selectedPrinter = requestedPrinterName
      ? (printers || []).find((printer) => printer.name === requestedPrinterName)
      : physicalPrinters[0];
    const printerName = selectedPrinter?.name;
    if (!printerName) return { success: false, message: "No configured printer found" };

    printWindow = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      useContentSize: true,
      // Keep the render viewport wide enough for common 58/76/80/90mm
      // profiles; the Windows printer profile controls the final paper width.
      width: Math.round(Math.max(58, Math.min(150, paperWidthMm)) * 3.78),
      height: 2400,
      backgroundColor: "#ffffff",
      webPreferences: { contextIsolation: true, sandbox: true, javascript: true },
      parent: mainWindow || undefined,
    });
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const resources = await waitForPrintResources(printWindow);
    if (resources?.failedImages?.length) {
      return { success: false, message: "Print content contains images that failed to load", failedImages: resources.failedImages };
    }
    const printed = await new Promise((resolve) => {
      printWindow.webContents.print({
        silent: true,
        preview: false,
        printBackground: true,
        deviceName: printerName,
        margins: { marginType: "none" },
      }, (success, failureReason) => resolve({ success, failureReason }));
    });
    return printed.success
      ? { success: true, printerName }
      : { success: false, message: printed.failureReason || "Print job failed", printerName };
  } finally {
    if (printWindow && !printWindow.isDestroyed()) printWindow.close();
  }
}

function startLocalPrintServer() {
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
    if (request.method !== "POST" || request.url !== "/print") {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ success: false, message: "Not found" }));
      return;
    }
    let body = "";
    let oversized = false;
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) oversized = true;
    });
    request.on("end", async () => {
      try {
        if (oversized) throw new Error("Printable content is too large");
        const payload = JSON.parse(body);
        if (typeof payload.html !== "string" || payload.html.length === 0) {
          throw new Error("Printable HTML is required");
        }
        const result = await printHtmlSilently(payload.html, payload.printerName, payload.paperWidthMm);
        if (result.success) {
          result.warnings = await sendPrinterPostCommands(result.printerName, payload);
        }
        response.writeHead(result.success ? 200 : 503, { "Content-Type": "application/json" });
        response.end(JSON.stringify(result));
      } catch (error) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ success: false, message: error.message }));
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
  };

  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
      console.error("Failed to read config.json, using defaults:", err.message);
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
    PORT: String(config.port || 5000),
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
  const client = new MongoClient("mongodb://127.0.0.1:27017/?directConnection=true", {
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
      mongoLogLine("replica set not initialized - initiating ...");
      try {
        await client.db("admin").command({
          replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] },
        });
        mongoLogLine("replSetInitiate executed");
        initiated = true;
      } catch (err2) {
        mongoLogLine(`replSetInitiate failed (non-fatal): ${err2.message}`);
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

async function ensureBundledMongo() {
  const mongodPath = app.isPackaged
    ? path.join(process.resourcesPath, "app", "prepared", "mongo", "bin", "mongod.exe")
    : path.resolve(__dirname, "..", "prepared", "mongo", "bin", "mongod.exe");
  if (!fs.existsSync(mongodPath)) {
    mongoLogLine("no bundled mongod - relying on system MongoDB");
    return;
  }
  if (await probePort(27017, 1500)) {
    mongoLogLine("MongoDB already listening on 27017");
    await ensureReplicaSet();
    return;
  }
  const mongoDbPath = path.join(userDataDir, "mongo-data");
  fs.mkdirSync(mongoDbPath, { recursive: true });
  const mongoLog = fs.openSync(path.join(userDataDir, "mongod.log"), "a");
  mongoLogLine(`starting bundled mongod (dbpath: ${mongoDbPath}) ...`);
  const child = spawn(
    mongodPath,
    ["--dbpath", mongoDbPath, "--port", "27017", "--bind_ip", "127.0.0.1", "--replSet", "rs0", "--quiet"],
    { stdio: ["ignore", mongoLog, mongoLog] }
  );
  child.on("error", (err) => mongoLogLine(`mongod spawn error: ${err.message}`));
  child.on("exit", (code) => mongoLogLine(`mongod exited (code ${code})`));
  const up = await probePort(27017, 60000);
  if (!up) {
    mongoLogLine("mongod did not open port 27017 within 60s");
    return;
  }
  mongoLogLine("mongod is up - ensuring replica set");
  await ensureReplicaSet();
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

      const printers = await mainWindow?.webContents?.getPrintersAsync();
      const virtualPrinterNames = ['Microsoft Print to PDF', 'Microsoft XPS', 'OneNote', 'Fax', 'PDF24', 'Adobe PDF', 'Send To OneNote 2016', 'Microsoft Print to PDF'];
      const filteredPrinters = (printers || []).filter(printer =>
        !virtualPrinterNames.some(name => printer.name.toLowerCase().includes(name.toLowerCase()))
      );
      const availablePrinter = filteredPrinters[0] || (printers || [])[0];
      const printerName = data.printerName || availablePrinter?.name;
      if (!printerName) {
        return { success: false, message: 'No physical printer detected' };
      }

      // Use the exact same HTML/CSS as browser print, but hidden and silent:
      // this keeps the same receipt layout while avoiding the preview popup.
      printWindow = new BrowserWindow({
        show: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        useContentSize: true,
        width: 480,
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
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(data.html)}`);
      const resources = await waitForPrintResources(printWindow);
      if (resources?.failedImages?.length) {
        return { success: false, message: "Print content contains images that failed to load", failedImages: resources.failedImages };
      }

      const printed = await new Promise((resolve) => {
        printWindow.webContents.print({
          silent: true,
          printBackground: true,
          deviceName: printerName,
          preview: false,
          margins: { marginType: 'none' },
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

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    ensureDirs();
    if (isPrintAgent) {
      await createPrintAgentWindow();
      startLocalPrintServer();
      console.log("Bomba Print Agent listening on http://127.0.0.1:9100");
      return;
    }
    const { config, secrets } = loadOrCreateConfig();
    const port = config.port || 5000;
    localBackendPort = port;
    startLocalPrintServer();

    if (isDev) {
      // Dev mode: expects `npm run dev` (vite on :3000) already running
      const devUrl = "http://localhost:3000";
      try {
        await waitForHealth(devUrl, 30000);
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

    await ensureBundledMongo();
    const env = buildServerEnv(config, secrets, distDir);
    serverProcess = spawnServer(serverDir, env);

    try {
      await waitForHealth(`http://127.0.0.1:${port}/health`, 90000);
        createWindow(`http://127.0.0.1:${port}`);
      } catch (err) {
        dialog.showErrorBox(
        "MTE Systems",
        `فشل الاتصال بالخادم الداخلي.\n\n1. تأكد أن MongoDB شغال محليًا (mongod)\n2. راجع السجل: ${logPath}\n\n${err.message}`
      );
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    isQuitting = true;
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
  });
}
