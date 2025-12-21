# Dual MongoDB Sync System ✅

## 🎯 Overview

نظام مزامنة مزدوج متقدم يسمح لتطبيق Bomba بالعمل على MongoDB محلي للسرعة القصوى مع مزامنة تلقائية إلى MongoDB Atlas كنسخة احتياطية سحابية.

## 📊 Architecture

```
┌─────────────────┐
│ Bomba App       │
│ (Controllers)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Mongoose Models │
│ + Middleware    │
└────┬───────┬────┘
     │       │
     ▼       ▼
┌─────────┐ ┌──────────┐
│ Local   │ │ Sync     │
│ MongoDB │ │ Queue    │
└─────────┘ └────┬─────┘
     │           │
     │           ▼
     │      ┌──────────┐
     │      │ Worker   │
     │      └────┬─────┘
     │           │
     │           ▼
     │      ┌──────────┐
     │      │ Atlas    │
     │      └──────────┘
     │
     └──────────────────┐
                        │
                        ▼
                   ┌──────────┐
                   │ Monitor  │
                   └──────────┘
```

## 🔧 Components

### Core Services (في هذا المجلد)

#### 1. **syncQueueManager.js**
- إدارة قائمة انتظار العمليات
- حد أقصى: 10,000 عملية
- Persistence تلقائي على القرص
- إحصائيات مفصلة

**الوظائف الرئيسية:**
```javascript
syncQueueManager.enqueue(operation)  // إضافة عملية
syncQueueManager.dequeue()           // استخراج عملية
syncQueueManager.size()              // حجم القائمة
syncQueueManager.getStats()          // الإحصائيات
syncQueueManager.persistToDisk()     // حفظ على القرص
```

#### 2. **syncWorker.js**
- معالجة العمليات في الخلفية
- Retry مع exponential backoff
- تنفيذ Insert/Update/Delete

**الوظائف الرئيسية:**
```javascript
syncWorker.start()          // بدء المعالجة
syncWorker.stop()           // إيقاف المعالجة
syncWorker.pause()          // إيقاف مؤقت
syncWorker.resume()         // استئناف
syncWorker.getStats()       // الإحصائيات
syncWorker.checkHealth()    // فحص الصحة
```

#### 3. **syncMonitor.js**
- مراقبة الصحة والأداء
- تتبع النجاح/الفشل
- تحذيرات تلقائية

**الوظائف الرئيسية:**
```javascript
syncMonitor.recordSuccess(op, duration)  // تسجيل نجاح
syncMonitor.recordFailure(op, error)     // تسجيل فشل
syncMonitor.getMetrics()                 // الإحصائيات
syncMonitor.checkHealth()                // فحص الصحة
syncMonitor.generateReport()             // تقرير مفصل
```

### Configuration (في المجلد الأعلى)

#### **../config/syncConfig.js**
الإعدادات المركزية للنظام

#### **../config/dualDatabaseManager.js**
إدارة الاتصالين (Local + Atlas)

#### **../config/applySync.js**
تطبيق Middleware على جميع النماذج

### Middleware

#### **../../middleware/sync/syncMiddleware.js**
Mongoose hooks التي تعترض العمليات تلقائياً

## ⚙️ Configuration

### متغيرات البيئة الأساسية

```env
# تفعيل/تعطيل
SYNC_ENABLED=true

# الاتصالات
MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba
MONGODB_ATLAS_URI=mongodb+srv://...

# القائمة
SYNC_QUEUE_MAX_SIZE=10000
SYNC_WORKER_INTERVAL=100

# إعادة المحاولة
SYNC_MAX_RETRIES=5

# الحفظ
SYNC_PERSIST_QUEUE=true
SYNC_QUEUE_PATH=./data/sync-queue.json
```

## 🚀 Usage

### المزامنة التلقائية

لا تحتاج أي تعديل في الكود! المزامنة تحدث تلقائياً:

```javascript
// في أي controller
const bill = new Bill({ ... });
await bill.save();  // ✅ يُحفظ محلياً فوراً
                    // ✅ يُزامن إلى Atlas تلقائياً
```

### المراقبة

```bash
# فحص الصحة
GET /api/sync/health

# الإحصائيات
GET /api/sync/metrics

# تقرير مفصل
GET /api/sync/report
```

### التحكم

```bash
# إيقاف/تشغيل Worker
POST /api/sync/worker/control
Body: { "action": "start|stop|pause|resume" }

# مسح القائمة
POST /api/sync/queue/clear
```

## 🔍 Monitoring

### Metrics المتاحة

```javascript
{
  totalOperations: 1000,
  successfulSyncs: 995,
  failedSyncs: 5,
  queueSize: 10,
  avgSyncTime: 150,  // ms
  syncLag: 2000,     // ms
  workerStatus: {
    isRunning: true,
    successRate: "99.50%"
  }
}
```

### Health Status

```javascript
{
  status: "healthy",  // healthy | degraded | unhealthy
  checks: {
    localDatabase: { status: "pass" },
    atlasDatabase: { status: "pass" },
    worker: { status: "pass" },
    queueSize: { status: "pass", value: 10 },
    syncLag: { status: "pass" }
  },
  warnings: [],
  errors: []
}
```

## 🔧 Error Handling

### Local DB Failure
```
❌ CRITICAL - Application stops
```
**الحل:** تشغيل MongoDB المحلي

### Atlas Failure
```
⚠️ WARNING - Application continues
```
**النتيجة:** العمليات تُحفظ في القائمة

### Sync Failure
```
🔄 RETRY - Automatic with backoff
```
**الجدول:** 1s → 5s → 15s → 30s → 60s

### Queue Full
```
💾 PERSIST - Save to disk
```
**الموقع:** `./data/sync-queue.json`

## 🧪 Testing

### اختبار الاستيراد
```bash
node -e "import('./syncQueueManager.js').then(() => console.log('✅ OK'))"
```

### اختبار الوظائف
```javascript
import syncQueueManager from './syncQueueManager.js';

// إضافة عملية
syncQueueManager.enqueue({
  type: 'insert',
  collection: 'bills',
  data: { ... }
});

```

## 🐛 Troubleshooting

### المشكلة: المزامنة لا تعمل

**التحقق:**
```bash
# 1. هل المزامنة مفعلة؟
grep SYNC_ENABLED server/.env

# 2. هل Atlas متصل؟
curl http://localhost:5000/api/sync/health

# 3. هل Worker يعمل؟
curl http://localhost:5000/api/sync/worker
```

**الحلول:**
1. تأكد من `SYNC_ENABLED=true`
2. تحقق من `MONGODB_ATLAS_URI`
3. تحقق من IP whitelist في Atlas
4. راجع اللوجات

### المشكلة: القائمة تكبر

**الأعراض:**
```
⚠️ Sync queue size is large: 5000/10000
```

**الحلول:**
1. تحقق من اتصال Atlas
2. زد `SYNC_WORKER_INTERVAL`
3. راجع اللوجات للأخطاء
4. تحقق من أداء Atlas

### المشكلة: معدل فشل عالي

**الأعراض:**
```
⚠️ High sync failure rate: 15%
```

**الحلول:**
1. راجع اللوجات للأخطاء المحددة
2. تحقق من صحة البيانات
3. زد `SYNC_MAX_RETRIES`
4. تحقق من أداء Atlas

## 📚 Development

### إضافة نموذج جديد

لا تحتاج أي شيء! Middleware يُطبق تلقائياً:

```javascript
// في models/NewModel.js
import mongoose from 'mongoose';

const schema = new mongoose.Schema({ ... });
export default mongoose.model('NewModel', schema);

// ✅ المزامنة تعمل تلقائياً!
```

### استبعاد collection

في `.env`:
```env
SYNC_EXCLUDED_COLLECTIONS=logs,temp,cache
```

### تخصيص السلوك

في `syncConfig.js`:
```javascript
export default {
  enabled: true,
  queueMaxSize: 10000,
  workerInterval: 100,
  maxRetries: 5,
  // ... المزيد
};
```

## 📊 Performance

### المقاييس المتوقعة

| Metric | Value |
|--------|-------|
| Local Operation | < 5ms |
| Sync Time | 50-200ms |
| Queue Size | 0-100 |
| Success Rate | > 99% |
| Sync Lag | < 1s |

### التحسينات

1. **زيادة Worker Interval** للأحمال العالية
2. **استبعاد Collections** غير مهمة
3. **زيادة Queue Size** للذروات
4. **تحسين فهارس Atlas** للسرعة

## 🔐 Security

### ✅ مطبق
- بيانات الاعتماد في `.env` فقط
- لا بيانات حساسة في اللوجات
- TLS/SSL لـ Atlas
- API محمية بـ auth

### 🔒 أفضل الممارسات
1. لا تشارك `.env`
2. استخدم IP whitelist
3. دور بيانات الاعتماد
4. راقب اللوجات
5. استخدم HTTPS

## 📞 Support

### الموارد
- **دليل شامل:** `../../../DUAL_MONGODB_SYNC_COMPLETE.md`
- **بدء سريع:** `../../../QUICK_START_SYNC.md`
- **المواصفات:** `../../../.kiro/specs/dual-mongodb-sync/`

### اللوجات
```javascript
// تفعيل logging مفصل
process.env.NODE_ENV = 'development';

// عرض الحالة
syncMonitor.logStatus();

// عرض إحصائيات Worker
syncWorker.logStats();
```

## ✨ Summary

نظام مزامنة متقدم يجمع بين:
- ⚡ **السرعة:** عمليات محلية فورية
- 🔒 **الموثوقية:** نسخ احتياطي تلقائي
- 🎯 **الشفافية:** بدون تعديل كود
- 📊 **المراقبة:** إحصائيات شاملة

**الحالة:** ✅ جاهز للإنتاج
