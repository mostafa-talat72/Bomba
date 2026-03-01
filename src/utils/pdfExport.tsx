import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { ReportPDF } from '../components/ReportPDF';

interface ExportPDFOptions {
  reportType: 'sales' | 'financial' | 'sessions' | 'inventory';
  data: any;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  organizationName?: string;
  filename?: string;
}

export const exportReportToPDF = async (options: ExportPDFOptions): Promise<void> => {
  const { reportType, data, dateRange, organizationName, filename } = options;

  try {
    // إنشاء مستند PDF
    const doc = <ReportPDF reportType={reportType} data={data} dateRange={dateRange} organizationName={organizationName} />;
    
    // تحويل المستند إلى Blob
    const blob = await pdf(doc).toBlob();
    
    // إنشاء رابط للتحميل
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // تحديد اسم الملف
    const defaultFilename = `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`;
    link.download = filename || defaultFilename;
    
    // تحميل الملف
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // تنظيف الرابط
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw new Error('فشل في تصدير PDF');
  }
};

// دالة مساعدة لتنسيق اسم الملف
export const generatePDFFilename = (reportType: string, dateRange: { startDate: string; endDate: string }): string => {
  const start = new Date(dateRange.startDate).toISOString().split('T')[0];
  const end = new Date(dateRange.endDate).toISOString().split('T')[0];
  
  const reportNames: Record<string, string> = {
    sales: 'تقرير-المبيعات',
    financial: 'التقرير-المالي',
    sessions: 'تقرير-الجلسات',
    inventory: 'تقرير-المخزون',
  };
  
  const name = reportNames[reportType] || 'تقرير';
  return `${name}-${start}-${end}.pdf`;
};
