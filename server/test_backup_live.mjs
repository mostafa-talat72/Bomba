import mongoose from 'mongoose';
import fs from 'fs';
import zlib from 'zlib';
import { promisify } from 'util';
import { EJSON } from 'bson';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bomba?replicaSet=rs0';
await mongoose.connect(uri);

const testDir = 'C:\\Users\\mtala\\AppData\\Local\\Temp\\opencode\\backup-test';
const { createDatabaseBackup, listBackups, saveBackupDir } = await import('./utils/backup.js');

await saveBackupDir(testDir);
const t = Date.now();
const res = await createDatabaseBackup(testDir);
console.log('create:', Date.now() - t, 'ms', JSON.stringify({ success: res.success, file: res.fileName, docs: res.documents, collections: res.collections, size: res.size }));

const gunzipAsync = promisify(zlib.gunzip);
const dump = EJSON.parse((await gunzipAsync(fs.readFileSync(res.path))).toString('utf8'));
const db = mongoose.connection.db;
let ok = true;
for (const name of ['orders', 'bills', 'sessions', 'users', 'menuitems']) {
  const live = await db.collection(name).countDocuments();
  const inFile = (dump.collections[name] || []).length;
  if (live !== inFile) ok = false;
  console.log(`${name}: file=${inFile} live=${live} ${live === inFile ? 'OK' : 'MISMATCH'}`);
}
const o = (dump.collections.orders || []).find((x) => x.orderNumber);
console.log('sample orderNumber in file:', o?.orderNumber, '| _id type ok:', String(o?._id).length === 24);
console.log('ALL MATCH:', ok);
const list = await listBackups(testDir);
console.log('listed:', list.backups.length, list.backups[0]?.fileName, list.backups[0]?.format);

fs.rmSync(testDir, { recursive: true, force: true });
try { fs.unlinkSync('C:\\Users\\mtala\\AppData\\Local\\Temp\\opencode\\backup-test'); } catch {}
import path from 'path';
const dirFile = path.join(process.cwd(), 'data', 'backup-dir.json');
if (fs.existsSync(dirFile)) fs.unlinkSync(dirFile);
console.log('cleaned');
await mongoose.disconnect();
