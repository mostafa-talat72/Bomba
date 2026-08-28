/**
 * Bomba Desktop - prepare script
 * 1. Builds the frontend (vite build at project root)
 * 2. Copies dist/ + server/ into prepared/ (with dev deps pruned)
 * 3. Generates a safe production .env for the desktop bundle
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");
const desktopDir = path.resolve(__dirname, "..");
const prepared = path.join(desktopDir, "prepared");
const srcDist = path.join(root, "dist");
const srcServer = path.join(root, "server");

const EXCLUDED = [
  ".git",
  "node_modules",
  ".env",
  ".env.example",
  "backups",
  "data",
  "logs",
  "uploads",
  "temp",
  "public",
  "docs",
  "__tests__",
  "package-lock.json",
];

function log(msg) {
  console.log(`[prepare] ${msg}`);
}

function buildFrontend() {
  if (process.env.SKIP_BUILD === "1") {
    log("Skipping frontend build (SKIP_BUILD=1)");
    if (!fs.existsSync(srcDist)) {
      throw new Error(`dist not found at ${srcDist} - run build once first`);
    }
    return;
  }
  log("Building frontend (vite build)...");
  // Desktop build must NOT bake VITE_API_URL: the app resolves the API base
  // from its own origin (see src/utils/apiBase.ts)
  const buildEnv = { ...process.env };
  delete buildEnv.VITE_API_URL;
  execSync("npm run build", { cwd: root, stdio: "inherit", env: buildEnv });
}

function cleanPrepared() {
  if (fs.existsSync(prepared)) {
    fs.rmSync(prepared, { recursive: true, force: true });
  }
  fs.mkdirSync(prepared, { recursive: true });
}

function copyDist() {
  log("Copying dist/ ...");
  if (!fs.existsSync(srcDist)) {
    throw new Error(`dist not found at ${srcDist} - run the frontend build first`);
  }
  fs.cpSync(srcDist, path.join(prepared, "dist"), { recursive: true });
}

function copyServer() {
  log("Copying server/ (excluding node_modules, tests, docs, secrets)...");
  const dest = path.join(prepared, "server");
  fs.cpSync(srcServer, dest, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(srcServer, src);
      const parts = rel.split(path.sep);
      return !parts.some((p) => EXCLUDED.includes(p));
    },
  });

  // Runtime directories (multer etc. expect them relative to cwd)
  for (const dir of ["uploads", "temp", "public", "backups", "data"]) {
    fs.mkdirSync(path.join(dest, dir), { recursive: true });
  }
}

function pruneServerDeps() {
  log("Installing production dependencies into server bundle (from server/package.json)...");
  execSync("npm install --omit=dev", {
    cwd: path.join(prepared, "server"),
    stdio: "inherit",
  });
}

// Read a key from a dotenv-style file.
function readDotEnvKey(filePath, key) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const line = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#") && l.startsWith(key + "="));
    if (!line) return "";
    const value = line.slice(key.length + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }
    return value;
  } catch {
    return "";
  }
}

async function writeEnv() {
  log("Generating production .env ...");

  // Read the developer's email SMTP credentials from the source server/.env
  // so the desktop build can send emails too. We encrypt them before storing
  // (see server/utils/secret.js) so they are not readable directly from the
  // .env file in the bundle.
  let enc = null;
  try {
    enc = await import("../../server/utils/secret.js");
  } catch (e) {
    log("WARNING: could not load secret helper, email encryption disabled: " + e.message);
  }
  const srcEnv = path.join(srcServer, ".env");
  const srcHost = readDotEnvKey(srcEnv, "EMAIL_HOST");
  const srcPort = readDotEnvKey(srcEnv, "EMAIL_PORT");
  const srcUser = readDotEnvKey(srcEnv, "EMAIL_USER");
  const srcPass = readDotEnvKey(srcEnv, "EMAIL_PASS");
  const hasSrc = srcHost && srcUser && srcPass;

  let encHost = "";
  let encUser = "";
  let encPass = "";
  if (enc && srcHost && srcUser && srcPass) {
    encHost = enc.encryptSecret(srcHost);
    encUser = enc.encryptSecret(srcUser);
    encPass = enc.encryptSecret(srcPass);
    log("Email credentials found in source .env and encrypted for production");
  } else {
    log(
      hasSrc
        ? "WARNING: email credentials found but secret helper unavailable; storing plaintext"
        : "WARNING: email credentials not found in source .env; email disabled"
    );
  }

  const env = [
    "PORT=5000",
    "NODE_ENV=production",
    "MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0",
    "MONGODB_URI=mongodb://localhost:27017/bomba?replicaSet=rs0",
    "MONGODB_ATLAS_URI=",
    "SYNC_ENABLED=false",
    "BIDIRECTIONAL_SYNC_ENABLED=false",
    "INITIAL_SYNC_ENABLED=false",
    "SKIP_ATLAS_WHEN_OFFLINE=true",
    "JWT_SECRET=" + crypto.randomBytes(32).toString("hex"),
    "JWT_REFRESH_SECRET=" + crypto.randomBytes(32).toString("hex"),
    "JWT_EXPIRE=7d",
    "JWT_REFRESH_EXPIRE=30d",
    "FRONTEND_URL=http://127.0.0.1:5000",
    "APP_TIMEZONE=Africa/Cairo",
    "EMAIL_HOST=" + (encHost ? "" : srcHost),
    "EMAIL_PORT=" + (encHost ? "587" : srcPort || "587"),
    "EMAIL_USER=" + (encUser ? "" : srcUser),
    "EMAIL_PASS=" + (encPass ? "" : srcPass),
    "EMAIL_HOST_ENC=" + encHost,
    "EMAIL_USER_ENC=" + encUser,
    "EMAIL_PASS_ENC=" + encPass,
    "MAX_FILE_SIZE=5242880",
    "UPLOAD_PATH=uploads",
    "RATE_LIMIT_WINDOW=60000",
    "RATE_LIMIT_MAX=1000",
  ].join("\n");

  fs.writeFileSync(path.join(prepared, "server", ".env"), env, "utf8");
}

function copyShared() {
  log("Copying shared/ ...");
  const src = path.join(root, "shared");
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(prepared, "shared"), { recursive: true });
  } else {
    log("WARNING: shared/ not found at project root");
  }

  // shared/*.js is ESM. Without a package.json, older Node (Electron's
  // bundled version) treats it as CommonJS -> named imports break.
  fs.writeFileSync(
    path.join(prepared, "package.json"),
    JSON.stringify(
      { name: "bomba-prepared", private: true, type: "module" },
      null,
      2
    ),
    "utf8"
  );
}

const MONGO_ZIP = path.join(
  desktopDir,
  "build",
  "mongo",
  "mongodb-windows-x86_64-7.0.14.zip"
);
const MONGO_SHA = path.join(desktopDir, "build", "mongo", "mongodb-windows-x86_64-7.0.14.zip.sha256");
const MONGO_EXTRACT = path.join(desktopDir, "build", "mongo", "extracted");

// Copies a portable mongod into prepared/mongo/bin so the desktop app can
// start MongoDB itself (no system installation needed on the target machine).
function ensureBundledMongo() {
  log("Bundling portable MongoDB ...");
  if (!fs.existsSync(MONGO_ZIP)) {
    log("WARNING: MongoDB zip missing - target machines will need MongoDB installed manually");
    return;
  }
  if (fs.existsSync(MONGO_SHA)) {
    const expected = fs.readFileSync(MONGO_SHA, "utf8").trim().toUpperCase();
    const actual = crypto
      .createHash("sha256")
      .update(fs.readFileSync(MONGO_ZIP))
      .digest("hex")
      .toUpperCase();
    if (expected !== actual) {
      throw new Error(`MongoDB zip checksum mismatch (got ${actual})`);
    }
  }
  if (!fs.existsSync(path.join(MONGO_EXTRACT, "bin", "mongod.exe"))) {
    log("Extracting MongoDB (large archive, please wait)...");
    fs.mkdirSync(MONGO_EXTRACT, { recursive: true });
    execSync(`tar -xf "${MONGO_ZIP}" -C "${MONGO_EXTRACT}"`, { stdio: "inherit" });
  }
  const rootDir = fs
    .readdirSync(MONGO_EXTRACT)
    .find((d) => d.startsWith("mongodb-win32"));
  if (!rootDir) {
    throw new Error("MongoDB extraction produced no mongodb-win32* folder");
  }
  // Keep only what mongod needs at runtime (drop 1.5GB of .pdb debug symbols
  // and the unused mongos binaries). mongod.exe is self-contained; the VC++
  // redistributable ships as a fallback for machines without the runtime.
  fs.cpSync(
    path.join(MONGO_EXTRACT, rootDir, "bin"),
    path.join(prepared, "mongo", "bin"),
    {
      recursive: true,
      filter: (src) =>
        !fs.statSync(src).isFile() ||
        ["mongod.exe", "vc_redist.x64.exe"].includes(path.basename(src)),
    }
  );
  log(`Bundled MongoDB -> ${path.join(prepared, "mongo", "bin")}`);
}

async function main() {
  const t0 = Date.now();
  cleanPrepared();
  buildFrontend();
  copyDist();
  copyServer();
  copyShared();
  pruneServerDeps();
  await writeEnv();
  ensureBundledMongo();
  log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${prepared}`);
}

main().catch((err) => {
  console.error("[prepare] FAILED:", err);
  process.exit(1);
});