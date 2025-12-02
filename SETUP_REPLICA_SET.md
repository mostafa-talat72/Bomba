# Setup MongoDB Replica Set for Bidirectional Sync

## المشكلة
Change Streams (المطلوبة للـ Bidirectional Sync) مش بتشتغل على standalone MongoDB.
محتاجين نحول Local MongoDB لـ Replica Set.

## الحل

### الخطوة 1: أوقف MongoDB
افتح Command Prompt **كـ Administrator** وشغل:
```cmd
net stop MongoDB
```

### الخطوة 2: عدل MongoDB Configuration

افتح ملف الـ configuration (عادة في):
```
C:\Program Files\MongoDB\Server\{version}\bin\mongod.cfg
```

أضف السطور دي:
```yaml
replication:
  replSetName: "rs0"
```

### الخطوة 3: شغل MongoDB تاني
```cmd
net start MongoDB
```

### الخطوة 4: Initialize Replica Set

افتح MongoDB Shell:
```cmd
mongosh
```

شغل الأمر ده:
```javascript
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "localhost:27017" }]
})
```

### الخطوة 5: تأكد إن Replica Set شغال
```javascript
rs.status()
```

لازم تشوف `"ok": 1` و `"stateStr": "PRIMARY"`

### الخطوة 6: فعل Bidirectional Sync

في `server/.env`:
```env
BIDIRECTIONAL_SYNC_ENABLED=true
```

### الخطوة 7: أعد تشغيل الـ Server

```bash
npm run server:dev
```

---

## البديل الأسهل (موصى به)

لو الـ setup ده معقد، استخدم **Atlas مباشرة**:

في `server/.env`:
```env
MONGODB_URI=mongodb+srv://Saa3d-DB:NrPd3ziWiiZUeumA@cluster0.kqay8.mongodb.net/bomba1?retryWrites=true&w=majority&appName=Cluster0
```

كده:
- ✅ مش محتاج Replica Set
- ✅ مش محتاج Bidirectional Sync
- ✅ كل الأجهزة متزامنة تلقائياً
- ✅ أبسط وأسرع

