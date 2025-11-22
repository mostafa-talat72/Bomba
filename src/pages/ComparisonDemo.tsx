import { DollarSign, ShoppingCart, Users, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';

interface ComparisonData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

interface StatCardWithComparisonProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  current: number;
  comparison?: ComparisonData | null;
  color: string;
  formatValue?: (value: number) => string;
}

// StatCardWithComparison Component
const StatCardWithComparison = ({ 
  icon: Icon, 
  title, 
  current, 
  comparison,
  color,
  formatValue = (val) => formatCurrencyUtil(val)
}: StatCardWithComparisonProps) => {
  const isIncrease = comparison ? comparison.change >= 0 : null;
  const hasComparison = comparison && comparison.previous !== undefined;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-4 mb-3">
        <div className={`rounded-full p-3 bg-${color}-100 dark:bg-gray-700`}>
          <Icon className={`h-6 w-6 text-${color}-600 dark:text-${color}-400`} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatValue(current)}
          </p>
        </div>
      </div>
      
      {hasComparison ? (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className={`flex items-center gap-2 text-sm ${
            isIncrease 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {isIncrease ? (
              <>
                <ArrowUp className="w-4 h-4" />
                <TrendingUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <ArrowDown className="w-4 h-4" />
                <TrendingDown className="w-4 h-4" />
              </>
            )}
            <span className="font-bold">
              {Math.abs(comparison.changePercent).toFixed(1)}%
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              مقارنة بالفترة السابقة
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            الفترة السابقة: {formatValue(comparison.previous)}
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            لا توجد بيانات للمقارنة
          </p>
        </div>
      )}
    </div>
  );
};

const ComparisonDemo = () => {
  // Example data with increase
  const revenueComparison: ComparisonData = {
    current: 15000,
    previous: 12000,
    change: 3000,
    changePercent: 25
  };

  // Example data with decrease
  const ordersComparison: ComparisonData = {
    current: 85,
    previous: 120,
    change: -35,
    changePercent: -29.17
  };

  // Example data with no change
  const sessionsComparison: ComparisonData = {
    current: 45,
    previous: 45,
    change: 0,
    changePercent: 0
  };

  return (
    <div className="container mx-auto p-6 space-y-6 rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          مكون المقارنة مع الفترة السابقة
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          عرض توضيحي لمكون StatCardWithComparison مع أمثلة مختلفة
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Example 1: Increase */}
        <StatCardWithComparison
          icon={DollarSign}
          title="إجمالي الإيرادات"
          current={15000}
          comparison={revenueComparison}
          color="green"
        />

        {/* Example 2: Decrease */}
        <StatCardWithComparison
          icon={ShoppingCart}
          title="عدد الطلبات"
          current={85}
          comparison={ordersComparison}
          color="blue"
          formatValue={(val) => formatDecimal(val)}
        />

        {/* Example 3: No change */}
        <StatCardWithComparison
          icon={Users}
          title="عدد الجلسات"
          current={45}
          comparison={sessionsComparison}
          color="purple"
          formatValue={(val) => formatDecimal(val)}
        />

        {/* Example 4: No comparison data */}
        <StatCardWithComparison
          icon={DollarSign}
          title="متوسط الطلب"
          current={176.47}
          comparison={null}
          color="orange"
        />
      </div>

      <div className="bg-blue-50 dark:bg-gray-800 rounded-lg p-6 mt-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          الميزات الرئيسية
        </h2>
        <ul className="space-y-2 text-gray-700 dark:text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
            <span>عرض سهم للأعلى (↑) مع أيقونة TrendingUp للزيادة</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
            <span>عرض سهم للأسفل (↓) مع أيقونة TrendingDown للنقصان</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
            <span>استخدام اللون الأخضر للزيادة والأحمر للنقصان</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
            <span>عرض النسبة المئوية للتغيير بدقة عشرية واحدة</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
            <span>عرض رسالة "لا توجد بيانات للمقارنة" عند عدم وجود بيانات</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
            <span>دعم دالة تنسيق مخصصة للقيم (formatValue)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
            <span>عرض قيمة الفترة السابقة للمقارنة</span>
          </li>
        </ul>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          مثال على الاستخدام
        </h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr">
{`const comparison: ComparisonData = {
  current: 15000,
  previous: 12000,
  change: 3000,
  changePercent: 25
};

<StatCardWithComparison
  icon={DollarSign}
  title="إجمالي الإيرادات"
  current={15000}
  comparison={comparison}
  color="green"
/>`}
        </pre>
      </div>
    </div>
  );
};

export default ComparisonDemo;
