/**
 * شفرة المسلسل: استبدال الأرقام 0-9 برموز يحددها المستخدم (حرف/رمز/رقم).
 * - كل قيمة خانة واحدة فقط (لإمكان فك التشفير العكسي عند حساب المسلسل الأقصى).
 * - القيم العشر فريدة إجباريًا (لا تكرار) + ممنوع '-' والمسافات (تكسر التحليل).
 * - تُطبق على جزء المسلسل فقط (NNN) — البادئة والتاريخ والمعرف تبقى مقروءة.
 */

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const FORBIDDEN = new Set(["-", " ", "\t", "\n", "\r", "/", "\\", "?", "#"]);

export function normalizeCipher(input) {
    if (input === undefined || input === null) return null; // غير مضبوطة = أرقام عادية
    if (typeof input !== "object" || Array.isArray(input)) {
        throw new Error("صيغة الشفرة غير صحيحة");
    }
    // جزئية مسموحة: الفارغ يبقى برقمه — لكن الفرادة على القيم الفعلية العشر
    const map = {};
    for (const d of DIGITS) {
        const v = input[d];
        if (v === undefined || v === null || v === "") {
            map[d] = d;
            continue;
        }
        if (typeof v !== "string" || v.length !== 1) {
            throw new Error(`الرقم ${d} يجب أن يستبدل بخانة واحدة`);
        }
        if (FORBIDDEN.has(v)) {
            throw new Error(`الرمز '${v}' ممنوع (يكسر التحليل)`);
        }
        map[d] = v;
    }
    const values = Object.values(map);
    if (new Set(values).size !== 10) {
        throw new Error("رموز الشفرة يجب أن تكون فريدة — ممنوع التكرار (بما فيها الأرقام الفارغة)");
    }
    // مطابقة تامة للأرقام = بلا شفرة فعلية
    if (DIGITS.every((d) => map[d] === d)) return null;
    return map;
}

export function applyCipher(seqStr, cipher) {
    const s = String(seqStr);
    if (!cipher) return s;
    return s
        .split("")
        .map((ch) => (cipher[ch] !== undefined ? cipher[ch] : ch))
        .join("");
}

// فك مسلسل مشفر إلى أرقام (أو null). يقبل أيضًا المسلسلات القديمة غير المشفرة.
export function decodeSerial(str, cipher) {
    const s = String(str || "");
    if (!cipher) {
        return /^\d+$/.test(s) ? s : null;
    }
    const rev = {};
    for (const [d, v] of Object.entries(cipher)) rev[v] = d;
    let out = "";
    for (const ch of s) {
        if (rev[ch] === undefined) {
            // قد يكون مسلسلًا قديمًا بأرقام عادية
            return /^\d+$/.test(s) ? s : null;
        }
        out += rev[ch];
    }
    return out;
}

export function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
