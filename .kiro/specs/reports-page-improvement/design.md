# Design Document - تحسين صفحة التقارير

## Overview

تصميم شامل لتحسين صفحة التقارير في نظام Bomba، مع التركيز على الأداء، دقة البيانات، وتجربة المستخدم.

## Architecture

### المكونات الرئيسية

```
Reports Page
├── Filter Section (الفلاتر)
│   ├── Period Filter (فترات زمنية)
│   ├── Daily Filter (يوم محدد)
│   ├── Monthly Filter (شهري)
│   └── Yearly Filter (سنوي)
├── Statistics Cards (بطاقات الإحصائيات)
│   ├── Total Revenue
│   ├── Total Orders
│   ├── Average Order Value
│   └── Total Sessions
├── Revenue Breakdown (توزيع الإيرادات)
│   ├── PlayStation Revenue
│   ├── Computer Revenue
│   └── Cafe Revenue
├── Detailed Reports (تقارير تفصيلية)
│   ├── Top Products
│   ├── Sessions Analysis
│   ├── Financial Summary
│   └── Inventory Summary
└── Export Actions (إجراءات التصدير)
    ├── Export to Excel
    ├── Export to PDF
    └── Print
```

## Components and Interfaces

### 1. تحسين الأداء

#### استخدام React.memo و useMemo
```typescript
// Memoize expensive calculations
const basicStats = useMemo(() => calculateBasicStats(), [reports.sales]);
const revenueBreakdown = useMemo(() => calculateRevenueBreakdown(), [reports.sales]);

// Memoize components
const StatCard = React.memo(({ icon, title, value, color }) => {
  // Component implementation
});
```

#### Lazy Loading للبيانات
```typescript
// Load reports only when needed
const loadReports = useCallback(async () => {
  // Only fetch if data is stale or not available
  if (shouldRefreshData()) {
    await fetchReports();
  }
}, [dependencies]);
```

#### Debounce للفلاتر
```typescript
// Debounce filter changes to avoid excessive API calls
const debouncedLoadReports = useMemo(
  () => debounce(loadReports, 500),
  [loadReports]
);
```

### 2. تحسين البيانات

#### معالجة الأخطاء المحسنة
```typescript
interface ErrorState {
  sales: string | null;
  sessions: string | null;
  inventory: string | null;
  financial: string | null;
}

const [errors, setErrors] = useState<ErrorState>({
  sales: null,
  sessions: null,
  inventory: null,
  financial: null
});

// Handle partial failures
const loadReportsWithErrorHandling = async () => {
  const results = await Promise.allSettled([
    getSalesReport(filter),
    getSessionsReport(filter),
    getInventoryReport(),
    getFinancialReport(filter)
  ]);
  
  // Process results and set errors for failed requests
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      setErrors(prev => ({
        ...prev,
        [reportTypes[index]]: result.reason
      }));
    }
  });
};
```

#### تحويل الأرقام للعربية
```typescript
const toArabicNumbers = (num: number | string): string => {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (digit) => arabicNumbers[parseInt(digit)]);
};

const formatCurrency = (amount: number): string => {
  const formatted = new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
  return toArabicNumbers(formatted) + ' ج.م';
};
```

### 3. تحسين التصميم

#### نظام الألوان المحسن
```typescript
const colors = {
  primary: {
    light: 'bg-orange-100 text-orange-800',
    DEFAULT: 'bg-orange-600 text-white',
    dark: 'bg-orange-700 text-white'
  },
  success: {
    light: 'bg-green-100 text-green-800',
    DEFAULT: 'bg-green-600 text-white'
  },
  danger: {
    light: 'bg-red-100 text-red-800',
    DEFAULT: 'bg-red-600 text-white'
  },
  info: {
    light: 'bg-blue-100 text-blue-800',
    DEFAULT: 'bg-blue-600 text-white'
  }
};
```

#### Responsive Design
```typescript
// Mobile-first approach
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Statistics cards */}
</div>

// Adaptive filters
<div className="flex flex-col md:flex-row gap-4">
  {/* Filter controls */}
</div>
```

### 4. تحسين جلسات البلايستيشن

#### عرض بيانات مفصلة
```typescript
interface PlayStationStats {
  totalSessions: number;
  totalHours: number;
  totalRevenue: number;
  averageDuration: number;
  mostUsedDevice: string;
  deviceStats: Array<{
    deviceName: string;
    sessions: number;
    hours: number;
    revenue: number;
  }>;
}

const calculatePlayStationStats = (): PlayStationStats => {
  // Calculate detailed PlayStation statistics
  const sessionsData = reports.sessions as any;
  
  return {
    totalSessions: sessionsData?.totalSessions || 0,
    totalHours: sessionsData?.totalHours || 0,
    totalRevenue: sessionsData?.totalRevenue || 0,
    averageDuration: sessionsData?.avgSessionDuration || 0,
    mostUsedDevice: sessionsData?.mostUsedDevice || 'غير متوفر',
    deviceStats: sessionsData?.deviceStats || []
  };
};
```

## Data Models

### Report Filter
```typescript
interface ReportFilter {
  startDate: string;
  endDate: string;
  type?: 'period' | 'daily' | 'monthly' | 'yearly';
  period?: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear';
  customDay?: string;
  customMonth?: string;
  customYear?: string;
}
```

### Report Data
```typescript
interface SalesReport {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  revenueByType: {
    playstation: number;
    computer: number;
    cafe: number;
  };
}

interface SessionsReport {
  totalSessions: number;
  totalHours: number;
  totalRevenue: number;
  avgSessionDuration: number;
  mostUsedDevice: string;
  deviceStats: Array<{
    deviceName: string;
    sessions: number;
    hours: number;
    revenue: number;
  }>;
}

interface FinancialReport {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  totalTransactions: number;
}

interface InventoryReport {
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  lowStockItems: number;
}
```

## Error Handling

### استراتيجية معالجة الأخطاء
1. **Graceful Degradation**: عرض البيانات المتاحة حتى لو فشل جزء من التقارير
2. **Retry Mechanism**: إعادة المحاولة تلقائياً عند فشل الطلب
3. **User Feedback**: رسائل خطأ واضحة بالعربية
4. **Logging**: تسجيل الأخطاء للمطورين

```typescript
const ErrorDisplay = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-center gap-2 text-red-800 mb-2">
      <AlertCircle className="w-5 h-5" />
      <span className="font-medium">حدث خطأ</span>
    </div>
    <p className="text-sm text-red-700 mb-3">{error}</p>
    <button
      onClick={onRetry}
      className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
    >
      إعادة المحاولة
    </button>
  </div>
);
```

## Testing Strategy

### Unit Tests
- اختبار دوال الحسابات (calculateBasicStats, calculateRevenueBreakdown)
- اختبار تنسيق الأرقام (formatCurrency, toArabicNumbers)
- اختبار بناء الفلاتر (buildFilter)

### Integration Tests
- اختبار تحميل البيانات من API
- اختبار تغيير الفلاتر
- اختبار التصدير

### Performance Tests
- قياس وقت التحميل الأولي
- قياس وقت تحديث البيانات
- قياس استهلاك الذاكرة

## Implementation Notes

### الأولويات
1. **High Priority**: تحسين الأداء ومعالجة الأخطاء
2. **Medium Priority**: تحسين التصميم وتحويل الأرقام للعربية
3. **Low Priority**: إضافة ميزات جديدة

### التحديات المتوقعة
1. **حجم البيانات**: قد تكون البيانات كبيرة، يجب استخدام pagination
2. **التوافقية**: التأكد من عمل الصفحة على جميع المتصفحات
3. **الأداء**: تحسين الأداء مع كمية كبيرة من البيانات

### الحلول المقترحة
1. استخدام Virtual Scrolling للقوائم الطويلة
2. استخدام Service Workers للـ caching
3. استخدام Web Workers للحسابات الثقيلة
