# Logging Configuration

## Overview
يستخدم التطبيق نظام Logger مخصص لتسجيل الأحداث والأخطاء ومراقبة الأداء.

⚠️ **الإعدادات الحالية**:
- ✅ **ERROR logging**: مفعّل - يطبع الأخطاء الحرجة فقط
- ❌ **WARNING logging**: معطّل - لا يطبع التحذيرات
- ❌ **INFO logging**: معطّل - لا يطبع معلومات عامة
- ❌ **DEBUG logging**: معطّل - لا يطبع معلومات التصحيح
- ❌ **AUDIT logging**: معطّل - لا يطبع سجلات المراجعة
- ❌ **Performance logging**: معطّل - لا يطبع معلومات الأداء

## Log Levels

### ERROR
- يُطبع دائماً في جميع البيئات
- يستخدم لتسجيل الأخطاء الحرجة
```javascript
Logger.error('Error message', { error: err.message, stack: err.stack });
```

### WARN
- يُطبع دائماً في جميع البيئات
- يستخدم للتحذيرات
```javascript
Logger.warn('Warning message', { details: 'some details' });
```

### INFO
- يُطبع فقط في بيئة التطوير (NODE_ENV=development)
- يستخدم للمعلومات العامة
```javascript
Logger.info('Info message', { data: someData });
```

### DEBUG
- يُطبع فقط في بيئة التطوير (NODE_ENV=development)
- يستخدم للتصحيح
```javascript
Logger.debug('Debug message', { debugInfo: info });
```

## Performance Logging

### Database Query Performance
يسجل أداء استعلامات قاعدة البيانات:
```javascript
Logger.queryPerformance('/api/bills', executionTime, recordCount, {
    filters: {},
    page: 1,
    limit: 50
});
```

### API Performance
يسجل أداء API endpoints:
```javascript
Logger.apiPerformance('GET', '/api/orders', 200, duration, responseSize, compressed);
```

## Environment Variables

### NODE_ENV
- `development`: يُفعّل INFO و DEBUG logging
- `production`: يُعطّل INFO و DEBUG logging (فقط ERROR و WARN)

### ENABLE_PERFORMANCE_LOGGING
- `true`: يُفعّل performance logging في جميع البيئات
- `false`: يُعطّل performance logging في جميع البيئات
- غير محدد: يُفعّل فقط في development

## Configuration Examples

### Development (with performance logging)
```env
NODE_ENV=development
ENABLE_PERFORMANCE_LOGGING=true
```

### Development (without performance logging)
```env
NODE_ENV=development
ENABLE_PERFORMANCE_LOGGING=false
```

### Production (errors only)
```env
NODE_ENV=production
ENABLE_PERFORMANCE_LOGGING=false
```

### Production (with performance monitoring)
```env
NODE_ENV=production
ENABLE_PERFORMANCE_LOGGING=true
```

## Disabling Performance Logging

إذا كنت تريد إيقاف رسائل performance logging:

1. افتح ملف `server/.env`
2. أضف أو عدّل السطر:
   ```env
   ENABLE_PERFORMANCE_LOGGING=false
   ```
3. أعد تشغيل السيرفر

## Output Format

جميع الرسائل تُطبع بصيغة JSON:
```json
{
  "timestamp": "2025-11-16T23:29:32.358Z",
  "level": "INFO",
  "message": "Database Query Performance",
  "type": "performance",
  "endpoint": "/api/bills",
  "executionTime": "1139ms",
  "recordCount": 11
}
```

## Best Practices

1. ✅ استخدم ERROR للأخطاء الحرجة فقط
2. ✅ استخدم WARN للتحذيرات المهمة
3. ✅ استخدم INFO للمعلومات العامة في التطوير
4. ✅ استخدم DEBUG للتصحيح المؤقت
5. ❌ لا تستخدم console.log مباشرة - استخدم Logger
6. ✅ عطّل performance logging في الإنتاج إذا لم تكن بحاجة إليه

## Performance Impact

- **ERROR/WARN**: تأثير ضئيل جداً
- **INFO/DEBUG**: تأثير متوسط في development
- **Performance Logging**: تأثير ملحوظ إذا كان مفعّلاً

لذلك يُنصح بتعطيل performance logging في الإنتاج إلا إذا كنت تحتاج لمراقبة الأداء.
