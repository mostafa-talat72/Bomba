import crypto from "crypto";

// AES-256-CBC secret encryption/decryption.
// The passphrase is embedded here so the production bundle can decrypt the
// email credentials at runtime without an external key. This is obfuscation,
// not true security (a determined user with the bundle can extract the key),
// but it prevents the credentials being readable directly from the .env file.
const PASSPHRASE = "MTE-Bomba-2026-SecretEmail#!";
const KEY = crypto.createHash("sha256").update(PASSPHRASE).digest();

export function encryptSecret(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", KEY, iv);
  const enc = Buffer.concat([
    cipher.update(String(text), "utf8"),
    cipher.final(),
  ]);
  return iv.toString("hex") + ":" + enc.toString("hex");
}

export function decryptSecret(payload) {
  if (!payload) return "";
  const [ivHex, ctHex] = String(payload).split(":");
  if (!ivHex || !ctHex) return payload;
  try {
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", KEY, iv);
    return Buffer.concat([
      decipher.update(Buffer.from(ctHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    return payload;
  }
}

// Reads an env value, giving priority to the encrypted form then falling back
// to the plaintext form (so development with a plaintext .env still works).
export function readEnvSecret(encKey, plainKey) {
  const fromEnc = process.env[encKey];
  if (fromEnc) {
    const decrypted = decryptSecret(fromEnc);
    if (decrypted) return decrypted;
  }
  return process.env[plainKey] || "";
}
