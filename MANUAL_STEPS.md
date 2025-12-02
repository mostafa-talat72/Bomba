# ⚠️ خطوات يدوية مطلوبة

## المشكلة
MongoDB لم يتم تشغيله مع Replica Set enabled.

## الحل (5 دقائق)

### الخطوة 1: أوقف MongoDB

افتح **PowerShell كـ Administrator**:

```powershell
net stop MongoDB
```

---

### الخطوة 2: عدل mongod.cfg

1. افتح File Explorer
2. اذهب إلى: `C:\Program Files\MongoDB\Server\`
3. افتح المجلد (7.0 أو 8.0 أو 6.0)
4. افتح: `bin\mongod.cfg` بـ Notepad

**أضف في نهاية الملف:**

```yaml
replication:
  replSetName: "rs0"
```

**احفظ الملف** (Ctrl+S)

---

### الخطوة 3: شغل MongoDB

```powershell
net start MongoDB
```

---

### الخطوة 4: هيئ Replica Set

```bash
npm run init:replica
```

---

### الخطوة 5: تحقق

```bash
npm run check:replica
```

يجب أن ترى:
```
✅ SUCCESS! Your MongoDB is ready for bidirectional sync!
```

---

### الخطوة 6: شغل السيرفر

```bash
npm run server:dev
```

---

## ✅ بعد النجاح

ستحصل على:
- ✅ مزامنة ثنائية كاملة (Local ⇄ Atlas)
- ✅ دعم أجهزة متعددة
- ✅ حل تلقائي للتعارضات

---

**ابدأ من الخطوة 1!** 🚀
