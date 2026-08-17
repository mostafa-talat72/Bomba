# Bomba Desktop

نسخة الديسكتوب من نظام Bomba — تغليف Electron للسيرفر + الواجهة في تطبيق واحد مستقل.

## البنية

```
desktop/
├── electron/
│   ├── main.js        # تشغيل السيرفر داخليًا + فتح النافذة
│   └── preload.js     # واجهة آمنة للـ renderer
├── scripts/
│   └── prepare.js     # بناء الواجهة + تجهيز نسخة السيرفر (prepared/)
├── config.json        # نموذج الإعدادات (التعديل الفعلي في %APPDATA%/Bomba/config.json)
└── prepared/          # ناتج التحضير (لا يُرفع على git)
```

## كيف يشتغل؟

1. `prep` يبني الواجهة (`vite build`) وينسخ `server/` مع `shared/` (مطلوبان معًا للسيرفر) بدون الـ devDependencies، ويولّد `.env` آمن
2. عند التشغيل، Electron يشغّل السيرفر كعملية فرعية (متصلة منذ البداية عبر `ELECTRON_RUN_AS_NODE`)
3. السيرفر يخدم الواجهة المبنية من `dist/` (SPA fallback) — الكل في `localhost:PORT`
4. نافذة التطبيق تفتح على `http://127.0.0.1:PORT`

## متطلبات الجهاز المستهدف

- **MongoDB محلي** شغال مع `replicaSet` (نفس إعدادات التطوير) — البيانات تفضل على جهاز المستخدم
- (اختياري) `mongodump` في الـ PATH للنسخ الاحتياطي التلقائي

## أوامر

| الأمر | الوصف |
|-------|-------|
| `npm run prep` | تحضير `prepared/` (بناء + نسخ + prune) |
| `npm run dev` | تشغيل التطوير — يتوقع `npm run dev` بالجذر شغال (vite على 3000)، بدون spawn سيرفر إضافي |
| `npm run start` | prepare + تشغيل النسخة المنتجة محليًا |
| `npm run pack` | prepare + عمل مجلد غير مُثبّت (افتح exe مباشرة) |
| `npm run dist` | prepare + عمل مثبّت NSIS في `release/` |

## الإعدادات (config.json) — `%APPDATA%/Bomba/config.json`

يتولّد تلقائيًا بأول تشغيل، ويمكن تعديله يدويًا:

| المفتاح | المعنى |
|---------|--------|
| `port` | منفذ السيرفر الداخلي (افتراضي 5000) |
| `databaseUri` | رابط قاعدة البيانات المحلية |
| `atlasUri` | رابط Atlas — لو فارغ، المزامنة معطلة |
| `syncEnabled` | تفعيل المزامنة السحابية (يشترط `atlasUri`) |
| `bidirectionalSync` | تفعيل المزامنة ثنائية الاتجاه |
| `timezone` | المنطقة الزمنية الافتراضية |
| `appUrl` | (مستقبلي) رابط البوابة الخلفية للتراخيص |

مفاتيح JWT السرية تتولّد مرة واحدة في `%APPDATA%/Bomba/secrets.json` وتتفضل على أي `.env`.

سجل السيرفر: `%APPDATA%/Bomba/server.log` — النسخ الاحتياطية: `%APPDATA%/Bomba/data/backups/`.

## ملاحظات

- `asar: false` حاليًا لضمان عمل عملية السيرفر الفرعية (أكبر حجمًا، أكثر موثوقية) — يمكن تحسينه لاحقًا
- `uploads/temp/public` داخل مجلد التثبيت — التثبيت عبر NSIS يكون per-user (`AppData\Local\Programs`) لضمان صلاحيات الكتابة