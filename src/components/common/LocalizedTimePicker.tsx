import React from 'react';
import { TimePicker } from 'antd';
import type { TimePickerProps } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';

/**
 * TimePicker مخصص يدعم ترجمة AM/PM إلى ص/م في اللغة العربية
 */
const LocalizedTimePicker: React.FC<TimePickerProps> = (props) => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  // دالة لتنسيق الوقت مع ترجمة AM/PM
  const formatTime = (time: Dayjs | null) => {
    if (!time) return '';
    
    const formatted = time.format('hh:mm A');
    
    if (isArabic) {
      return formatted
        .replace(/AM/gi, 'ص')
        .replace(/PM/gi, 'م');
    }
    
    return formatted;
  };

  // دالة مخصصة لعرض الوقت في الـ input
  const customFormat = (value: Dayjs) => {
    return formatTime(value);
  };

  return (
    <TimePicker
      {...props}
      format={customFormat}
      showNow={false}
      use12Hours
      placeholder={isArabic ? 'اختر الوقت' : 'Select time'}
    />
  );
};

export default LocalizedTimePicker;
