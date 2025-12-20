import React from 'react';
import { Gamepad2, Monitor, Coffee } from 'lucide-react';
import { formatCurrency, formatDecimal } from '../../utils/formatters';

interface RevenueBreakdownProps {
  playstation: number;
  computer: number;
  cafe: number;
  totalRevenue: number;
}

const RevenueBreakdown: React.FC<RevenueBreakdownProps> = ({
  playstation,
  computer,
  cafe,
  totalRevenue
}) => {
  const categories = [
    {
      name: 'البلايستيشن',
      value: playstation,
      icon: Gamepad2,
      color: 'blue'
    },
    {
      name: 'الكمبيوتر',
      value: computer,
      icon: Monitor,
      color: 'green'
    },
    {
      name: 'المطعم',
      value: cafe,
      icon: Coffee,
      color: 'orange'
    }
  ];

  const colorClasses = {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-600 dark:text-blue-400',
      percentage: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-600 dark:text-green-400',
      percentage: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    },
    orange: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-600 dark:text-orange-400',
      percentage: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    }
  } as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {categories.map(({ name, value, icon: Icon, color }) => {
        const colors = colorClasses[color as keyof typeof colorClasses];
        const percentage = totalRevenue > 0 ? (value / totalRevenue) * 100 : 0;
        
        return (
          <div key={name} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Icon className={`w-5 h-5 ${colors.text}`} />
                {name}
              </h3>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${colors.percentage}`}>
                {formatDecimal(percentage)}%
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white text-center mt-4">
              {formatCurrency(value)}
            </p>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-4">
              <div 
                className={`h-2.5 rounded-full ${colors.bg}`} 
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RevenueBreakdown;
