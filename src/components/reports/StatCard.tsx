import React from 'react';
import { LucideIcon } from 'lucide-react';
import { formatCurrency, formatDecimal } from '../../utils/formatters';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: number;
  isCurrency?: boolean;
  suffix?: string;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow';
  className?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconText: 'text-blue-600 dark:text-blue-400'
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconText: 'text-green-600 dark:text-green-400'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconText: 'text-purple-600 dark:text-purple-400'
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconText: 'text-orange-600 dark:text-orange-400'
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-600 dark:text-red-400',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconText: 'text-red-600 dark:text-red-400'
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-600 dark:text-yellow-400',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconText: 'text-yellow-600 dark:text-yellow-400'
  }
};

const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  title,
  value,
  isCurrency = false,
  color,
  className = '',
  loading = false,
  error = null,
  onRetry,
  suffix
}) => {
  const colors = colorClasses[color];
  
  const formattedValue = isCurrency ? formatCurrency(value) : formatDecimal(value);

  if (loading) {
    return (
      <div className={`rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg p-4 bg-red-50 dark:bg-red-900/20 ${className}`}>
        <div className="flex items-start">
          <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 mr-3">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{title}</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              {error}
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="ml-2 text-red-700 dark:text-red-300 font-medium hover:underline"
                >
                  إعادة المحاولة
                </button>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-4 ${colors.bg} ${className}`}>
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colors.iconBg} mr-4`}>
          <Icon className={`w-6 h-6 ${colors.iconText}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className={`text-2xl font-semibold mt-1 ${colors.text}`}>
            {formattedValue}{suffix ? ` ${suffix}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
