# استخدام العملة والمنطقة الزمنية في التطبيق

## نظرة عامة
تم إنشاء `OrganizationContext` لإدارة العملة والمنطقة الزمنية للمنشأة في كل التطبيق.

## استخدام العملة

### 1. استخدام Hook مباشرة
```typescript
import { useCurrency } from '../hooks/useCurrency';

function MyComponent() {
  const { formatCurrency, getCurrencySymbol, currency } = useCurrency();
  
  // تنسيق مبلغ
  const formatted = formatCurrency(1500); // "1,500.00 ج.م"
  
  // الحصول على رمز العملة فقط
  const symbol = getCurrencySymbol(); // "ج.م"
  
  // الحصول على كود العملة
  console.log(currency); // "EGP"
  
  return <div>{formatted}</div>;
}
```

### 2. استخدام Context مباشرة
```typescript
import { useOrganization } from '../context/OrganizationContext';

function MyComponent() {
  const { currency, formatCurrency } = useOrganization();
  
  return <div>{formatCurrency(1000)}</div>;
}
```

## استخدام المنطقة الزمنية

### 1. استخدام Hook
```typescript
import { useTimezone } from '../hooks/useTimezone';

function MyComponent() {
  const { timezone, formatInOrgTimezone, nowInOrgTimezone } = useTimezone();
  
  // تنسيق تاريخ حسب المنطقة الزمنية للمنشأة
  const formatted = formatInOrgTimezone(new Date(), 'YYYY-MM-DD HH:mm');
  
  // الحصول على الوقت الحالي في المنطقة الزمنية للمنشأة
  const now = nowInOrgTimezone();
  
  return <div>{formatted}</div>;
}
```

## تحديث الإعدادات

### من صفحة الإعدادات
عند حفظ بيانات المنشأة في صفحة Settings، يتم تحديث العملة والمنطقة الزمنية تلقائياً في:
1. قاعدة البيانات
2. localStorage
3. OrganizationContext

### عند تسجيل الدخول
يتم تحميل العملة والمنطقة الزمنية من قاعدة البيانات تلقائياً عند:
1. تسجيل الدخول
2. إعادة تحميل الصفحة
3. تحديث التوكن

## العملات المدعومة
- EGP (الجنيه المصري) - ج.م
- SAR (الريال السعودي) - ر.س
- AED (الدرهم الإماراتي) - د.إ
- USD (الدولار الأمريكي) - $
- EUR (اليورو) - €
- GBP (الجنيه الإسترليني) - £

## المناطق الزمنية المدعومة
- Africa/Cairo (القاهرة)
- Asia/Riyadh (الرياض)
- Asia/Dubai (دبي)

## أمثلة عملية

### عرض سعر منتج
```typescript
import { useCurrency } from '../hooks/useCurrency';

function ProductCard({ product }) {
  const { formatCurrency } = useCurrency();
  
  return (
    <div>
      <h3>{product.name}</h3>
      <p>{formatCurrency(product.price)}</p>
    </div>
  );
}
```

### عرض تاريخ ووقت
```typescript
import { useTimezone } from '../hooks/useTimezone';

function OrderCard({ order }) {
  const { formatInOrgTimezone } = useTimezone();
  
  return (
    <div>
      <h3>طلب #{order.orderNumber}</h3>
      <p>{formatInOrgTimezone(order.createdAt, 'DD/MM/YYYY HH:mm')}</p>
    </div>
  );
}
```

### تقرير مالي
```typescript
import { useCurrency } from '../hooks/useCurrency';
import { useTimezone } from '../hooks/useTimezone';

function FinancialReport({ data }) {
  const { formatCurrency } = useCurrency();
  const { formatInOrgTimezone } = useTimezone();
  
  return (
    <div>
      <h2>التقرير المالي</h2>
      <p>التاريخ: {formatInOrgTimezone(data.date, 'DD/MM/YYYY')}</p>
      <p>الإيرادات: {formatCurrency(data.revenue)}</p>
      <p>التكاليف: {formatCurrency(data.costs)}</p>
      <p>الربح: {formatCurrency(data.profit)}</p>
    </div>
  );
}
```
