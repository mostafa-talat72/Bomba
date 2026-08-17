const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");

// ============================================================
// MTE Systems Desktop - Electron wrapper
// Spawns the Express + MongoDB backend locally, then opens the
// built frontend in a BrowserWindow. Single instance per machine.
// ============================================================

const isDev = process.argv.includes("--dev");

// Keep userData at a stable location across branding changes so all
// existing data (config, secrets, uploads, backups) is preserved.
app.setPath("userData", path.join(app.getPath("appData"), "bomba-desktop"));

let serverProcess = null;
let mainWindow = null;
let isQuitting = false;

// ---- Paths (userData pinned to bomba-desktop for data compatibility) ----
const userDataDir = app.getPath("userData");
const dataDir = path.join(userDataDir, "data");
const configPath = path.join(userDataDir, "config.json");
const logPath = path.join(userDataDir, "server.log");

// ---- Helpers ----

function ensureDirs() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadOrCreateConfig() {
  const defaults = {
    port: 5000,
    databaseUri: "mongodb://localhost:27017/bomba?replicaSet=rs0",
    atlasUri: "mongodb+srv://Bomba:t1fp995Bde03vPQY@cluster0.yl9w7jv.mongodb.net/bomba1?retryWrites=true&w=majority&appName=Cluster0&serverSelectionTimeoutMS=60000&socketTimeoutMS=120000&connectTimeoutMS=60000&maxPoolSize=10&minPoolSize=2&maxIdleTimeMS=60000&heartbeatFrequencyMS=10000",
    syncEnabled: true,
    bidirectionalSync: true,
    timezone: "Africa/Cairo",
    appUrl: "",
    emailHost: "smtp.gmail.com",
    emailPort: 587,
    emailUser: "mr.robot192002@gmail.com",
    emailPass: "hzbadiidcvogmvhr",
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

  // Persistent JWT secrets (generated once, survive app updates)
  const secretsPath = path.join(userDataDir, "secrets.json");
  let secrets = {};
  if (fs.existsSync(secretsPath)) {
    try {
      secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    } catch (err) {
      console.error("Failed to read secrets.json:", err.message);
    }
  }
  if (!secrets.jwtSecret || !secrets.jwtRefreshSecret) {
    secrets.jwtSecret = crypto.randomBytes(32).toString("hex");
    secrets.jwtRefreshSecret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2), "utf8");
  }

  // Persist config back (so file exists for user edits)
  try {
    fs.writeFileSync(configPath, JSON.stringify(full, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write config.json:", err.message);
  }

  return { config: full, secrets };
}

function buildServerEnv(config, secrets, distDir) {
  const syncEnabled = config.syncEnabled === true && config.atlasUri;

  return {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(config.port || 5000),
    MONGODB_LOCAL_URI: config.databaseUri,
    MONGODB_URI: config.databaseUri,
    MONGODB_ATLAS_URI: config.atlasUri || "",
    SYNC_ENABLED: syncEnabled ? "true" : "false",
    BIDIRECTIONAL_SYNC_ENABLED:
      config.bidirectionalSync === true && syncEnabled ? "true" : "false",
    INITIAL_SYNC_ENABLED: syncEnabled ? "true" : "false",
    SKIP_ATLAS_WHEN_OFFLINE: "true",
    JWT_SECRET: secrets.jwtSecret,
    JWT_REFRESH_SECRET: secrets.jwtRefreshSecret,
    FRONTEND_URL: `http://127.0.0.1:${config.port || 5000}`,
    APP_TIMEZONE: config.timezone || "Africa/Cairo",
    EMAIL_HOST: config.emailHost || "smtp.gmail.com",
    EMAIL_PORT: String(config.emailPort || 587),
    EMAIL_USER: config.emailUser || "",
    EMAIL_PASS: config.emailPass || "",
    DESKTOP_DATA_DIR: dataDir,
    DESKTOP_BACKUP_DIR: path.join(dataDir, "backups"),
    DESKTOP_DIST_PATH: distDir,
    SYNC_QUEUE_PATH: path.join(dataDir, "sync-queue.json"),
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
    require("electron").shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (!isDev) app.quit();
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
    const { config, secrets } = loadOrCreateConfig();
    const port = config.port || 5000;

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
    if (serverProcess && !serverProcess.killed) {
      try {
        serverProcess.kill();
      } catch (err) {
        console.error("Failed to stop server process:", err.message);
      }
    }
  });
}

