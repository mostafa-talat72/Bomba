import React from 'react';
import SkeletonLoader from './SkeletonLoader';

export const StatisticsCardsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <SkeletonLoader width="60%" height="0.875rem" className="mb-2" />
              <SkeletonLoader width="80%" height="2rem" />
            </div>
            <SkeletonLoader variant="circular" width={48} height={48} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const CategoriesFilterSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <SkeletonLoader width="100px" height="1.25rem" className="mb-4" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonLoader key={i} width="120px" height="2.5rem" />
        ))}
      </div>
    </div>
  );
};

export const CostsTableSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {['القسم', 'الوصف', 'المبلغ', 'المدفوع', 'المتبقي', 'التاريخ', 'الحالة', 'إجراءات'].map((header) => (
                <th key={header} className="px-6 py-3 text-right">
                  <SkeletonLoader width="80px" height="0.75rem" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <SkeletonLoader variant="circular" width={40} height={40} />
                    <SkeletonLoader width="100px" height="1rem" />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <SkeletonLoader width="150px" height="1rem" className="mb-1" />
                  <SkeletonLoader width="100px" height="0.75rem" />
                </td>
                <td className="px-6 py-4">
                  <SkeletonLoader width="80px" height="1rem" />
                </td>
                <td className="px-6 py-4">
                  <SkeletonLoader width="80px" height="1rem" />
                </td>
                <td className="px-6 py-4">
                  <SkeletonLoader width="80px" height="1rem" />
                </td>
                <td className="px-6 py-4">
                  <SkeletonLoader width="100px" height="1rem" />
                </td>
                <td className="px-6 py-4">
                  <SkeletonLoader width="90px" height="1.5rem" />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <SkeletonLoader variant="circular" width={24} height={24} />
                    <SkeletonLoader variant="circular" width={24} height={24} />
                    <SkeletonLoader variant="circular" width={24} height={24} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
