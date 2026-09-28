import React from 'react';
import { useTranslation } from 'react-i18next';
import { Filter } from 'lucide-react';

interface FilterControlsProps {
  filterType: 'period' | 'daily' | 'monthly' | 'yearly';
  selectedPeriod: string;
  customDay: string;
  customMonth: string;
  customYear: string;
  onFilterTypeChange: (type: 'period' | 'daily' | 'monthly' | 'yearly') => void;
  onPeriodChange: (period: string) => void;
  onCustomDayChange: (day: string) => void;
  onCustomMonthChange: (month: string) => void;
  onCustomYearChange: (year: string) => void;
  dateRangeLabel: string;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  filterType,
  selectedPeriod,
  customDay,
  customMonth,
  customYear,
  onFilterTypeChange,
  onPeriodChange,
  onCustomDayChange,
  onCustomMonthChange,
  onCustomYearChange,
  dateRangeLabel
}) => {
  const { t } = useTranslation();
  // Render month options in Arabic
  const renderMonthOptions = () => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = (i + 1).toString().padStart(2, '0');
      const date = new Date(2000, i, 1);
      const monthName = date.toLocaleString('ar-EG', { month: 'long' });
      return (
        <option key={month} value={month}>
          {monthName}
        </option>
      );
    });
  };

  // Render year options (current year and previous 4 years)
  const renderYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => {
      const year = currentYear - i;
      return (
        <option key={year} value={year}>
          {year}
        </option>
      );
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Filter className="w-5 h-5 text-orange-500" />
        <span>{t('filterControls.title')}</span>
      </h2>
      
      <div className="space-y-4">
        {/* Filter type tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
          {[
            { value: 'period', label: t('filterControls.tabPeriod') },
            { value: 'daily', label: t('filterControls.tabDaily') },
            { value: 'monthly', label: t('filterControls.tabMonthly') },
            { value: 'yearly', label: t('filterControls.tabYearly') }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => onFilterTypeChange(tab.value as any)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                filterType === tab.value
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter content */}
        <div className="space-y-4">
          {filterType === 'period' && (
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'today', label: t('filterControls.periodToday') },
                { value: 'yesterday', label: t('filterControls.periodYesterday') },
                { value: 'last7', label: t('filterControls.periodLast7') },
                { value: 'thisMonth', label: t('filterControls.periodThisMonth') },
                { value: 'thisYear', label: t('filterControls.periodThisYear') }
              ].map((period) => (
                <button
                  key={period.value}
                  onClick={() => onPeriodChange(period.value)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    selectedPeriod === period.value
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          )}

          {filterType === 'daily' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('filterControls.selectDate')}
              </label>
              <input
                type="date"
                value={customDay}
                onChange={(e) => onCustomDayChange(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
              />
            </div>
          )}

          {filterType === 'monthly' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('filterControls.month')}
                </label>
                <select
                  value={customMonth.split('-')[1]}
                  onChange={(e) => {
                    const month = e.target.value.padStart(2, '0');
                    onCustomMonthChange(`${customMonth.split('-')[0]}-${month}`);
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                >
                  {renderMonthOptions()}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('filterControls.year')}
                </label>
                <select
                  value={customMonth.split('-')[0]}
                  onChange={(e) => {
                    onCustomMonthChange(`${e.target.value}-${customMonth.split('-')[1]}`);
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                >
                  {renderYearOptions()}
                </select>
              </div>
            </div>
          )}

          {filterType === 'yearly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('filterControls.year')}
              </label>
              <select
                value={customYear}
                onChange={(e) => onCustomYearChange(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
              >
                {renderYearOptions()}
              </select>
            </div>
          )}
        </div>

        {/* Selected date range */}
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">{t('filterControls.dateRange', { dateRangeLabel })}</span>
        </div>
      </div>
    </div>
  );
};

export default FilterControls;
