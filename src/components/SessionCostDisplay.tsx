import React, { useState, useEffect } from 'react';
import { DollarSign, Clock } from 'lucide-react';
import { Session, Device } from '../services/api';

// دالة لتحويل الأرقام الإنجليزية إلى العربية
const toArabicNumbers = (str: string): string => {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[0-9]/g, (digit) => arabicNumbers[parseInt(digit)]);
};

interface SessionCostDisplayProps {
  session: Session;
  device: Device | null;
}

/**
 * Component to display session cost with real-time calculation
 * Calculates cost on the frontend based on controllersHistory
 */
export const SessionCostDisplay: React.FC<SessionCostDisplayProps> = ({ session, device }) => {
  const [currentCost, setCurrentCost] = useState(0);
  const [duration, setDuration] = useState({ hours: 0, minutes: 0 });

  // Calculate cost based on controllersHistory
  const calculateCurrentCost = () => {
    if (!session || !device || session.status !== 'active') {
      return session.totalCost || 0;
    }

    const now = new Date();
    let total = 0;

    // Helper function to get hourly rate
    const getRate = (controllers: number) => {
      if (device.type === 'playstation' && device.playstationRates) {
        return device.playstationRates[controllers] || 0;
      } else if (device.type === 'computer') {
        return device.hourlyRate || 0;
      }
      return 0;
    };

    // If no controllersHistory, calculate based on total duration
    if (!session.controllersHistory || session.controllersHistory.length === 0) {
      const durationMs = now.getTime() - new Date(session.startTime).getTime();
      const minutes = durationMs / (1000 * 60);
      const hourlyRate = getRate(session.controllers || 1);
      const minuteRate = hourlyRate / 60;
      total = minutes * minuteRate;
    } else {
      // Calculate based on controllersHistory
      for (const period of session.controllersHistory) {
        let periodEnd = period.to ? new Date(period.to) : now;
        const periodStart = new Date(period.from);

        const durationMs = periodEnd.getTime() - periodStart.getTime();
        const minutes = durationMs / (1000 * 60);

        if (minutes > 0) {
          const hourlyRate = getRate(period.controllers);
          const minuteRate = hourlyRate / 60;
          const periodCost = minutes * minuteRate;
          total += periodCost;
        }
      }
    }

    return Math.round(total);
  };

  // Calculate duration
  const calculateDuration = () => {
    if (!session || !session.startTime) {
      return { hours: 0, minutes: 0 };
    }

    const now = new Date();
    const start = new Date(session.startTime);
    const durationMs = now.getTime() - start.getTime();
    const totalMinutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return { hours, minutes };
  };

  // Update cost and duration every second for smooth updates
  useEffect(() => {
    if (session.status !== 'active') {
      setCurrentCost(session.totalCost || 0);
      return;
    }

    // Update immediately
    setCurrentCost(calculateCurrentCost());
    setDuration(calculateDuration());

    // Update every second for real-time display
    const interval = setInterval(() => {
      setCurrentCost(calculateCurrentCost());
      setDuration(calculateDuration());
    }, 1000);

    return () => clearInterval(interval);
  }, [session, device]);

  // Get current hourly rate
  const getCurrentRate = () => {
    if (!device) return 0;
    if (device.type === 'playstation' && device.playstationRates) {
      return device.playstationRates[session.controllers || 1] || 0;
    } else if (device.type === 'computer') {
      return device.hourlyRate || 0;
    }
    return 0;
  };

  return (
    <div className="space-y-2">
      {/* Current Cost */}
      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
        <div className="flex items-center">
          <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400 ml-2" />
          <span className="text-sm text-green-700 dark:text-green-300">التكلفة الحالية:</span>
        </div>
        <span className="text-lg font-bold text-green-800 dark:text-green-200">
          {toArabicNumbers(String(currentCost))} ج.م
        </span>
      </div>

      {/* Duration */}
      <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
        <div className="flex items-center">
          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 ml-2" />
          <span className="text-xs text-blue-700 dark:text-blue-300">المدة:</span>
        </div>
        <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
          {duration.hours > 0 && `${toArabicNumbers(String(duration.hours))} س `}
          {toArabicNumbers(String(duration.minutes))} د
        </span>
      </div>

      {/* Current Rate */}
      <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <span className="text-xs text-gray-600 dark:text-gray-400">السعر الحالي:</span>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {toArabicNumbers(String(getCurrentRate()))} ج.م/ساعة
        </span>
      </div>
    </div>
  );
};
