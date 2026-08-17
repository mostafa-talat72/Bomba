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

function writeEnv() {
  log("Generating production .env ...");
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
    "EMAIL_HOST=",
    "EMAIL_PORT=587",
    "EMAIL_USER=",
    "EMAIL_PASS=",
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

function main() {
  const t0 = Date.now();
  cleanPrepared();
  buildFrontend();
  copyDist();
  copyServer();
  copyShared();
  pruneServerDeps();
  writeEnv();
  log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${prepared}`);
}

main();