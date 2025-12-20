# StatCardWithComparison Component

## Overview
مكون React لعرض بطاقة إحصائية مع مقارنة بالفترة السابقة. يعرض القيمة الحالية مع مؤشرات بصرية للزيادة أو النقصان مقارنة بالفترة السابقة.

## Location
`src/pages/Reports.tsx` (lines 473-540)

## Interface

### ComparisonData
```typescript
interface ComparisonData {
  current: number;        // القيمة الحالية
  previous: number;       // القيمة السابقة
  change: number;         // الفرق (current - previous)
  changePercent: number;  // النسبة المئوية للتغيير
}
```

### StatCardWithComparisonProps
```typescript
interface StatCardWithComparisonProps {
  icon: React.ComponentType<{ className?: string }>;  // أيقونة المكون
  title: string;                                      // عنوان البطاقة
  current: number;                                    // القيمة الحالية
  comparison?: ComparisonData | null;                 // بيانات المقارنة (اختياري)
  color: string;                                      // لون البطاقة (green, blue, purple, orange)
  formatValue?: (value: number) => string;            // دالة تنسيق القيمة (اختياري)
}
```

## Features

### 1. عرض القيمة الحالية
- عرض الأيقونة والعنوان
- عرض القيمة الحالية بخط كبير وواضح
- دعم تنسيق مخصص للقيمة

### 2. مؤشرات المقارنة
- **زيادة**: سهم للأعلى (↑) + أيقونة TrendingUp + لون أخضر
- **نقصان**: سهم للأسفل (↓) + أيقونة TrendingDown + لون أحمر
- **بدون تغيير**: يعتبر زيادة (change = 0)

### 3. عرض النسبة المئوية
- عرض النسبة المئوية للتغيير بدقة عشرية واحدة
- استخدام القيمة المطلقة (Math.abs) لعرض الرقم بدون إشارة

### 4. معالجة الحالات الخاصة
- عرض رسالة "لا توجد بيانات للمقارنة" عند عدم وجود بيانات
- عرض قيمة الفترة السابقة للمرجعية

## Usage Examples

### مثال 1: زيادة في الإيرادات
```typescript
const revenueComparison: ComparisonData = {
  current: 15000,
  previous: 12000,
  change: 3000,
  changePercent: 25
};

<StatCardWithComparison
  icon={DollarSign}
  title="إجمالي الإيرادات"
  current={15000}
  comparison={revenueComparison}
  color="green"
/>
```

### مثال 2: نقصان في الطلبات
```typescript
const ordersComparison: ComparisonData = {
  current: 85,
  previous: 120,
  change: -35,
  changePercent: -29.17
};

<StatCardWithComparison
  icon={ShoppingCart}
  title="عدد الطلبات"
  current={85}
  comparison={ordersComparison}
  color="blue"
  formatValue={(val) => formatDecimal(val)}
/>
```

### مثال 3: بدون بيانات مقارنة
```typescript
<StatCardWithComparison
  icon={DollarSign}
  title="متوسط الطلب"
  current={176.47}
  comparison={null}
  color="orange"
/>
```

## Visual Design

### Structure
```
┌─────────────────────────────────────┐
│ [Icon] Title                        │
│        Current Value                │
├─────────────────────────────────────┤
│ [↑/↓] [Trend] XX.X%                 │
│ مقارنة بالفترة السابقة              │
│ الفترة السابقة: Previous Value     │
└─────────────────────────────────────┘
```

### Colors
- **Green**: للزيادة (text-green-600 dark:text-green-400)
- **Red**: للنقصان (text-red-600 dark:text-red-400)
- **Gray**: للنصوص الثانوية (text-gray-500 dark:text-gray-400)

### Icons
- **ArrowUp**: سهم للأعلى (زيادة)
- **ArrowDown**: سهم للأسفل (نقصان)
- **TrendingUp**: اتجاه صاعد (زيادة)
- **TrendingDown**: اتجاه هابط (نقصان)

## Requirements Mapping

يحقق هذا المكون المتطلبات التالية من `requirements.md`:

- **5.1**: عرض نسبة التغيير (زيادة/نقصان) مقارنة بالفترة السابقة
- **5.2**: استخدام أيقونة سهم لأعلى (↑) للزيادة وسهم لأسفل (↓) للنقصان
- **5.3**: استخدام اللون الأخضر للزيادة والأحمر للنقصان
- **5.4**: عرض "لا توجد بيانات للمقارنة" عند عدم وجود بيانات
- **5.5**: حساب الفترة السابقة تلقائياً (يتم في Backend)

## Integration

### في صفحة التقارير
سيتم استخدام هذا المكون في صفحة التقارير الرئيسية لاستبدال `StatCard` الحالي:

```typescript
// Before
<StatCard
  icon={DollarSign}
  title="إجمالي الإيرادات"
  value={formatCurrency(basicStats.revenue)}
  color="green"
/>

// After
<StatCardWithComparison
  icon={DollarSign}
  title="إجمالي الإيرادات"
  current={basicStats.revenue}
  comparison={revenueComparison}
  color="green"
/>
```

### مع بيانات Backend
يتوقع المكون أن يتم حساب بيانات المقارنة في Backend:

```typescript
// Backend response structure
{
  current: {
    revenue: 15000,
    orders: 85,
    // ...
  },
  previous: {
    revenue: 12000,
    orders: 120,
    // ...
  },
  comparison: {
    revenue: {
      current: 15000,
      previous: 12000,
      change: 3000,
      changePercent: 25
    },
    orders: {
      current: 85,
      previous: 120,
      change: -35,
      changePercent: -29.17
    }
  }
}
```

## Demo Page
يمكن عرض المكون في صفحة العرض التوضيحي:
- **Path**: `/comparison-demo`
- **File**: `src/pages/ComparisonDemo.tsx`

## Testing
لاختبار المكون:
1. افتح صفحة العرض التوضيحي
2. تحقق من عرض الزيادة (سهم أخضر للأعلى)
3. تحقق من عرض النقصان (سهم أحمر للأسفل)
4. تحقق من عرض حالة "لا توجد بيانات"
5. تحقق من التنسيق المخصص للقيم

## Notes
- المكون يدعم الوضع الداكن (dark mode)
- المكون يستخدم RTL layout للعربية
- المكون responsive ويعمل على جميع أحجام الشاشات
- يمكن تخصيص دالة التنسيق لكل بطاقة
