// تشفير كلمة مرور الإيميل محلياً: يقرأها من stdin (لا تظهر في سجل الأوامر)،
// يكتب EMAIL_PASS_ENC في server/.env ويفرّغ EMAIL_PASS العادية.
// الاستخدام (PowerShell داخل مجلد server):
//   $s = Read-Host 'الصق كلمة مرور التطبيق' -AsSecureString
//   $p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
//   $p | node scripts/set-email-pass-enc.mjs; Remove-Variable p,s
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encryptSecret } from "../utils/secret.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

let stdin = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) stdin += chunk;
const secret = stdin.replace(/[\r\n\s]+/g, "");
if (!secret) {
  console.error("لم يصل أي إدخال — أُلغي بدون تغيير.");
  process.exit(1);
}

const enc = encryptSecret(secret);
let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const lines = text.split("\n");
let hasEnc = false;
let hasPass = false;
const out = lines.map((line) => {
  if (/^\s*EMAIL_PASS_ENC\s*=/.test(line)) { hasEnc = true; return `EMAIL_PASS_ENC=${enc}`; }
  if (/^\s*EMAIL_PASS\s*=/.test(line)) { hasPass = true; return "EMAIL_PASS="; }
  return line;
});
if (!hasEnc) out.push(`EMAIL_PASS_ENC=${enc}`);
if (!hasPass) out.push("EMAIL_PASS=");
fs.writeFileSync(envPath, out.join("\n"));
console.log("تم: حُفظت مشفّرة في EMAIL_PASS_ENC وفُرّغت العادية. أعد تشغيل السيرفر.");
