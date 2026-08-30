import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const INSTANCE_ID_FILE = path.join(os.homedir(), 'AppData', 'Roaming', 'Bomba', 'instance-id.json');

let cached = null;

export async function getInstanceId() {
  if (cached) return cached;
  try {
    const data = await fs.readFile(INSTANCE_ID_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (parsed.instanceId) {
      cached = parsed.instanceId;
      return cached;
    }
  } catch (e) {
  }
  const instanceId = randomBytes(3).toString('hex').toUpperCase();
  await fs.mkdir(path.dirname(INSTANCE_ID_FILE), { recursive: true });
  await fs.writeFile(INSTANCE_ID_FILE, JSON.stringify({ instanceId, createdAt: new Date().toISOString() }));
  cached = instanceId;
  return cached;
}

export function getWebInstanceId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem('bomba_instance_id');
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(3)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    localStorage.setItem('bomba_instance_id', id);
  }
  return id;
}