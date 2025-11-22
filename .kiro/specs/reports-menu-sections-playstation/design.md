# Design Document

## Overview

تصميم شامل لتحسين صفحة التقارير لتتعامل مع أقسام المنيو بشكل منفصل وإضافة تحليل مفصل لجلسات البلايستيشن والكمبيوتر. التصميم يركز على تحسين تجربة المستخدم وتوفير رؤى أعمق لأداء المنشأة.

## Architecture

### Current State Analysis

**الوضع الحالي:**
- صفحة التقارير تعرض "أكثر المنتجات مبيعاً" بدون تصنيف حسب أقسام المنيو
- قسم "تحليل الجلسات" يجمع بين البلايستيشن والكمبيوتر
- توزيع الإيرادات يعرض 3 بطاقات: بلايستيشن، كمبيوتر، كافيه
- لا يوجد مقارنة مع الفترة السابقة
- لا يوجد تحليل لساعات الذروة أو أداء الموظفين

**المشاكل:**
- صعوبة فهم أداء كل قسم منيو على حدة
- عدم وضوح الفرق بين أداء البلايستيشن والكمبيوتر
- عدم القدرة على تتبع النمو أو الانخفاض
- عدم معرفة ساعات الذروة لتخطيط الموارد

### Proposed Solution

**الحل المقترح:**
1. إعادة هيكلة قسم "أكثر المنتجات مبيعاً" ليعرض المنتجات مصنفة حسب أقسام المنيو
2. فصل "تحليل الجلسات" إلى قسمين: بلايستيشن وكمبيوتر
3. إضافة مقارنة مع الفترة السابقة لكل مؤشر
4. إضافة قسم جديد "ساعات الذروة"
5. إضافة قسم جديد "أداء الموظفين"
6. تحسين تصدير التقارير ليشمل البيانات الجديدة

## Components and Interfaces

### Frontend Components

#### 0. Date and Time Filter Component
**الموقع:** `src/pages/Reports.tsx`

**التصميم:**
```typescript
interface DateTimeFilterProps {
  startDate: Dayjs;
  endDate: Dayjs;
  startTime: Dayjs;
  endTime: Dayjs;
  onStartDateChange: (date: Dayjs | null) => void;
  onEndDateChange: (date: Dayjs | null) => void;
  onStartTimeChange: (time: Dayjs | null) => void;
  onEndTimeChange: (time: Dayjs | null) => void;
}

const DateTimeFilter = ({
  startDate,
  endDate,
  startTime,
  endTime,
  onStartDateChange,
  onEndDateChange,
  onStartTimeChange,
  onEndTimeChange
}: DateTimeFilterProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Start Date/Time */}
      <div className="space-y-3">
        <div className="flex items-center text-sm font-medium text-gray-700">
          <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
          <span>وقت البدء</span>
        </div>
        <div className="space-y-3">
          <DatePicker
            value={startDate}
            onChange={onStartDateChange}
            className="w-full"
            format="YYYY/MM/DD"
            allowClear={false}
            placeholder="تاريخ البدء"
            size="large"
          />
          <TimePicker
            value={startTime}
            onChange={onStartTimeChange}
            className="w-full"
            format="hh:mm A"
            minuteStep={15}
            placeholder="وقت البدء"
            size="large"
          />
        </div>
      </div>

      {/* End Date/Time */}
      <div className="space-y-3">
        <div className="flex items-center text-sm font-medium text-gray-700">
          <div className="w-2 h-2 bg-red-500 rounded-full ml-2"></div>
          <span>وقت الانتهاء</span>
        </div>
        <div className="space-y-3">
          <DatePicker
            value={endDate}
            onChange={onEndDateChange}
            className="w-full"
            format="YYYY/MM/DD"
            allowClear={false}
            placeholder="تاريخ الانتهاء"
            size="large"
          />
          <TimePicker
            value={endTime}
            onChange={onEndTimeChange}
            className="w-full"
            format="hh:mm A"
            minuteStep={15}
            placeholder="وقت الانتهاء"
            size="large"
          />
        </div>
      </div>

      {/* Selected Range Summary */}
      <div className="col-span-2 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col">
            <span className="text-sm text-blue-600 mb-1">من</span>
            <span className="font-medium text-gray-800">
              {startDate?.format('dddd، D MMMM YYYY [عند] hh:mm A')}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-blue-600 mb-1">إلى</span>
            <span className="font-medium text-gray-800">
              {endDate?.format('dddd، D MMMM YYYY [عند] hh:mm A')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**State Management:**
```typescript
// في مكون Reports الرئيسي
const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
  dayjs().set('hour', 0).set('minute', 0).set('second', 0),
  dayjs().set('hour', 23).set('minute', 59).set('second', 59)
]);

const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs]>([
  dayjs().set('hour', 0).set('minute', 0),
  dayjs().set('hour', 23).set('minute', 59)
]);

// دالة لتحديث التاريخ مع الحفاظ على الساعة
const handleDateChange = (date: Dayjs | null, type: 'start' | 'end') => {
  if (!date) return;

  if (type === 'start') {
    const startDate = date
      .set('hour', timeRange[0].hour())
      .set('minute', timeRange[0].minute())
      .set('second', 0);
    setDateRange([startDate, dateRange[1]]);
  } else {
    const endDate = date
      .set('hour', timeRange[1].hour())
      .set('minute', timeRange[1].minute())
      .set('second', 59);
    setDateRange([dateRange[0], endDate]);
  }
};

// دالة لتحديث الساعة مع الحفاظ على التاريخ
const handleTimeChange = (time: Dayjs | null, type: 'start' | 'end') => {
  if (!time) return;

  if (type === 'start') {
    const newStartTime = time;
    const newStartDate = dateRange[0]
      .set('hour', newStartTime.hour())
      .set('minute', newStartTime.minute());
    setTimeRange([newStartTime, timeRange[1]]);
    setDateRange([newStartDate, dateRange[1]]);
  } else {
    const newEndTime = time;
    const newEndDate = dateRange[1]
      .set('hour', newEndTime.hour())
      .set('minute', newEndTime.minute());
    setTimeRange([timeRange[0], newEndTime]);
    setDateRange([dateRange[0], newEndDate]);
  }
};
```

#### 1. Top Products by Menu Section Component
**الموقع:** `src/pages/Reports.tsx`

**التصميم:**
```typescript
interface ProductSalesBySection {
  sectionName: string;
  sectionId: string;
  products: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  totalRevenue: number;
  totalQuantity: number;
}

const TopProductsBySection = ({ data }: { data: ProductSalesBySection[] }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  return (
    <div className="space-y-4">
      {data.map(section => (
        <div key={section.sectionId} className="border rounded-lg">
          <div 
            className="flex justify-between items-center p-4 cursor-pointer"
            onClick={() => toggleSection(section.sectionId)}
          >
            <h4>{section.sectionName}</h4>
            <div className="flex items-center gap-4">
              <span>{formatCurrency(section.totalRevenue)}</span>
              <ChevronDown className={expandedSections.has(section.sectionId) ? 'rotate-180' : ''} />
            </div>
          </div>
          {expandedSections.has(section.sectionId) && (
            <div className="p-4 border-t">
              {section.products.map(product => (
                <div key={product.name} className="flex justify-between py-2">
                  <span>{product.name}</span>
                  <div>
                    <span>{product.quantity} قطعة</span>
                    <span className="mr-4">{formatCurrency(product.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```


#### 2. Separate Gaming Sessions Components
**الموقع:** `src/pages/Reports.tsx`

**التصميم:**
```typescript
interface SessionsData {
  playstation: {
    totalSessions: number;
    totalRevenue: number;
    avgDuration: number;
    avgRevenue: number;
    deviceUsage: Array<{
      deviceName: string;
      sessionsCount: number;
      revenue: number;
      usageRate: number;
    }>;
    controllerDistribution: {
      single: number;  // 1-2 controllers
      triple: number;  // 3 controllers
      quad: number;    // 4 controllers
    };
  };
  computer: {
    totalSessions: number;
    totalRevenue: number;
    avgDuration: number;
    avgRevenue: number;
    deviceUsage: Array<{
      deviceName: string;
      sessionsCount: number;
      revenue: number;
      usageRate: number;
    }>;
  };
}

const PlayStationSessionsReport = ({ data }: { data: SessionsData['playstation'] }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard icon={Gamepad2} title="عدد الجلسات" value={data.totalSessions} />
      <StatCard icon={DollarSign} title="الإيراد" value={formatCurrency(data.totalRevenue)} />
      <StatCard icon={Clock} title="متوسط المدة" value={`${data.avgDuration} ساعة`} />
      <StatCard icon={Target} title="متوسط الإيراد" value={formatCurrency(data.avgRevenue)} />
    </div>
    
    <div className="mt-4">
      <h5>توزيع الدراعات</h5>
      <div className="grid grid-cols-3 gap-4">
        <div>1-2 دراعات: {data.controllerDistribution.single}</div>
        <div>3 دراعات: {data.controllerDistribution.triple}</div>
        <div>4 دراعات: {data.controllerDistribution.quad}</div>
      </div>
    </div>
    
    <div className="mt-4">
      <h5>أكثر الأجهزة استخداماً</h5>
      {data.deviceUsage.map(device => (
        <div key={device.deviceName} className="flex justify-between py-2">
          <span>{device.deviceName}</span>
          <div>
            <span>{device.sessionsCount} جلسة</span>
            <span className="mr-4">{formatCurrency(device.revenue)}</span>
            <span className="mr-4">{device.usageRate}%</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);
```

#### 3. Comparison with Previous Period Component
**الموقع:** `src/pages/Reports.tsx`

**التصميم:**
```typescript
interface ComparisonData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

const StatCardWithComparison = ({ 
  title, 
  current, 
  comparison 
}: { 
  title: string; 
  current: number; 
  comparison: ComparisonData 
}) => {
  const isIncrease = comparison.change >= 0;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <h4 className="text-sm text-gray-600">{title}</h4>
      <div className="text-2xl font-bold">{formatCurrency(current)}</div>
      <div className={`flex items-center gap-2 text-sm ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
        {isIncrease ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
        <span>{Math.abs(comparison.changePercent).toFixed(1)}%</span>
        <span className="text-gray-500">مقارنة بالفترة السابقة</span>
      </div>
    </div>
  );
};
```

#### 4. Peak Hours Component
**الموقع:** `src/pages/Reports.tsx`

**التصميم:**
```typescript
interface PeakHoursData {
  hourlyData: Array<{
    hour: number;
    sales: number;
    sessions: number;
    revenue: number;
  }>;
  peakHours: number[];  // Top 3 hours
}

const PeakHoursChart = ({ data }: { data: PeakHoursData }) => {
  const [viewMode, setViewMode] = useState<'sales' | 'sessions'>('sales');
  
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h4>ساعات الذروة</h4>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('sales')}>المبيعات</button>
          <button onClick={() => setViewMode('sessions')}>الجلسات</button>
        </div>
      </div>
      <div className="h-64">
        <BarChart data={data.hourlyData} />
      </div>
    </div>
  );
};
```

#### 5. Staff Performance Component
**الموقع:** `src/pages/Reports.tsx`

**التصميم:**
```typescript
interface StaffPerformance {
  staffId: string;
  staffName: string;
  ordersCount: number;
  sessionsCount: number;
  totalRevenue: number;
  avgOrderValue: number;
}

const StaffPerformanceTable = ({ data }: { data: StaffPerformance[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr>
          <th>الموظف</th>
          <th>عدد الطلبات</th>
          <th>عدد الجلسات</th>
          <th>الإيراد الإجمالي</th>
          <th>متوسط قيمة الطلب</th>
        </tr>
      </thead>
      <tbody>
        {data.map(staff => (
          <tr key={staff.staffId}>
            <td>{staff.staffName}</td>
            <td>{staff.ordersCount}</td>
            <td>{staff.sessionsCount}</td>
            <td>{formatCurrency(staff.totalRevenue)}</td>
            <td>{formatCurrency(staff.avgOrderValue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
```

### Backend Components

#### 1. Enhanced Sales Report API
**الموقع:** `server/controllers/reportController.js`

**التعديلات المطلوبة:**
```javascript
export const getSalesReport = async (req, res) => {
  try {
    const { groupBy = "day", ...filter } = req.query;
    const { startDate, endDate } = getDateRange(filter);
    
    // Get previous period for comparison
    const periodDuration = endDate - startDate;
    const previousStartDate = new Date(startDate.getTime() - periodDuration);
    const previousEndDate = startDate;
    
    // Current period data
    const currentData = await getSalesReportData(
      req.user.organization,
      startDate,
      endDate
    );
    
    // Previous period data for comparison
    const previousData = await getSalesReportData(
      req.user.organization,
      previousStartDate,
      previousEndDate
    );
    
    // Top products by menu section
    const topProductsBySection = await getTopProductsBySection(
      req.user.organization,
      startDate,
      endDate
    );
    
    // Peak hours analysis
    const peakHours = await getPeakHoursData(
      req.user.organization,
      startDate,
      endDate
    );
    
    // Staff performance
    const staffPerformance = await getStaffPerformanceData(
      req.user.organization,
      startDate,
      endDate
    );
    
    res.json({
      success: true,
      data: {
        current: currentData,
        previous: previousData,
        comparison: calculateComparison(currentData, previousData),
        topProductsBySection,
        peakHours,
        staffPerformance
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "خطأ في جلب تقرير المبيعات",
      error: error.message
    });
  }
};
```

#### 2. Top Products by Section Helper
**الموقع:** `server/controllers/reportController.js`

**دالة جديدة:**
```javascript
const getTopProductsBySection = async (organization, startDate, endDate) => {
  const orders = await Order.find({
    createdAt: { $gte: startDate, $lte: endDate },
    status: 'delivered',
    organization
  }).populate({
    path: 'items.menuItem',
    populate: {
      path: 'category',
      populate: {
        path: 'section',
        select: 'name'
      }
    }
  });
  
  const sectionData = {};
  
  orders.forEach(order => {
    order.items.forEach(item => {
      if (!item.menuItem || !item.menuItem.category || !item.menuItem.category.section) {
        return;
      }
      
      const section = item.menuItem.category.section;
      const sectionId = section._id.toString();
      const sectionName = section.name;
      
      if (!sectionData[sectionId]) {
        sectionData[sectionId] = {
          sectionId,
          sectionName,
          products: {},
          totalRevenue: 0,
          totalQuantity: 0
        };
      }
      
      if (!sectionData[sectionId].products[item.name]) {
        sectionData[sectionId].products[item.name] = {
          name: item.name,
          quantity: 0,
          revenue: 0
        };
      }
      
      sectionData[sectionId].products[item.name].quantity += item.quantity;
      sectionData[sectionId].products[item.name].revenue += item.itemTotal;
      sectionData[sectionId].totalRevenue += item.itemTotal;
      sectionData[sectionId].totalQuantity += item.quantity;
    });
  });
  
  // Convert to array and sort products within each section
  return Object.values(sectionData).map(section => ({
    ...section,
    products: Object.values(section.products)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)  // Top 5 products per section
  })).sort((a, b) => b.totalRevenue - a.totalRevenue);
};
```

#### 3. Enhanced Sessions Report API
**الموقع:** `server/controllers/reportController.js`

**التعديلات المطلوبة:**
```javascript
export const getSessionsReport = async (req, res) => {
  try {
    const { ...filter } = req.query;
    const { startDate, endDate } = getDateRange(filter);
    
    // Separate PlayStation and Computer sessions
    const playstationData = await getSessionsDataByType(
      req.user.organization,
      startDate,
      endDate,
      'playstation'
    );
    
    const computerData = await getSessionsDataByType(
      req.user.organization,
      startDate,
      endDate,
      'computer'
    );
    
    res.json({
      success: true,
      data: {
        playstation: playstationData,
        computer: computerData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "خطأ في جلب تقرير الجلسات",
      error: error.message
    });
  }
};
```

#### 4. Sessions Data by Type Helper
**الموقع:** `server/controllers/reportController.js`

**دالة جديدة:**
```javascript
const getSessionsDataByType = async (organization, startDate, endDate, deviceType) => {
  const sessions = await Session.find({
    startTime: { $gte: startDate, $lte: endDate },
    deviceType,
    status: 'ended',
    organization
  });
  
  const totalSessions = sessions.length;
  const totalRevenue = sessions.reduce((sum, s) => sum + (s.finalCost || 0), 0);
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const avgDuration = totalSessions > 0 ? totalDuration / totalSessions / 60 : 0; // in hours
  const avgRevenue = totalSessions > 0 ? totalRevenue / totalSessions : 0;
  
  // Device usage statistics
  const deviceStats = {};
  sessions.forEach(session => {
    if (!deviceStats[session.deviceName]) {
      deviceStats[session.deviceName] = {
        deviceName: session.deviceName,
        sessionsCount: 0,
        revenue: 0,
        totalDuration: 0
      };
    }
    deviceStats[session.deviceName].sessionsCount++;
    deviceStats[session.deviceName].revenue += session.finalCost || 0;
    deviceStats[session.deviceName].totalDuration += session.duration || 0;
  });
  
  const deviceUsage = Object.values(deviceStats)
    .map(device => ({
      ...device,
      usageRate: calculateUsageRate(device.totalDuration, startDate, endDate)
    }))
    .sort((a, b) => b.sessionsCount - a.sessionsCount);
  
  const result = {
    totalSessions,
    totalRevenue,
    avgDuration,
    avgRevenue,
    deviceUsage
  };
  
  // Add controller distribution for PlayStation
  if (deviceType === 'playstation') {
    const controllerDistribution = {
      single: sessions.filter(s => s.controllers <= 2).length,
      triple: sessions.filter(s => s.controllers === 3).length,
      quad: sessions.filter(s => s.controllers === 4).length
    };
    result.controllerDistribution = controllerDistribution;
  }
  
  return result;
};

const calculateUsageRate = (totalDuration, startDate, endDate) => {
  const periodDuration = (endDate - startDate) / 1000; // in seconds
  return (totalDuration / periodDuration) * 100;
};
```

#### 5. Peak Hours Helper
**الموقع:** `server/controllers/reportController.js`

**دالة جديدة:**
```javascript
const getPeakHoursData = async (organization, startDate, endDate) => {
  const bills = await Bill.find({
    createdAt: { $gte: startDate, $lte: endDate },
    organization
  }).populate('orders sessions');
  
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    sales: 0,
    sessions: 0,
    revenue: 0
  }));
  
  bills.forEach(bill => {
    const hour = new Date(bill.createdAt).getHours();
    hourlyData[hour].revenue += bill.total || 0;
    hourlyData[hour].sales += bill.orders.length;
    hourlyData[hour].sessions += bill.sessions.length;
  });
  
  // Find top 3 peak hours
  const peakHours = [...hourlyData]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)
    .map(h => h.hour);
  
  return {
    hourlyData,
    peakHours
  };
};
```

#### 6. Staff Performance Helper
**الموقع:** `server/controllers/reportController.js`

**دالة جديدة:**
```javascript
const getStaffPerformanceData = async (organization, startDate, endDate) => {
  const orders = await Order.find({
    createdAt: { $gte: startDate, $lte: endDate },
    organization
  }).populate('createdBy', 'name');
  
  const sessions = await Session.find({
    startTime: { $gte: startDate, $lte: endDate },
    organization
  }).populate('createdBy', 'name');
  
  const staffStats = {};
  
  orders.forEach(order => {
    if (!order.createdBy) return;
    
    const staffId = order.createdBy._id.toString();
    if (!staffStats[staffId]) {
      staffStats[staffId] = {
        staffId,
        staffName: order.createdBy.name,
        ordersCount: 0,
        sessionsCount: 0,
        totalRevenue: 0
      };
    }
    
    staffStats[staffId].ordersCount++;
    staffStats[staffId].totalRevenue += order.finalAmount || 0;
  });
  
  sessions.forEach(session => {
    if (!session.createdBy) return;
    
    const staffId = session.createdBy._id.toString();
    if (!staffStats[staffId]) {
      staffStats[staffId] = {
        staffId,
        staffName: session.createdBy.name,
        ordersCount: 0,
        sessionsCount: 0,
        totalRevenue: 0
      };
    }
    
    staffStats[staffId].sessionsCount++;
    staffStats[staffId].totalRevenue += session.finalCost || 0;
  });
  
  return Object.values(staffStats)
    .map(staff => ({
      ...staff,
      avgOrderValue: staff.ordersCount > 0 ? staff.totalRevenue / staff.ordersCount : 0
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
};
```

## Data Models

لا حاجة لتعديل نماذج البيانات الموجودة. جميع البيانات المطلوبة متوفرة في النماذج الحالية:
- `Bill` - للفواتير والإيرادات
- `Order` - للطلبات والمنتجات
- `Session` - للجلسات
- `MenuItem` - للمنتجات
- `MenuCategory` - للفئات
- `MenuSection` - للأقسام
- `User` - للموظفين

## Filter Integration Strategy

### دمج فلتر التاريخ والساعة مع الفلاتر الموجودة

**الوضع الحالي:**
- صفحة التقارير تستخدم فلاتر محددة مسبقاً (اليوم، الأمس، آخر 7 أيام، إلخ)
- الفلاتر تستخدم `startOfDay` و `endOfDay` مما يعني أنها تغطي اليوم كاملاً

**الحل المقترح:**
1. **إضافة وضع فلتر جديد "مخصص":**
   - عند اختيار "مخصص"، يظهر DateTimeFilter
   - يسمح بتحديد التاريخ والساعة بدقة

2. **الحفاظ على الفلاتر السريعة:**
   - الفلاتر السريعة (اليوم، الأمس، إلخ) تبقى كما هي
   - عند اختيار فلتر سريع، يتم تعيين الساعات تلقائياً (00:00 - 23:59)

3. **التبديل بين الأوضاع:**
```typescript
const [filterMode, setFilterMode] = useState<'quick' | 'custom'>('quick');

// عند اختيار فلتر سريع
const handleQuickFilter = (period: string) => {
  setFilterMode('quick');
  setSelectedPeriod(period);
  // يتم حساب التواريخ تلقائياً مع ساعات كاملة
};

// عند اختيار فلتر مخصص
const handleCustomFilter = () => {
  setFilterMode('custom');
  // يظهر DateTimeFilter للمستخدم
};
```

4. **بناء الفلتر النهائي:**
```typescript
const buildFilter = () => {
  if (filterMode === 'quick') {
    // استخدام الطريقة القديمة مع startOfDay/endOfDay
    return buildQuickFilter(selectedPeriod);
  } else {
    // استخدام dateRange المحدد من DateTimeFilter
    return {
      startDate: dateRange[0].toISOString(),
      endDate: dateRange[1].toISOString()
    };
  }
};
```

## User Interface Flow

### Flow 0: تحديد فترة زمنية مخصصة بالساعة

```
1. المستخدم يفتح صفحة التقارير
   ↓
2. يختار وضع "فلتر مخصص"
   ↓
3. يظهر DateTimeFilter
   ↓
4. المستخدم يختار تاريخ البداية
   ↓
5. المستخدم يختار ساعة البداية (بفواصل 15 دقيقة)
   ↓
6. المستخدم يختار تاريخ النهاية
   ↓
7. المستخدم يختار ساعة النهاية
   ↓
8. يعرض ملخص الفترة المحددة بتنسيق واضح
   ↓
9. النظام يجلب البيانات للفترة المحددة بدقة
   ↓
10. تعرض التقارير بناءً على الفترة المحددة
```

### Flow 1: عرض المنتجات حسب أقسام المنيو

```
1. المستخدم يفتح صفحة التقارير
   ↓
2. يختار الفترة الزمنية
   ↓
3. النظام يجلب البيانات من API
   ↓
4. يعرض قسم "أكثر المنتجات مبيعاً"
   ↓
5. يعرض قائمة بأقسام المنيو (مطوية افتراضياً)
   ↓
6. المستخدم ينقر على قسم لفتحه
   ↓
7. يعرض أكثر 5 منتجات مبيعاً في هذا القسم
```

### Flow 2: مقارنة مع الفترة السابقة

```
1. النظام يحسب الفترة السابقة تلقائياً
   ↓
2. يجلب بيانات الفترة الحالية والسابقة
   ↓
3. يحسب الفرق والنسبة المئوية
   ↓
4. يعرض سهم أخضر للزيادة أو أحمر للنقصان
   ↓
5. يعرض النسبة المئوية للتغيير
```

## Error Handling

1. **عدم وجود بيانات:**
   - عرض رسالة "لا توجد بيانات للفترة المحددة"
   - عرض رسوم بيانية فارغة مع رسالة توضيحية

2. **خطأ في جلب البيانات:**
   - عرض رسالة خطأ واضحة
   - توفير زر "إعادة المحاولة"

3. **فترة غير صحيحة:**
   - التحقق من صحة التواريخ
   - عرض رسالة خطأ إذا كانت الفترة غير منطقية

## Testing Strategy

### Unit Tests

1. **Frontend:**
   - اختبار عرض المنتجات حسب الأقسام
   - اختبار طي وفتح الأقسام
   - اختبار حساب المقارنة مع الفترة السابقة
   - اختبار عرض الرسوم البيانية

2. **Backend:**
   - اختبار `getTopProductsBySection`
   - اختبار `getSessionsDataByType`
   - اختبار `getPeakHoursData`
   - اختبار `getStaffPerformanceData`

### Integration Tests

1. **End-to-End:**
   - اختبار تدفق كامل من اختيار الفترة إلى عرض التقارير
   - اختبار تصدير التقارير
   - اختبار التبديل بين أنواع العرض المختلفة

## Performance Considerations

1. **تحسين الاستعلامات:**
   - استخدام indexes على الحقول المستخدمة في الفلترة
   - استخدام `lean()` للاستعلامات التي لا تحتاج methods

2. **Caching:**
   - تخزين مؤقت للتقارير المستخدمة بكثرة
   - تحديث الـ cache عند إضافة بيانات جديدة

3. **Pagination:**
   - تحديد عدد العناصر المعروضة (مثل: أكثر 5 منتجات لكل قسم)
   - عدم جلب جميع البيانات دفعة واحدة

## Security Considerations

1. **التحقق من الصلاحيات:**
   - التأكد من أن المستخدم لديه صلاحية عرض التقارير
   - فلترة البيانات حسب المنشأة

2. **حماية البيانات الحساسة:**
   - عدم عرض معلومات حساسة في التقارير المصدرة
   - تشفير البيانات عند التصدير

## Migration Strategy

لا حاجة لـ migration لأن جميع البيانات موجودة في النماذج الحالية.

## Rollback Plan

في حالة وجود مشاكل:
1. إعادة الكود القديم لصفحة التقارير
2. الاحتفاظ بالـ API endpoints الجديدة للاستخدام المستقبلي
3. لا حاجة لتغييرات في Database
