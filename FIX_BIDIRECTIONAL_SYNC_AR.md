# إصلاح المزامنة ثنائية الاتجاه (Atlas → Local)

## الحالة الحالية

✅ **المزامنة اللحظية (Local → Atlas)**: تعمل بشكل مثالي!
❌ **المزامنة ثنائية الاتجاه (Atlas → Local)**: خطأ timeout

## المشكلة

```
MongoNetworkTimeoutError: connection 3 to 35.233.7.247:27017 timed out
```

يحدث هذا الخطأ عند محاولة إنشاء اتصال Change Stream مع MongoDB Atlas.

## الأسباب المحتملة

### 1. مشاكل الشبكة/Firewall
- **IP الخاص بـ Atlas محظور** بواسطة firewall أو مزود الإنترنت
- **المنفذ 27017 محظور** (المنفذ الافتراضي لـ MongoDB)
- **اتصال إنترنت بطيء** يسبب timeouts

### 2. مشاكل Atlas Cluster
- **الـ Cluster متوقف** أو نائم (free tier M0)
- **الـ Cluster تحت الصيانة**
- **الـ Cluster في منطقة بعيدة** (latency عالي)

### 3. إعدادات الاتصال
- **قيم timeout منخفضة جداً** لشبكتك
- **Connection pool ممتلئ**

## الحلول المطبقة

### 1. زيادة قيم Timeout ✅

**الملف**: `server/.env`

تم التغيير من:
```env
serverSelectionTimeoutMS=30000
socketTimeoutMS=45000
```

إلى:
```env
serverSelectionTimeoutMS=60000
socketTimeoutMS=120000
connectTimeoutMS=60000
```

### 2. زيادة إعدادات إعادة الاتصال ✅

تم التغيير من:
```env
CHANGE_STREAM_RECONNECT_INTERVAL=5000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=5
```

إلى:
```env
CHANGE_STREAM_RECONNECT_INTERVAL=10000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=10
```

### 3. تحسين Connection Pool ✅

تم التغيير من:
```env
maxPoolSize=5
minPoolSize=1
```

إلى:
```env
maxPoolSize=10
minPoolSize=2
```

## حلول إضافية للتجربة

### الحل 1: تحقق من حالة Atlas Cluster

1. اذهب إلى [MongoDB Atlas](https://cloud.mongodb.com/)
2. سجل الدخول إلى حسابك
3. تحقق من أن الـ cluster:
   - ✅ **يعمل** (حالة خضراء)
   - ❌ **متوقف** (يحتاج إلى استئناف)
   - ⚠️ **تحت الصيانة**

### الحل 2: إضافة IP الخاص بك إلى القائمة البيضاء في Atlas

1. اذهب إلى MongoDB Atlas → Network Access
2. اضغط "Add IP Address"
3. الخيارات:
   - **Add Current IP Address** (IP الحالي)
   - **Allow Access from Anywhere** (0.0.0.0/0) - للاختبار فقط!

### الحل 3: تحقق من إعدادات Firewall

**Windows Firewall:**
```powershell
# تحقق من أن المنفذ 27017 غير محظور
Test-NetConnection -ComputerName cluster0.yl9w7jv.mongodb.net -Port 27017
```

إذا كان محظوراً، أضف قاعدة firewall:
```powershell
New-NetFirewallRule -DisplayName "MongoDB Atlas" -Direction Outbound -LocalPort 27017 -Protocol TCP -Action Allow
```

### الحل 4: اختبر الاتصال مباشرة

شغّل ملف الاختبار:
```bash
node server/test-atlas-connection.js
```

سيخبرك إذا كان الاتصال يعمل أم لا ويعطيك حلول محددة.

### الحل 5: استخدم منطقة Atlas مختلفة

إذا كان الـ cluster في منطقة بعيدة (latency عالي):
1. أنشئ cluster جديد في منطقة أقرب
2. أو استخدم VPN لتقليل الـ latency

### الحل 6: ترقية Atlas Tier

الـ free tier (M0) له قيود:
- قد يتوقف بعد عدم النشاط
- Connection pool محدود
- لا يوجد ضمان للتشغيل المستمر

فكر في الترقية إلى M2 أو M10 للحصول على:
- ✅ Clusters تعمل دائماً
- ✅ أداء أفضل
- ✅ Change Streams أكثر موثوقية

## حل مؤقت

إذا لم تستطع إصلاح مشكلة الاتصال فوراً، يمكنك تعطيل المزامنة ثنائية الاتجاه:

**الملف**: `server/.env`
```env
BIDIRECTIONAL_SYNC_ENABLED=false
```

هذا سيؤدي إلى:
- ✅ الحفاظ على المزامنة اللحظية (Local → Atlas) تعمل
- ✅ إزالة أخطاء timeout من السجلات
- ❌ تعطيل مزامنة Atlas → Local

## الاختبار بعد التغييرات

### 1. أعد تشغيل السيرفر
```bash
cd server
npm run dev
```

### 2. راقب سجلات البدء

ابحث عن:
```
✅ Atlas Change Stream is available
✅ Atlas Change Listener initialized
✅ Change Stream: Connected
✅ Bidirectional sync initialized successfully
```

أو:
```
⚠️ Atlas connection not available yet
⚠️ Bidirectional sync not available
```

### 3. تحقق من مراقب حالة المزامنة

يجب أن يظهر:
```
🔄 Bidirectional Sync (Atlas → Local):
   Status: 🟢 Active
   Changes Received: X
```

بدلاً من:
```
🔄 Bidirectional Sync (Atlas → Local):
   Status: 🔴 Inactive
```

## المراقبة

### تحقق من حالة الاتصال

مراقب حالة المزامنة يظهر:
- **Local MongoDB**: حالة الاتصال
- **Atlas MongoDB**: حالة الاتصال
- **Bidirectional Sync**: نشط/غير نشط

### تحقق من السجلات

ابحث عن هذه الرسائل:
- ✅ `[AtlasChangeListener] Change Stream started successfully`
- ✅ `[AtlasChangeListener] Received insert on collection_name`
- ❌ `[AtlasChangeListener] Change Stream error`
- ⚠️ `[AtlasChangeListener] Reconnection attempt X/10`

## الملخص

### التغييرات المطبقة ✅
1. زيادة قيم timeout في Atlas URI
2. زيادة محاولات وفترة إعادة الاتصال
3. تحسين إعدادات connection pool

### الخطوات التالية
1. **أعد تشغيل السيرفر** وتحقق من اتصال المزامنة ثنائية الاتجاه
2. **إذا لا يزال فاشلاً**: شغّل `test-atlas-connection.js` للتشخيص
3. **تحقق من Atlas**: تأكد من أن الـ cluster يعمل والـ IP في القائمة البيضاء
4. **تحقق من Firewall**: تأكد من أن المنفذ 27017 غير محظور
5. **مؤقت**: عطّل المزامنة ثنائية الاتجاه إذا لم تكن حرجة

### ملاحظات مهمة
- المزامنة اللحظية (Local → Atlas) **تعمل بشكل مثالي** بغض النظر عن هذه المشكلة
- المزامنة ثنائية الاتجاه **اختيارية** - معظم التطبيقات تحتاج فقط مزامنة أحادية الاتجاه
- خطأ timeout **لا يؤثر** على وظيفة المزامنة الرئيسية

---

**آخر تحديث**: 2026-04-19
**الحالة**: ⚠️ استكشاف الأخطاء
