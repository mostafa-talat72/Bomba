import React, { useState, useEffect } from 'react';
import { Card, Tabs, Tag, Statistic, Row, Col, Empty, Spin, Button, DatePicker, InputNumber, Modal, message, Form, Input, Select, TimePicker, Table } from 'antd';
import { User, DollarSign, AlertCircle, ArrowLeft, Wallet, TrendingUp, Calendar, Plus, Minus, Edit, Trash2, Download, MessageCircle, Phone, Briefcase } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';
import { pdf } from '@react-pdf/renderer';
import EmployeePDFDocument from './EmployeePDFDocument';
import { numberOnlyInputProps } from '../../utils/inputHelpers';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useOrganization } from '../../context/OrganizationContext';
import './EmployeeProfile.css';

dayjs.locale('ar');

const { Option } = Select;
const { TextArea } = Input;

interface EmployeeProfileProps {
  employeeId: string;
  onClose: () => void;
  onAdvanceAdded?: () => void;
}

const EmployeeProfile: React.FC<EmployeeProfileProps> = ({ employeeId, onClose, onAdvanceAdded }) => {
  const { t } = useTranslation();
  const { currentLanguage, isRTL } = useLanguage();
  const { getCurrencySymbol } = useOrganization();
  
  // Helper to get currency symbol with current language
  const currency = () => getCurrencySymbol(currentLanguage);
  
  const [employee, setEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [payrollData, setPayrollData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(dayjs());
  const [showFinancials, setShowFinancials] = useState(false);
  const [editEmployeeModalVisible, setEditEmployeeModalVisible] = useState(false);
  const [editEmployeeForm] = Form.useForm();
  
  const isCurrentMonth = selectedMonth.format('YYYY-MM') === dayjs().format('YYYY-MM');

  // Edit modals
  const [editAttendanceModalVisible, setEditAttendanceModalVisible] = useState(false);
  const [editAdvanceModalVisible, setEditAdvanceModalVisible] = useState(false);
  const [editDeductionModalVisible, setEditDeductionModalVisible] = useState(false);
  const [editPaymentModalVisible, setEditPaymentModalVisible] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<any>(null);
  const [editingAdvance, setEditingAdvance] = useState<any>(null);
  const [editingDeduction, setEditingDeduction] = useState<any>(null);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editForm] = Form.useForm();

  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [advanceModalVisible, setAdvanceModalVisible] = useState(false);
  const [deductionModalVisible, setDeductionModalVisible] = useState(false);
  
  // Attendance modal states
  const [attendanceForm] = Form.useForm();
  const [timeMode, setTimeMode] = useState<'same' | 'different' | 'groups'>('same');
  const [dayTimes, setDayTimes] = useState<any[]>([]);
  const [timeGroups, setTimeGroups] = useState<any[]>([]);
  
  // Advance and Deduction forms
  const [advanceForm] = Form.useForm();
  const [deductionForm] = Form.useForm();

  useEffect(() => {
    dayjs.locale(currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData();
    }
  }, [employeeId, selectedMonth]);

  useEffect(() => {
    // Set default values for advance form when modal opens
    if (advanceModalVisible) {
      advanceForm.setFieldsValue({
        repaymentMethod: 'installments',
        installments: 1
      });
    }
  }, [advanceModalVisible, advanceForm]);

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      
      const empResponse = await api.get(`/payroll/employees/${employeeId}`);
      if (empResponse.success && empResponse.data) {
        setEmployee(empResponse.data);
      }

      const month = selectedMonth.format('YYYY-MM');
      const summaryResponse = await api.get(`/payroll/payments/summary/${employeeId}`, {
        params: { month }
      });
      
      if (summaryResponse.success && summaryResponse.data) {
        const summary = summaryResponse.data;
        setAttendance(summary.attendanceRecords || []);
        setAdvances(summary.advances || []);
        setDeductions(summary.deductions || []);
        setPayments(summary.payments || []);
        setPayrollData({
          currentMonthSalary: summary.currentMonth.salary,
          currentMonthAdvances: summary.currentMonth.advances,
          currentMonthDeductions: summary.currentMonth.deductions || 0,
          currentMonthPaid: summary.currentMonth.paid,
          carriedForward: summary.carriedForward,
          remainingBalance: summary.remainingBalance,
          totalDeductions: summary.totalDeductions || 0
        });
      } else {
        setAttendance([]);
        setAdvances([]);
        setDeductions([]);
        setPayments([]);
        setPayrollData(null);
      }
    } catch (error: any) {
      console.error(t('payroll.employeeProfile.messages.loadError'), error);
      setAttendance([]);
      setAdvances([]);
      setDeductions([]);
      setPayments([]);
      setPayrollData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number | string) => {
    // تحويل الأرقام إلى عربية فقط إذا كانت اللغة الحالية عربية
    if (currentLanguage === 'ar') {
      const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      return String(num).replace(/\d/g, (d) => arabicNumbers[parseInt(d)]);
    }
    return String(num);
  };

  const toArabicNumbers = (num: number | string) => {
    // للتوافق مع الكود القديم - استخدم formatNumber بدلاً منها
    return formatNumber(num);
  };

  const calculateStats = () => {
    if (!payrollData) {
      return {
        currentMonthSalary: 0,
        currentMonthAdvances: 0,
        currentMonthDeductions: 0,
        currentMonthPaid: 0,
        carriedForward: 0,
        remainingBalance: 0,
        attendanceDays: attendance.filter(a => a.status === 'present' || a.status === 'late').length,
        totalSalaries: 0,
        totalAdvances: 0,
        totalDeductions: 0,
        netAmount: 0
      };
    }
    
    return {
      currentMonthSalary: payrollData.currentMonthSalary || 0,
      currentMonthAdvances: payrollData.currentMonthAdvances || 0,
      currentMonthDeductions: payrollData.currentMonthDeductions || 0,
      currentMonthPaid: payrollData.currentMonthPaid || 0,
      carriedForward: payrollData.carriedForward || 0,
      remainingBalance: payrollData.remainingBalance || 0,
      attendanceDays: attendance.filter(a => a.status === 'present' || a.status === 'late').length,
      totalSalaries: payrollData.totalSalaries || 0,
      totalAdvances: payrollData.totalAdvances || 0,
      totalDeductions: payrollData.totalDeductions || 0,
      netAmount: payrollData.remainingBalance || 0
    };
  };

  const stats = calculateStats();

  const handlePayment = async () => {
    if (!paymentAmount || paymentAmount <= 0) {
      message.error(t('payroll.employeeProfile.messages.invalidAmount'));
      return;
    }
    if (paymentAmount > stats.remainingBalance) {
      message.error(t('payroll.employeeProfile.messages.amountExceedsBalance'));
      return;
    }
    try {
      const response = await api.post('/payroll/payments', {
        employeeId,
        amount: paymentAmount,
        month: selectedMonth.format('YYYY-MM'),
        method: 'cash',
        date: paymentDate.format('YYYY-MM-DD')
      });
      
      if (response.success) {
        message.success(t('payroll.employeeProfile.messages.paymentSuccess'));
        setPaymentModalVisible(false);
        setPaymentAmount(0);
        setPaymentDate(dayjs());
        fetchEmployeeData();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || t('payroll.employeeProfile.messages.paymentError');
      message.error(errorMessage);
    }
  };

  const handleExportPDF = async () => {
    try {
      message.loading(t('payroll.employeeProfile.messages.exportingPDF'), 0);
      
      const monthName = selectedMonth.locale(currentLanguage).format('MMMM YYYY');
      
      // إنشاء مستند PDF
      const blob = await pdf(
        <EmployeePDFDocument 
          employee={employee}
          monthName={monthName}
          stats={stats}
          attendance={attendance}
          advances={advances}
          deductions={deductions}
          payments={payments}
          t={t}
          currentLanguage={currentLanguage}
          isRTL={isRTL}
          currency={currency()}
        />
      ).toBlob();
      
      // تنزيل الملف
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `employee-report-${employee.personalInfo?.name}-${selectedMonth.format('YYYY-MM')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      
      message.destroy();
      message.success(t('payroll.employeeProfile.messages.exportSuccess'));
    } catch (error) {
      console.error(t('payroll.employeeProfile.messages.exportError'), error);
      message.destroy();
      message.error(t('payroll.employeeProfile.messages.exportError'));
    }
  };

  const handleSendWhatsApp = async () => {
    try {
      const phone = employee.personalInfo?.phone;
      
      if (!phone) {
        message.error(t('payroll.employeeProfile.messages.noPhone'));
        return;
      }

      // تنظيف رقم الهاتف (إزالة المسافات والرموز)
      let cleanPhone = phone.replace(/\D/g, '');
      
      // إضافة كود مصر إذا لم يكن موجوداً
      if (!cleanPhone.startsWith('20')) {
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '20' + cleanPhone.substring(1);
        } else {
          cleanPhone = '20' + cleanPhone;
        }
      }

      message.loading(t('payroll.employeeProfile.messages.exportingPDF'), 0);
      
      const monthName = selectedMonth.locale(currentLanguage).format('MMMM YYYY');
      
      // إنشاء مستند PDF
      const blob = await pdf(
        <EmployeePDFDocument 
          employee={employee}
          monthName={monthName}
          stats={stats}
          attendance={attendance}
          advances={advances}
          deductions={deductions}
          payments={payments}
          t={t}
          currentLanguage={currentLanguage}
          isRTL={isRTL}
          currency={currency()}
        />
      ).toBlob();
      
      message.destroy();
      
      // إنشاء رسالة WhatsApp
      const employeeName = employee.personalInfo?.name;
      const whatsappMessage = `${t('payroll.employeeProfile.whatsappMessage.greeting')} ${employeeName}،\n\n${t('payroll.employeeProfile.whatsappMessage.reportFor')} ${monthName}\n\n${t('payroll.employeeProfile.availableBalance')}: ${toArabicNumbers(stats.remainingBalance.toFixed(2))} ${currency()}`;
      
      // فتح WhatsApp Web مع الرسالة
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
      
      // حفظ الملف محلياً أولاً
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `employee-report-${employeeName}-${selectedMonth.format('YYYY-MM')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      
      // فتح WhatsApp
      window.open(whatsappUrl, '_blank');
      
      Modal.info({
        title: `📱 ${t('payroll.employeeProfile.whatsappModal.title')}`,
        content: (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="font-bold text-green-700 dark:text-green-400 mb-2">✅ {t('payroll.employeeProfile.whatsappModal.fileDownloaded')}</p>
              <p className="text-sm">{t('payroll.employeeProfile.whatsappModal.fileName')}: <strong>employee-report-{employeeName}-{selectedMonth.format('YYYY-MM')}.pdf</strong></p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="font-bold text-blue-700 dark:text-blue-400 mb-3">📋 {t('payroll.employeeProfile.whatsappModal.steps')}:</p>
              <ol className="list-decimal mr-5 space-y-2 text-sm">
                <li>{t('payroll.employeeProfile.whatsappModal.step1')}</li>
                <li>{t('payroll.employeeProfile.whatsappModal.step2')}</li>
                <li>{t('payroll.employeeProfile.whatsappModal.step3')}</li>
                <li>{t('payroll.employeeProfile.whatsappModal.step4')}</li>
              </ol>
            </div>
            
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                📞 {t('payroll.employeeProfile.whatsappModal.employeePhone')}: <strong className="text-blue-600 dark:text-blue-400">{phone}</strong>
              </p>
            </div>
          </div>
        ),
        okText: t('payroll.employeeProfile.messages.understood'),
        width: 600,
        className: 'whatsapp-modal',
      });
      
    } catch (error) {
      console.error(t('payroll.employeeProfile.messages.sendError'), error);
      message.destroy();
      message.error(t('payroll.employeeProfile.messages.sendError'));
    }
  };

  // Edit handlers
  const handleEditAttendance = (record: any) => {
    setEditingAttendance(record);
    editForm.setFieldsValue({
      date: dayjs(record.date),
      status: record.status,
      checkIn: record.checkIn ? dayjs(record.checkIn, 'HH:mm') : null,
      checkOut: record.checkOut ? dayjs(record.checkOut, 'HH:mm') : null,
      reason: record.reason,
      notes: record.notes
    });
    setEditAttendanceModalVisible(true);
  };

  const handleUpdateAttendance = async (values: any) => {
    try {
      await api.put(`/payroll/attendance/${editingAttendance._id}`, {
        status: values.status,
        checkIn: values.checkIn ? values.checkIn.format('HH:mm') : null,
        checkOut: values.checkOut ? values.checkOut.format('HH:mm') : null,
        reason: values.reason,
        notes: values.notes
      });
      message.success(t('payroll.employeeProfile.messages.updateAttendanceSuccess'));
      setEditAttendanceModalVisible(false);
      setEditingAttendance(null);
      editForm.resetFields();
      fetchEmployeeData();
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.employeeProfile.messages.updateAttendanceError'));
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    Modal.confirm({
      title: t('payroll.employeeProfile.confirmDelete.title'),
      content: t('payroll.employeeProfile.confirmDelete.attendance'),
      okText: t('payroll.employeeProfile.confirmDelete.okText'),
      cancelText: t('payroll.employeeProfile.confirmDelete.cancelText'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/payroll/attendance/${id}`);
          message.success(t('payroll.employeeProfile.messages.deleteAttendanceSuccess'));
          fetchEmployeeData();
        } catch (error: any) {
          message.error(error.response?.data?.error || t('payroll.employeeProfile.messages.deleteAttendanceError'));
        }
      }
    });
  };

  const handleEditAdvance = (advance: any) => {
    setEditingAdvance(advance);
    editForm.setFieldsValue({
      amount: advance.amount,
      reason: advance.reason,
      requestDate: dayjs(advance.requestDate)
    });
    setEditAdvanceModalVisible(true);
  };

  const handleUpdateAdvance = async (values: any) => {
    try {
      await api.put(`/payroll/advances/${editingAdvance._id}`, {
        amount: values.amount,
        reason: values.reason,
        requestDate: values.requestDate.format('YYYY-MM-DD')
      });
      message.success(t('payroll.employeeProfile.messages.updateAdvanceSuccess'));
      setEditAdvanceModalVisible(false);
      setEditingAdvance(null);
      editForm.resetFields();
      fetchEmployeeData();
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.employeeProfile.messages.updateAdvanceError'));
    }
  };

  const handleDeleteAdvance = async (id: string) => {
    Modal.confirm({
      title: t('payroll.employeeProfile.confirmDelete.title'),
      content: t('payroll.employeeProfile.confirmDelete.advance'),
      okText: t('payroll.employeeProfile.confirmDelete.okText'),
      cancelText: t('payroll.employeeProfile.confirmDelete.cancelText'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/payroll/advances/${id}`);
          message.success(t('payroll.employeeProfile.messages.deleteAdvanceSuccess'));
          fetchEmployeeData();
        } catch (error: any) {
          message.error(error.response?.data?.error || t('payroll.employeeProfile.messages.deleteAdvanceError'));
        }
      }
    });
  };

  const handleEditDeduction = (deduction: any) => {
    setEditingDeduction(deduction);
    editForm.setFieldsValue({
      amount: deduction.amount,
      reason: deduction.reason,
      type: deduction.type,
      date: dayjs(deduction.date)
    });
    setEditDeductionModalVisible(true);
  };

  const handleUpdateDeduction = async (values: any) => {
    try {
      await api.put(`/payroll/deductions/${editingDeduction._id}`, {
        amount: values.amount,
        reason: values.reason,
        type: values.type,
        date: values.date.format('YYYY-MM-DD')
      });
      message.success(t('payroll.employeeProfile.messages.updateDeductionSuccess'));
      setEditDeductionModalVisible(false);
      setEditingDeduction(null);
      editForm.resetFields();
      fetchEmployeeData();
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.employeeProfile.messages.updateDeductionError'));
    }
  };

  const handleDeleteDeduction = async (id: string) => {
    Modal.confirm({
      title: t('payroll.employeeProfile.confirmDelete.title'),
      content: t('payroll.employeeProfile.confirmDelete.deduction'),
      okText: t('payroll.employeeProfile.confirmDelete.okText'),
      cancelText: t('payroll.employeeProfile.confirmDelete.cancelText'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/payroll/deductions/${id}`);
          message.success(t('payroll.employeeProfile.messages.deleteDeductionSuccess'));
          fetchEmployeeData();
        } catch (error: any) {
          message.error(error.response?.data?.error || t('payroll.employeeProfile.messages.deleteDeductionError'));
        }
      }
    });
  };

  const handleEditPayment = (payment: any) => {
    setEditingPayment(payment);
    editForm.setFieldsValue({
      amount: payment.amount,
      method: payment.method,
      paymentDate: dayjs(payment.paymentDate),
      notes: payment.notes
    });
    setEditPaymentModalVisible(true);
  };

  const handleUpdatePayment = async (values: any) => {
    try {
      await api.put(`/payroll/payments/${editingPayment._id}`, {
        amount: values.amount,
        method: values.method,
        paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        notes: values.notes
      });
      message.success(t('payroll.employeeProfile.messages.updatePaymentSuccess'));
      setEditPaymentModalVisible(false);
      setEditingPayment(null);
      editForm.resetFields();
      fetchEmployeeData();
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.employeeProfile.messages.updatePaymentError'));
    }
  };

  const handleDeletePayment = async (id: string) => {
    Modal.confirm({
      title: t('payroll.employeeProfile.confirmDelete.title'),
      content: t('payroll.employeeProfile.confirmDelete.payment'),
      okText: t('payroll.employeeProfile.confirmDelete.okText'),
      cancelText: t('payroll.employeeProfile.confirmDelete.cancelText'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/payroll/payments/${id}`);
          message.success(t('payroll.employeeProfile.messages.deletePaymentSuccess'));
          fetchEmployeeData();
        } catch (error: any) {
          message.error(error.response?.data?.error || t('payroll.employeeProfile.messages.deletePaymentError'));
        }
      }
    });
  };

  // Attendance handlers
  const handleDatesChange = (dates: any) => {
    if (!dates || dates.length === 0) {
      setDayTimes([]);
      return;
    }
    const newDayTimes = dates.map((date: any) => ({
      date: date.format('YYYY-MM-DD'),
      checkIn: null,
      checkOut: null
    }));
    setDayTimes(newDayTimes);
  };

  const handleDayTimeChange = (index: number, field: 'checkIn' | 'checkOut', value: any) => {
    const newDayTimes = [...dayTimes];
    newDayTimes[index][field] = value;
    setDayTimes(newDayTimes);
  };

  const addTimeGroup = () => {
    const newGroup = {
      id: Date.now().toString(),
      dates: [],
      checkIn: null,
      checkOut: null
    };
    setTimeGroups([...timeGroups, newGroup]);
  };

  const removeTimeGroup = (groupId: string) => {
    setTimeGroups(timeGroups.filter(g => g.id !== groupId));
  };

  const updateTimeGroup = (groupId: string, field: string, value: any) => {
    setTimeGroups(timeGroups.map(g => 
      g.id === groupId ? { ...g, [field]: value } : g
    ));
  };

  const getAvailableDatesForGroup = (currentGroupId: string) => {
    const selectedDates = attendanceForm.getFieldValue('dates') || [];
    const usedDates = timeGroups
      .filter(g => g.id !== currentGroupId)
      .flatMap(g => g.dates);
    
    return selectedDates.filter((date: any) => 
      !usedDates.includes(date.format('YYYY-MM-DD'))
    );
  };

  const handleSubmitAttendance = async (values: any) => {
    try {
      const dates = values.dates || [];
      const status = values.status;
      const needsTimes = status === 'present' || status === 'late' || status === 'half_day';
      
      if (needsTimes) {
        if (timeMode === 'same') {
          if (!values.checkIn) {
            message.error(t('payroll.attendanceManagement.messages.checkInRequired'));
            return;
          }
        } else if (timeMode === 'different') {
          const missingTimes = dayTimes.filter(dt => !dt.checkIn);
          if (missingTimes.length > 0) {
            message.error(t('payroll.attendanceManagement.messages.checkInRequiredAll'));
            return;
          }
        } else if (timeMode === 'groups') {
          const invalidGroups = timeGroups.filter(g => !g.checkIn || g.dates.length === 0);
          if (invalidGroups.length > 0) {
            message.error(t('payroll.attendanceManagement.messages.groupsInvalid'));
            return;
          }
        }
      }
      
      let successCount = 0;
      
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const dateStr = date.format('YYYY-MM-DD');
        
        let checkIn = null, checkOut = null;
        
        if (needsTimes) {
          if (timeMode === 'same') {
            checkIn = values.checkIn;
            checkOut = values.checkOut;
          } else if (timeMode === 'different') {
            const dayTime = dayTimes.find(dt => dt.date === dateStr);
            if (dayTime) {
              checkIn = dayTime.checkIn;
              checkOut = dayTime.checkOut;
            }
          } else if (timeMode === 'groups') {
            const group = timeGroups.find(g => g.dates.includes(dateStr));
            if (group) {
              checkIn = group.checkIn;
              checkOut = group.checkOut;
            }
          }
        }
        
        const data = {
          employeeId,
          date: dateStr,
          status: values.status,
          checkIn: checkIn ? checkIn.format('HH:mm') : null,
          checkOut: checkOut ? checkOut.format('HH:mm') : null,
          reason: values.reason,
          excused: values.excused || false,
          notes: values.notes
        };

        try {
          await api.post('/payroll/attendance', data);
          successCount++;
        } catch (error: any) {
          console.error(`فشل تسجيل ${dateStr}:`, error);
        }
      }
      
      if (successCount > 0) {
        message.success(t('payroll.attendanceManagement.messages.success', { count: successCount }));
        setAttendanceModalVisible(false);
        attendanceForm.resetFields();
        setDayTimes([]);
        setTimeGroups([]);
        setTimeMode('same');
        fetchEmployeeData();
      } else {
        message.error(t('payroll.attendanceManagement.messages.error'));
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.attendanceManagement.messages.error'));
    }
  };

  // Advance handlers
  const handleSubmitAdvance = async (values: any) => {
    try {

      const payload = {
        employeeId,
        amount: values.amount,
        reason: values.reason,
        repayment: {
          method: values.repaymentMethod || 'installments',
          installments: values.installments || 1
        }
      };
      
      
      await api.post('/payroll/advances', payload);
      
      message.success(t('payroll.advanceManagement.messages.submitSuccess'));
      setAdvanceModalVisible(false);
      advanceForm.resetFields();
      fetchEmployeeData();
      
      // تحديث الصفحة الرئيسية لإظهار تاب طلبات السلف
      if (onAdvanceAdded) {
        onAdvanceAdded();
      }
    } catch (error: any) {
      console.error('Advance error:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || t('payroll.advanceManagement.messages.submitError');
      console.error('Error message:', errorMessage);
      message.error(errorMessage);
    }
  };

  // Deduction handlers
  const handleSubmitDeduction = async (values: any) => {
    try {
   
      const deductionDate = values.date || dayjs();
      const payload = {
        employeeId,
        amount: values.amount,
        reason: values.reason,
        type: values.type,
        date: deductionDate.format('YYYY-MM-DD'),
        month: deductionDate.format('YYYY-MM')
      };
      
      
      await api.post('/payroll/deductions', payload);
      
      message.success(t('payroll.deductionsManagement.messages.addSuccess'));
      setDeductionModalVisible(false);
      deductionForm.resetFields();
      fetchEmployeeData();
    } catch (error: any) {
      console.error('Deduction error:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || t('payroll.deductionsManagement.messages.addError');
      message.error(errorMessage);
    }
  };

  // Edit employee handler
  const handleEditEmployee = async (values: any) => {
    try {
      const payload = {
        personalInfo: {
          name: values.name,
          phone: values.phone,
          nationalId: values.nationalId,
          address: values.address,
          hireDate: values.hireDate ? values.hireDate.format('YYYY-MM-DD') : employee.personalInfo?.hireDate
        },
        employment: {
          department: values.department,
          position: values.position,
          type: values.type,
          status: values.status
        },
        compensation: {
          monthly: values.monthly || 0,
          daily: values.daily || 0,
          hourly: values.hourly || 0,
          overtimeHourlyRate: values.overtimeHourlyRate || 0
        }
      };

      const response = await api.put(`/payroll/employees/${employeeId}`, payload);
      
      if (response.success) {
        message.success(t('payroll.employeeProfile.messages.updateEmployeeSuccess'));
        setEditEmployeeModalVisible(false);
        editEmployeeForm.resetFields();
        fetchEmployeeData();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || t('payroll.employeeProfile.messages.updateEmployeeError');
      message.error(errorMessage);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      active: 'green', inactive: 'red', suspended: 'orange', pending: 'blue',
      approved: 'cyan', paid: 'green', completed: 'purple', rejected: 'red',
      present: 'green', absent: 'red', late: 'orange', leave: 'blue'
    };
    return colors[status] || 'default';
  };

  const getStatusName = (status: string) => {
    const statusMap: any = {
      active: t('payroll.employeeList.status.active'),
      inactive: t('payroll.employeeList.status.suspended'),
      suspended: t('payroll.employeeList.status.suspended'),
      pending: t('payroll.advanceManagement.status.pending'),
      approved: t('payroll.advanceManagement.status.approved'),
      paid: t('payroll.advanceManagement.status.paid'),
      completed: t('payroll.advanceManagement.status.completed'),
      rejected: t('payroll.advanceManagement.status.rejected'),
      present: t('payroll.attendanceManagement.status.present'),
      absent: t('payroll.attendanceManagement.status.absent'),
      late: t('payroll.attendanceManagement.status.late'),
      leave: t('payroll.attendanceManagement.status.leave'),
      half_day: t('payroll.attendanceManagement.status.half_day'),
      weekly_off: t('payroll.attendanceManagement.status.weekly_off')
    };
    return statusMap[status] || status;
  };

  const getDepartmentName = (dept: string) => {
    const deptMap: any = {
      kitchen: t('payroll.employeeList.departments.kitchen'),
      cashier: t('payroll.employeeList.departments.cashier'),
      waiter: t('payroll.employeeList.departments.waiter'),
      admin: t('payroll.employeeList.departments.admin'),
      gaming: t('payroll.employeeList.departments.gaming'),
      other: t('payroll.employeeList.departments.other')
    };
    return deptMap[dept] || dept;
  };

  const getDeductionTypeName = (type: string) => {
    const typeMap: any = {
      absence: t('payroll.deductionsManagement.types.absence'),
      late: t('payroll.deductionsManagement.types.late'),
      penalty: t('payroll.deductionsManagement.types.penalty'),
      loan: t('payroll.deductionsManagement.types.loan'),
      insurance: t('payroll.deductionsManagement.types.insurance'),
      tax: t('payroll.deductionsManagement.types.tax'),
      other: t('payroll.deductionsManagement.types.other')
    };
    return typeMap[type] || type;
  };



  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  if (!employee) {
    return (
      <Card className="dark:bg-gray-800">
        <Empty description={t('payroll.employeeProfile.empty.noEmployee')} />
      </Card>
    );
  }

  return (
    <div className="employee-profile" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col gap-4">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Button icon={<ArrowLeft size={20} />} onClick={onClose} type="text" className="dark:text-gray-300">{t('payroll.employeeProfile.back')}</Button>
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <User size={24} className="sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold dark:text-gray-100 truncate">{employee.personalInfo?.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Tag color={getStatusColor(employee.employment?.status)}>{getStatusName(employee.employment?.status)}</Tag>
                  <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm truncate">{employee.employment?.position} - {getDepartmentName(employee.employment?.department)}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Actions Section */}
          <div className="flex flex-col gap-3">
            {/* Action Buttons Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <Button 
                type="default" 
                size="large"
                icon={<Calendar size={18} />}
                onClick={() => setAttendanceModalVisible(true)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 w-full text-sm sm:text-base"
                block
              >
                {t('payroll.employeeProfile.tabs.attendance')}
              </Button>
              <Button 
                type="default" 
                size="large"
                icon={<Plus size={18} />}
                onClick={() => setAdvanceModalVisible(true)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 w-full text-sm sm:text-base"
                block
              >
                {t('payroll.employeeProfile.tabs.advances')}
              </Button>
              <Button 
                type="default" 
                size="large"
                icon={<Minus size={18} />}
                onClick={() => setDeductionModalVisible(true)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 w-full text-sm sm:text-base"
                block
              >
                {t('payroll.employeeProfile.tabs.deductions')}
              </Button>
            </div>
            
            {/* Month Picker Row */}
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg w-full sm:w-auto">
              <span className="text-gray-600 dark:text-gray-300 text-sm whitespace-nowrap">{t('payroll.employeeProfile.month')}:</span>
              <DatePicker 
                picker="month" 
                value={selectedMonth} 
                onChange={(date) => date && setSelectedMonth(date)} 
                format="MMMM YYYY" 
                className="dark:bg-gray-700 dark:border-gray-600 flex-1 sm:flex-initial" 
                style={{ minWidth: 150 }} 
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Employee Information Card */}
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
          <h3 className="text-base sm:text-lg font-bold dark:text-gray-100 flex items-center gap-2">
            <User size={18} className="sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            {t('payroll.employeeProfile.employeeData')}
          </h3>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              type="default"
              icon={<Edit size={16} />}
              onClick={() => {
                editEmployeeForm.setFieldsValue({
                  name: employee.personalInfo?.name,
                  phone: employee.personalInfo?.phone,
                  nationalId: employee.personalInfo?.nationalId,
                  address: employee.personalInfo?.address,
                  hireDate: employee.personalInfo?.hireDate ? dayjs(employee.personalInfo.hireDate) : null,
                  department: employee.employment?.department,
                  position: employee.employment?.position,
                  type: employee.employment?.type,
                  status: employee.employment?.status,
                  monthly: employee.compensation?.monthly,
                  daily: employee.compensation?.daily,
                  hourly: employee.compensation?.hourly,
                  overtimeHourlyRate: employee.compensation?.overtimeHourlyRate
                });
                setEditEmployeeModalVisible(true);
              }}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 w-full sm:w-auto text-sm"
            >
              {t('payroll.employeeProfile.editData')}
            </Button>
            <Button 
              type="primary"
              icon={showFinancials ? <Minus size={16} /> : <Plus size={16} />}
              onClick={() => setShowFinancials(!showFinancials)}
              className="w-full sm:w-auto text-sm"
            >
              {showFinancials ? t('payroll.employeeProfile.hideFinancials') : t('payroll.employeeProfile.showFinancials')}
            </Button>
          </div>
        </div>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('payroll.employeeProfile.name')}</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{employee.personalInfo?.name}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('payroll.employeeProfile.phone')}</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{employee.personalInfo?.phone || '-'}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('payroll.employeeProfile.nationalId')}</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{employee.personalInfo?.nationalId || '-'}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('payroll.employeeProfile.hireDate')}</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">
                {employee.personalInfo?.hireDate ? dayjs(employee.personalInfo.hireDate).format('DD/MM/YYYY') : '-'}
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('payroll.employeeProfile.department')}</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{getDepartmentName(employee.employment?.department)}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('payroll.employeeProfile.position')}</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{employee.employment?.position}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('payroll.employeeProfile.employmentType')}</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">
                {employee.employment?.type === 'monthly' ? t('payroll.employeeList.employmentTypes.monthly') : employee.employment?.type === 'daily' ? t('payroll.employeeList.employmentTypes.daily') : t('payroll.employeeList.employmentTypes.hourly')}
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('payroll.employeeProfile.status')}</div>
              <div>
                <Tag color={getStatusColor(employee.employment?.status)}>
                  {getStatusName(employee.employment?.status)}
                </Tag>
              </div>
            </div>
          </Col>
          
          {showFinancials && (
            <>
              <Col xs={24}>
                <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                <h4 className="text-md font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <DollarSign size={18} className="text-green-600" />
                  {t('payroll.employeeProfile.financialData')}
                </h4>
              </Col>
              {employee.employment?.type === 'monthly' && (
                <Col xs={24} sm={12} md={8}>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">{t('payroll.employeeProfile.monthlySalary')}</div>
                    <div className="font-bold text-lg text-green-700 dark:text-green-400">
                      {toArabicNumbers(employee.compensation?.monthly || 0)} {currency()}
                    </div>
                  </div>
                </Col>
              )}
              {employee.employment?.type === 'daily' && (
                <Col xs={24} sm={12} md={8}>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">{t('payroll.employeeProfile.dailyWage')}</div>
                    <div className="font-bold text-lg text-green-700 dark:text-green-400">
                      {toArabicNumbers(employee.compensation?.daily || 0)} {currency()}
                    </div>
                  </div>
                </Col>
              )}
              {employee.employment?.type === 'hourly' && (
                <Col xs={24} sm={12} md={8}>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">{t('payroll.employeeProfile.hourlyWage')}</div>
                    <div className="font-bold text-lg text-green-700 dark:text-green-400">
                      {toArabicNumbers(employee.compensation?.hourly || 0)} {currency()}
                    </div>
                  </div>
                </Col>
              )}
              {employee.compensation?.overtimeHourlyRate > 0 && (
                <Col xs={24} sm={12} md={8}>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">{t('payroll.employeeProfile.overtimeRate')}</div>
                    <div className="font-bold text-lg text-blue-700 dark:text-blue-400">
                      {toArabicNumbers(employee.compensation?.overtimeHourlyRate || 0)} {currency()}
                    </div>
                  </div>
                </Col>
              )}
            </>
          )}
        </Row>
      </Card>

      {showFinancials && (
        <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} sm={12} md={8} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <Statistic title={<span className="dark:text-gray-300 text-xs sm:text-sm">{t('payroll.employeeProfile.carriedForward')}</span>} value={toArabicNumbers(stats.carriedForward.toFixed(2))} suffix={currency()} prefix={<TrendingUp size={16} className="sm:w-[18px] sm:h-[18px]" />} valueStyle={{ color: stats.carriedForward > 0 ? '#fa8c16' : '#8c8c8c', fontSize: '18px' }} className="[&_.ant-statistic-content]:text-base sm:[&_.ant-statistic-content]:text-lg" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <Statistic title={<span className="dark:text-gray-300 text-xs sm:text-sm">{t('payroll.employeeProfile.currentMonthSalary')}</span>} value={toArabicNumbers(stats.currentMonthSalary.toFixed(2))} suffix={currency()} prefix={<DollarSign size={16} className="sm:w-[18px] sm:h-[18px]" />} valueStyle={{ color: '#52c41a', fontSize: '18px' }} className="[&_.ant-statistic-content]:text-base sm:[&_.ant-statistic-content]:text-lg" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <Statistic title={<span className="dark:text-gray-300 text-xs sm:text-sm">{t('payroll.employeeProfile.monthAdvances')}</span>} value={toArabicNumbers(stats.currentMonthAdvances.toFixed(2))} suffix={currency()} prefix={<AlertCircle size={16} className="sm:w-[18px] sm:h-[18px]" />} valueStyle={{ color: '#faad14', fontSize: '18px' }} className="[&_.ant-statistic-content]:text-base sm:[&_.ant-statistic-content]:text-lg" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <Statistic title={<span className="dark:text-gray-300 text-xs sm:text-sm">{t('payroll.employeeProfile.monthDeductions')}</span>} value={toArabicNumbers(stats.currentMonthDeductions.toFixed(2))} suffix={currency()} prefix={<AlertCircle size={16} className="sm:w-[18px] sm:h-[18px]" />} valueStyle={{ color: '#ff4d4f', fontSize: '18px' }} className="[&_.ant-statistic-content]:text-base sm:[&_.ant-statistic-content]:text-lg" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <Statistic title={<span className="dark:text-gray-300 text-xs sm:text-sm">{t('payroll.employeeProfile.paidSalary')}</span>} value={toArabicNumbers(stats.currentMonthPaid.toFixed(2))} suffix={currency()} prefix={<Wallet size={16} className="sm:w-[18px] sm:h-[18px]" />} valueStyle={{ color: '#722ed1', fontSize: '18px' }} className="[&_.ant-statistic-content]:text-base sm:[&_.ant-statistic-content]:text-lg" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <Statistic title={<span className="dark:text-gray-300 text-xs sm:text-sm font-bold">{t('payroll.employeeProfile.availableBalance')}</span>} value={toArabicNumbers(stats.remainingBalance.toFixed(2))} suffix={currency()} prefix={<Wallet size={16} className="sm:w-[18px] sm:h-[18px]" />} valueStyle={{ color: '#1890ff', fontSize: '20px', fontWeight: 'bold' }} className="[&_.ant-statistic-content]:text-lg sm:[&_.ant-statistic-content]:text-xl" />
          </Card>
        </Col>
      </Row>
      )}

      {showFinancials && (
        <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold dark:text-gray-100">{t('payroll.employeeProfile.availableBalanceTitle')}</h3>
              <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 mt-2">{toArabicNumbers(stats.remainingBalance.toFixed(2))} {currency()}</p>
              {!isCurrentMonth && (
                <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 mt-1">
                  {t('payroll.employeeProfile.cannotPayNonCurrentMonth')}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              <Button 
                type="default"
                size="large" 
                icon={<Download size={18} />} 
                onClick={handleExportPDF}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 w-full text-sm"
                block
              >
                {t('payroll.employeeProfile.exportPDF')}
              </Button>
              <Button 
                type="default"
                size="large" 
                icon={<MessageCircle size={18} />} 
                onClick={handleSendWhatsApp}
                className="w-full text-sm"
                style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: 'white' }}
                block
              >
                {t('payroll.employeeProfile.sendWhatsApp')}
              </Button>
              <Button 
                type="primary" 
                size="large" 
                icon={<Wallet size={18} />} 
                onClick={() => setPaymentModalVisible(true)} 
                disabled={stats.remainingBalance <= 0 || !isCurrentMonth}
                className="w-full text-sm sm:col-span-2 lg:col-span-1"
                block
              >
                {t('payroll.employeeProfile.payPartialSalary')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs للتقارير */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <Tabs 
          defaultActiveKey="1" 
          className="dark:text-gray-200"
          items={[
            {
              key: '1',
              label: t('payroll.employeeProfile.tabs.attendance'),
              children: (
                <Table
                  dataSource={attendance}
                  rowKey="_id"
                  loading={loading}
                  locale={{ emptyText: t('payroll.employeeProfile.empty.attendance') }}
                  pagination={{ pageSize: 10 }}
                  className="dark:bg-gray-800"
                  scroll={{ x: 800 }}
                >
                  <Table.Column
                    title={t('payroll.employeeProfile.table.date')}
                    dataIndex="date"
                    key="date"
                    render={(date) => dayjs(date).format('DD/MM/YYYY')}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.day')}
                    dataIndex="day"
                    key="day"
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.status')}
                    dataIndex="status"
                    key="status"
                    render={(status) => (
                      <Tag color={getStatusColor(status)}>
                        {getStatusName(status)}
                      </Tag>
                    )}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.checkIn')}
                    dataIndex="checkIn"
                    key="checkIn"
                    render={(time) => time || '-'}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.checkOut')}
                    dataIndex="checkOut"
                    key="checkOut"
                    render={(time) => time || '-'}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.hours')}
                    dataIndex="hours"
                    key="hours"
                    render={(hours) => hours ? toArabicNumbers(hours.toFixed(1)) : '-'}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.dailySalary')}
                    dataIndex="dailySalary"
                    key="dailySalary"
                    render={(salary) => salary ? `${toArabicNumbers(salary.toFixed(2))} ${currency()}` : '-'}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.actions')}
                    key="actions"
                    render={(_, record: any) => (
                      <div className="flex gap-2">
                        <Button
                          type="link"
                          icon={<Edit size={16} />}
                          onClick={() => handleEditAttendance(record)}
                          className="dark:text-blue-400"
                        >
                          {t('payroll.employeeProfile.table.edit')}
                        </Button>
                        <Button
                          type="link"
                          danger
                          icon={<Trash2 size={16} />}
                          onClick={() => handleDeleteAttendance(record._id)}
                          className="dark:text-red-400"
                        >
                          {t('payroll.employeeProfile.table.delete')}
                        </Button>
                      </div>
                    )}
                  />
                </Table>
              )
            },
            {
              key: '2',
              label: t('payroll.employeeProfile.tabs.advances'),
              children: (
                <Table
                  dataSource={advances}
                  rowKey="_id"
                  loading={loading}
                  locale={{ emptyText: t('payroll.employeeProfile.empty.advances') }}
                  pagination={{ pageSize: 10 }}
                  className="dark:bg-gray-800"
                  scroll={{ x: 700 }}
                >
                  <Table.Column
                    title={t('payroll.employeeProfile.table.date')}
                    dataIndex="requestDate"
                    key="requestDate"
                    render={(date) => dayjs(date).format('DD/MM/YYYY')}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.amount')}
                    dataIndex="amount"
                    key="amount"
                    render={(amount) => `${toArabicNumbers(amount)} ${currency()}`}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.reason')}
                    dataIndex="reason"
                    key="reason"
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.status')}
                    dataIndex="status"
                    key="status"
                    render={(status) => (
                      <Tag color={getStatusColor(status)}>
                        {getStatusName(status)}
                      </Tag>
                    )}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.remaining')}
                    key="remaining"
                    render={(_, record: any) => 
                      record.repayment?.remainingAmount 
                        ? `${toArabicNumbers(record.repayment.remainingAmount)} ${currency()}`
                        : '-'
                    }
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.actions')}
                    key="actions"
                    render={(_, record: any) => (
                      <div className="flex gap-2">
                        <Button
                          type="link"
                          icon={<Edit size={16} />}
                          onClick={() => handleEditAdvance(record)}
                          className="dark:text-blue-400"
                        >
                          {t('payroll.employeeProfile.table.edit')}
                        </Button>
                        <Button
                          type="link"
                          danger
                          icon={<Trash2 size={16} />}
                          onClick={() => handleDeleteAdvance(record._id)}
                          className="dark:text-red-400"
                        >
                          {t('payroll.employeeProfile.table.delete')}
                        </Button>
                      </div>
                    )}
                  />
                </Table>
              )
            },
            {
              key: '3',
              label: t('payroll.employeeProfile.tabs.deductions'),
              children: (
                <Table
                  dataSource={deductions}
                  rowKey="_id"
                  loading={loading}
                  locale={{ emptyText: t('payroll.employeeProfile.empty.deductions') }}
                  pagination={{ pageSize: 10 }}
                  className="dark:bg-gray-800"
                  scroll={{ x: 600 }}
                >
                  <Table.Column
                    title={t('payroll.employeeProfile.table.date')}
                    dataIndex="date"
                    key="date"
                    render={(date) => dayjs(date).format('DD/MM/YYYY')}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.type')}
                    dataIndex="type"
                    key="type"
                    render={(type) => getDeductionTypeName(type)}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.amount')}
                    dataIndex="amount"
                    key="amount"
                    render={(amount) => `${toArabicNumbers(amount)} ${currency()}`}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.reason')}
                    dataIndex="reason"
                    key="reason"
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.actions')}
                    key="actions"
                    render={(_, record: any) => (
                      <div className="flex gap-2">
                        <Button
                          type="link"
                          icon={<Edit size={16} />}
                          onClick={() => handleEditDeduction(record)}
                          className="dark:text-blue-400"
                        >
                          {t('payroll.employeeProfile.table.edit')}
                        </Button>
                        <Button
                          type="link"
                          danger
                          icon={<Trash2 size={16} />}
                          onClick={() => handleDeleteDeduction(record._id)}
                          className="dark:text-red-400"
                        >
                          {t('payroll.employeeProfile.table.delete')}
                        </Button>
                      </div>
                    )}
                  />
                </Table>
              )
            },
            {
              key: '4',
              label: t('payroll.employeeProfile.tabs.payments'),
              children: (
                <Table
                  dataSource={payments}
                  rowKey="_id"
                  loading={loading}
                  locale={{ emptyText: t('payroll.employeeProfile.empty.payments') }}
                  pagination={{ pageSize: 10 }}
                  className="dark:bg-gray-800"
                  scroll={{ x: 600 }}
                >
                  <Table.Column
                    title={t('payroll.employeeProfile.table.date')}
                    dataIndex="paymentDate"
                    key="paymentDate"
                    render={(date) => dayjs(date).format('DD/MM/YYYY')}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.amount')}
                    dataIndex="amount"
                    key="amount"
                    render={(amount) => `${toArabicNumbers(amount)} ${currency()}`}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.method')}
                    dataIndex="method"
                    key="method"
                    render={(method) => t(`payroll.employeeProfile.paymentMethods.${method}`)}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.notes')}
                    dataIndex="notes"
                    key="notes"
                    render={(notes) => notes || '-'}
                  />
                  <Table.Column
                    title={t('payroll.employeeProfile.table.actions')}
                    key="actions"
                    render={(_, record: any) => (
                      <div className="flex gap-2">
                        <Button
                          type="link"
                          icon={<Edit size={16} />}
                          onClick={() => handleEditPayment(record)}
                          className="dark:text-blue-400"
                        >
                          {t('payroll.employeeProfile.table.edit')}
                        </Button>
                        <Button
                          type="link"
                          danger
                          icon={<Trash2 size={16} />}
                          onClick={() => handleDeletePayment(record._id)}
                          className="dark:text-red-400"
                        >
                          {t('payroll.employeeProfile.table.delete')}
                        </Button>
                      </div>
                    )}
                  />
                </Table>
              )
            }
          ]}
        />
      </Card>

      {/* Edit Modals */}
      {/* Modal تعديل الحضور */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Edit size={20} />
            <span>{t('payroll.attendanceManagement.editAttendance')}</span>
          </div>
        }
        open={editAttendanceModalVisible}
        onCancel={() => {
          setEditAttendanceModalVisible(false);
          setEditingAttendance(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        className="professional-modal info-modal"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateAttendance}>
          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.date')}</span>}
            name="date"
          >
            <DatePicker 
              style={{ width: '100%' }} 
              format="YYYY-MM-DD" 
              className="dark:bg-gray-700 dark:border-gray-600"
              disabled
              size="large"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.status')}</span>}
            name="status"
            rules={[{ required: true, message: t('payroll.attendanceManagement.messages.statusRequired') }]}
          >
            <Select className="dark:bg-gray-700" size="large">
              <Option value="present">{t('payroll.attendanceManagement.status.present')}</Option>
              <Option value="absent">{t('payroll.attendanceManagement.status.absent')}</Option>
              <Option value="late">{t('payroll.attendanceManagement.status.late')}</Option>
              <Option value="leave">{t('payroll.attendanceManagement.status.leave')}</Option>
              <Option value="half_day">{t('payroll.attendanceManagement.status.half_day')}</Option>
              <Option value="weekly_off">{t('payroll.attendanceManagement.status.weekly_off')}</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.checkIn')}</span>} 
                name="checkIn"
              >
                <TimePicker 
                  style={{ width: '100%' }} 
                  format="hh:mm A"
                  use12Hours
                  className="dark:bg-gray-700 dark:border-gray-600"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.checkOut')}</span>} 
                name="checkOut"
              >
                <TimePicker 
                  style={{ width: '100%' }} 
                  format="hh:mm A"
                  use12Hours
                  className="dark:bg-gray-700 dark:border-gray-600"
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item 
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.reason')}</span>} 
            name="reason"
          >
            <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" size="large" />
          </Form.Item>

          <Form.Item label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.notes')}</span>} name="notes">
            <TextArea rows={3} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" size="large">
                {t('common.save')}
              </Button>
              <Button onClick={() => {
                setEditAttendanceModalVisible(false);
                setEditingAttendance(null);
                editForm.resetFields();
              }} size="large">
                {t('common.cancel')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal تعديل السلفة */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Edit size={20} />
            <span>{t('payroll.advanceManagement.editAdvance')}</span>
          </div>
        }
        open={editAdvanceModalVisible}
        onCancel={() => {
          setEditAdvanceModalVisible(false);
          setEditingAdvance(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        className="professional-modal warning-modal"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateAdvance}>
          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.amount')}</span>}
            name="amount"
            rules={[{ required: true, message: t('payroll.advanceManagement.messages.amountRequired') }]}
          >
            <InputNumber
              {...numberOnlyInputProps} style={{ width: '100%' }}
              min={0}
              className="dark:bg-gray-700 dark:border-gray-600"
              size="large"
              prefix={<DollarSign size={16} className="text-gray-400" />}
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.reason')}</span>}
            name="reason"
            rules={[{ required: true, message: t('payroll.advanceManagement.messages.reasonRequired') }]}
          >
            <TextArea rows={3} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.advanceManagement.requestDate')}</span>}
            name="requestDate"
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              className="dark:bg-gray-700 dark:border-gray-600"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" size="large">
                {t('common.save')}
              </Button>
              <Button onClick={() => {
                setEditAdvanceModalVisible(false);
                setEditingAdvance(null);
                editForm.resetFields();
              }} size="large">
                {t('common.cancel')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal تعديل الخصم */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Edit size={20} />
            <span>{t('payroll.deductionsManagement.editDeduction')}</span>
          </div>
        }
        open={editDeductionModalVisible}
        onCancel={() => {
          setEditDeductionModalVisible(false);
          setEditingDeduction(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        className="professional-modal danger-modal"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateDeduction}>
          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.type')}</span>}
            name="type"
            rules={[{ required: true, message: t('payroll.deductionsManagement.messages.typeRequired') }]}
          >
            <Select className="dark:bg-gray-700" size="large">
              <Option value="absence">{t('payroll.deductionsManagement.types.absence')}</Option>
              <Option value="late">{t('payroll.attendanceManagement.status.late')}</Option>
              <Option value="penalty">{t('payroll.deductionsManagement.types.penalty')}</Option>
              <Option value="loan">{t('payroll.deductionsManagement.types.loan')}</Option>
              <Option value="insurance">{t('payroll.deductionsManagement.types.insurance')}</Option>
              <Option value="tax">{t('payroll.deductionsManagement.types.tax')}</Option>
              <Option value="other">{t('payroll.deductionsManagement.types.other')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.amount')}</span>}
            name="amount"
            rules={[{ required: true, message: t('payroll.advanceManagement.messages.amountRequired') }]}
          >
            <InputNumber
              {...numberOnlyInputProps} style={{ width: '100%' }}
              min={0}
              className="dark:bg-gray-700 dark:border-gray-600"
              size="large"
              prefix={<DollarSign size={16} className="text-gray-400" />}
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.date')}</span>}
            name="date"
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              className="dark:bg-gray-700 dark:border-gray-600"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.reason')}</span>}
            name="reason"
            rules={[{ required: true, message: t('payroll.advanceManagement.messages.reasonRequired') }]}
          >
            <TextArea rows={3} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" size="large">
                {t('common.save')}
              </Button>
              <Button onClick={() => {
                setEditDeductionModalVisible(false);
                setEditingDeduction(null);
                editForm.resetFields();
              }} size="large">
                {t('common.cancel')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal تعديل الدفعة */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Edit size={20} />
            <span>{t('payroll.payrollHistory.editPayment')}</span>
          </div>
        }
        open={editPaymentModalVisible}
        onCancel={() => {
          setEditPaymentModalVisible(false);
          setEditingPayment(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        className="professional-modal success-modal"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdatePayment}>
          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.amount')}</span>}
            name="amount"
            rules={[{ required: true, message: t('payroll.advanceManagement.messages.amountRequired') }]}
          >
            <InputNumber
              {...numberOnlyInputProps} style={{ width: '100%' }}
              min={0}
              className="dark:bg-gray-700 dark:border-gray-600"
              size="large"
              prefix={<DollarSign size={16} className="text-gray-400" />}
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.method')}</span>}
            name="method"
          >
            <Select className="dark:bg-gray-700" size="large">
              <Option value="cash">{t('payroll.employeeProfile.paymentMethods.cash')}</Option>
              <Option value="card">{t('payroll.employeeProfile.paymentMethods.card')}</Option>
              <Option value="transfer">{t('payroll.employeeProfile.paymentMethods.transfer')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.payrollHistory.paymentDate')}</span>}
            name="paymentDate"
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              className="dark:bg-gray-700 dark:border-gray-600"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.notes')}</span>}
            name="notes"
          >
            <TextArea rows={3} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" size="large">
                {t('common.save')}
              </Button>
              <Button onClick={() => {
                setEditPaymentModalVisible(false);
                setEditingPayment(null);
                editForm.resetFields();
              }}>
                {t('common.cancel')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal 
        title={
          <div className="flex items-center gap-2">
            <Wallet size={20} />
            <span>{t('payroll.employeeProfile.payPartialSalary')}</span>
          </div>
        }
        open={paymentModalVisible} 
        onCancel={() => { 
          setPaymentModalVisible(false); 
          setPaymentAmount(0); 
          setPaymentDate(dayjs()); 
        }} 
        onOk={handlePayment} 
        okText={t('payroll.payrollHistory.pay')} 
        cancelText={t('common.cancel')} 
        className="professional-modal success-modal"
        width={500}
      >
        <div className="space-y-4">
          <div className="info-box success">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={18} />
              <span className="font-bold">{t('payroll.employeeProfile.availableBalance')}</span>
            </div>
            <div className="text-2xl font-bold">{toArabicNumbers(stats.remainingBalance.toFixed(2))} {currency()}</div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">{t('payroll.payrollHistory.amountToPay')}</label>
            <InputNumber 
              {...numberOnlyInputProps}
              value={paymentAmount} 
              onChange={(value) => setPaymentAmount(value || 0)} 
              min={0} 
              max={stats.remainingBalance} 
              style={{ width: '100%' }} 
              className="dark:bg-gray-700 dark:border-gray-600" 
              placeholder={t('payroll.advanceManagement.enterAmount')}
              size="large"
              prefix={<DollarSign size={16} className="text-gray-400" />}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">{t('payroll.payrollHistory.paymentDate')}</label>
            <DatePicker 
              value={paymentDate} 
              onChange={(date) => date && setPaymentDate(date)} 
              format="YYYY-MM-DD" 
              style={{ width: '100%' }} 
              className="dark:bg-gray-700 dark:border-gray-600"
              placeholder={t('payroll.payrollHistory.selectPaymentDate')}
              size="large"
              disabledDate={(current) => {
                if (!current) return false;
                const today = dayjs();
                const currentMonthStart = selectedMonth.startOf('month');
                const currentMonthEnd = selectedMonth.endOf('month');
                
                if (current.isAfter(today, 'day')) return true;
                if (current.isBefore(currentMonthStart, 'day') || current.isAfter(currentMonthEnd, 'day')) return true;
                
                return false;
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Modal تسجيل الحضور */}
      {/* Modal تسجيل حضور */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Calendar size={20} />
            <span>{t('payroll.attendanceManagement.addAttendance')}</span>
          </div>
        }
        open={attendanceModalVisible}
        onCancel={() => {
          setAttendanceModalVisible(false);
          attendanceForm.resetFields();
          setDayTimes([]);
          setTimeGroups([]);
          setTimeMode('same');
        }}
        footer={null}
        width={800}
        className="professional-modal info-modal"
      >
        <Form form={attendanceForm} layout="vertical" onFinish={handleSubmitAttendance}>
          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.attendanceManagement.selectDays')}</span>}
            name="dates"
            rules={[{ required: true, message: t('payroll.attendanceManagement.messages.daysRequired') }]}
          >
            <DatePicker
              multiple
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              className="dark:bg-gray-700 dark:border-gray-600"
              placeholder={t('payroll.attendanceManagement.selectDaysPlaceholder')}
              onChange={handleDatesChange}
              size="large"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.status')}</span>}
            name="status"
            rules={[{ required: true, message: t('payroll.attendanceManagement.messages.statusRequired') }]}
          >
            <Select className="dark:bg-gray-700" size="large">
              <Option value="present">{t('payroll.attendanceManagement.status.present')}</Option>
              <Option value="absent">{t('payroll.attendanceManagement.status.absent')}</Option>
              <Option value="late">{t('payroll.attendanceManagement.status.late')}</Option>
              <Option value="leave">{t('payroll.attendanceManagement.status.leave')}</Option>
              <Option value="half_day">{t('payroll.attendanceManagement.status.half_day')}</Option>
              <Option value="weekly_off">{t('payroll.attendanceManagement.status.weekly_off')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.status !== currentValues.status || prevValues.dates !== currentValues.dates}
          >
            {({ getFieldValue }) => {
              const status = getFieldValue('status');
              const dates = getFieldValue('dates') || [];
              
              return (
                <>
                  {(status === 'present' || status === 'late' || status === 'half_day') && dates.length > 0 && (
                    <>
                      {dates.length > 1 && (
                        <div className="mb-4 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-700 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
                            <span className="text-base font-bold text-blue-900 dark:text-blue-200">
                              {t('payroll.attendanceManagement.selectTimeMode')}:
                            </span>
                          </div>
                          <div className="flex flex-col gap-3">
                            <label 
                              className={`flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all duration-300 ${
                                timeMode === 'same' 
                                  ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/40 shadow-md scale-[1.02]' 
                                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                              }`}
                            >
                              <input
                                type="radio"
                                checked={timeMode === 'same'}
                                onChange={() => setTimeMode('same')}
                                className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className={`font-bold text-base mb-1 ${
                                  timeMode === 'same' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'
                                }`}>
                                  ⏰ {t('payroll.attendanceManagement.sameTimeForAll')}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {t('payroll.attendanceManagement.sameTimeDescription')}
                                </div>
                              </div>
                              {timeMode === 'same' && (
                                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </label>
                            
                            <label 
                              className={`flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all duration-300 ${
                                timeMode === 'groups' 
                                  ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40 shadow-md scale-[1.02]' 
                                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                              }`}
                            >
                              <input
                                type="radio"
                                checked={timeMode === 'groups'}
                                onChange={() => {
                                  setTimeMode('groups');
                                  if (timeGroups.length === 0) {
                                    addTimeGroup();
                                  }
                                }}
                                className="w-5 h-5 text-purple-600 focus:ring-purple-500"
                              />
                              <div className="flex-1">
                                <div className={`font-bold text-base mb-1 ${
                                  timeMode === 'groups' ? 'text-purple-700 dark:text-purple-300' : 'text-gray-800 dark:text-gray-200'
                                }`}>
                                  📋 {t('payroll.attendanceManagement.groupsWithDifferentTimes')}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {t('payroll.attendanceManagement.groupsDescription')}
                                </div>
                              </div>
                              {timeMode === 'groups' && (
                                <div className="flex-shrink-0 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </label>
                            
                            <label 
                              className={`flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all duration-300 ${
                                timeMode === 'different' 
                                  ? 'border-green-500 bg-green-100 dark:bg-green-900/40 shadow-md scale-[1.02]' 
                                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                              }`}
                            >
                              <input
                                type="radio"
                                checked={timeMode === 'different'}
                                onChange={() => setTimeMode('different')}
                                className="w-5 h-5 text-green-600 focus:ring-green-500"
                              />
                              <div className="flex-1">
                                <div className={`font-bold text-base mb-1 ${
                                  timeMode === 'different' ? 'text-green-700 dark:text-green-300' : 'text-gray-800 dark:text-gray-200'
                                }`}>
                                  📅 {t('payroll.attendanceManagement.differentTimePerDay')}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {t('payroll.attendanceManagement.differentTimeDescription')}
                                </div>
                              </div>
                              {timeMode === 'different' && (
                                <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </label>
                          </div>
                        </div>
                      )}

                      {timeMode === 'same' && (
                        <div className="mb-4">
                          <div className="form-section-header mb-3">
                            <Calendar size={18} />
                            <span>{t('payroll.attendanceManagement.checkInOutTimes')}</span>
                          </div>
                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item 
                                label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.checkIn')}</span>} 
                                name="checkIn"
                                rules={status === 'present' || status === 'late' ? [{ required: true, message: t('common.required') }] : []}
                              >
                                <TimePicker 
                                  style={{ width: '100%' }} 
                                  format="hh:mm A"
                                  use12Hours
                                  className="dark:bg-gray-700 dark:border-gray-600"
                                  placeholder={t('payroll.attendanceManagement.selectTime')}
                                  size="large"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item 
                                label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.checkOut')}</span>} 
                                name="checkOut"
                              >
                                <TimePicker 
                                  style={{ width: '100%' }} 
                                  format="hh:mm A"
                                  use12Hours
                                  className="dark:bg-gray-700 dark:border-gray-600"
                                  placeholder={t('payroll.attendanceManagement.selectTime')}
                                  size="large"
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                        </div>
                      )}

                      {timeMode === 'groups' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                              {t('payroll.attendanceManagement.groups')} ({toArabicNumbers(timeGroups.length)})
                            </span>
                            <Button 
                              type="dashed" 
                              size="small"
                              onClick={addTimeGroup}
                              className="dark:border-gray-600 dark:text-gray-200"
                            >
                              + {t('payroll.attendanceManagement.addGroup')}
                            </Button>
                          </div>
                          
                          <div className="space-y-3 max-h-96 overflow-y-auto p-3 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                            {timeGroups.map((group, index) => {
                              const availableDates = getAvailableDatesForGroup(group.id);
                              return (
                                <Card 
                                  key={group.id}
                                  size="small"
                                  className="dark:bg-gray-700 dark:border-gray-600 shadow-sm"
                                  extra={
                                    timeGroups.length > 1 && (
                                      <Button
                                        type="text"
                                        danger
                                        size="small"
                                        onClick={() => removeTimeGroup(group.id)}
                                      >
                                        {t('common.delete')}
                                      </Button>
                                    )
                                  }
                                  title={
                                    <span className="dark:text-gray-200">
                                      {t('payroll.attendanceManagement.group')} {toArabicNumbers(index + 1)}
                                    </span>
                                  }
                                >
                                  <div className="space-y-3">
                                    <div>
                                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        {t('payroll.attendanceManagement.selectDaysRequired')}
                                      </div>
                                      <Select
                                        mode="multiple"
                                        style={{ width: '100%' }}
                                        placeholder={t('payroll.attendanceManagement.selectDaysForGroup')}
                                        value={group.dates}
                                        onChange={(values) => updateTimeGroup(group.id, 'dates', values)}
                                        className="dark:bg-gray-600"
                                      >
                                        {availableDates.map((date: any) => (
                                          <Option key={date.format('YYYY-MM-DD')} value={date.format('YYYY-MM-DD')}>
                                            {date.format('DD/MM/YYYY - dddd')}
                                          </Option>
                                        ))}
                                        {group.dates.map((dateStr: string) => {
                                          const date = dayjs(dateStr);
                                          const isAvailable = availableDates.some((d: any) => d.format('YYYY-MM-DD') === dateStr);
                                          if (!isAvailable) {
                                            return (
                                              <Option key={dateStr} value={dateStr}>
                                                {date.format('DD/MM/YYYY - dddd')}
                                              </Option>
                                            );
                                          }
                                          return null;
                                        })}
                                      </Select>
                                    </div>
                                    
                                    <Row gutter={8}>
                                      <Col span={12}>
                                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                          {t('payroll.attendanceManagement.checkInRequired')}
                                        </div>
                                        <TimePicker
                                          style={{ width: '100%' }}
                                          format="hh:mm A"
                                          use12Hours
                                          placeholder={t('payroll.attendanceManagement.selectTime')}
                                          value={group.checkIn}
                                          onChange={(time) => updateTimeGroup(group.id, 'checkIn', time)}
                                          className="dark:bg-gray-600 dark:border-gray-500"
                                        />
                                      </Col>
                                      <Col span={12}>
                                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                          {t('payroll.attendanceManagement.checkOut')}
                                        </div>
                                        <TimePicker
                                          style={{ width: '100%' }}
                                          format="hh:mm A"
                                          use12Hours
                                          placeholder={t('payroll.attendanceManagement.selectTime')}
                                          value={group.checkOut}
                                          onChange={(time) => updateTimeGroup(group.id, 'checkOut', time)}
                                          className="dark:bg-gray-600 dark:border-gray-500"
                                        />
                                      </Col>
                                    </Row>
                                    
                                    {group.dates.length > 0 && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                                        {toArabicNumbers(group.dates.length)} {t('payroll.attendanceManagement.daySelected')}
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {timeMode === 'different' && dayTimes.length > 0 && (
                        <div className="space-y-3 max-h-96 overflow-y-auto p-3 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                          <div className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-200 sticky top-0 bg-gray-50 dark:bg-gray-900/50 pb-2">
                            {t('payroll.attendanceManagement.setTimesForEachDay')}:
                          </div>
                          {dayTimes.map((dayTime, index) => (
                            <Card 
                              key={dayTime.date} 
                              size="small"
                              className="dark:bg-gray-700 dark:border-gray-600 shadow-sm"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <div className="font-bold text-base dark:text-gray-100">
                                    {dayjs(dayTime.date).format('DD/MM/YYYY')}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {dayjs(dayTime.date).format('dddd')}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                  {t('payroll.attendanceManagement.day')} {toArabicNumbers(index + 1)} {t('common.from')} {toArabicNumbers(dayTimes.length)}
                                </div>
                              </div>
                              <Row gutter={8}>
                                <Col span={12}>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('payroll.attendanceManagement.checkInRequired')}</div>
                                  <TimePicker
                                    style={{ width: '100%' }}
                                    format="hh:mm A"
                                    use12Hours
                                    placeholder={t('payroll.attendanceManagement.selectTime')}
                                    value={dayTime.checkIn}
                                    onChange={(time) => handleDayTimeChange(index, 'checkIn', time)}
                                    className="dark:bg-gray-600 dark:border-gray-500"
                                    size="large"
                                  />
                                </Col>
                                <Col span={12}>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('payroll.attendanceManagement.checkOut')}</div>
                                  <TimePicker
                                    style={{ width: '100%' }}
                                    format="hh:mm A"
                                    use12Hours
                                    placeholder={t('payroll.attendanceManagement.selectTime')}
                                    value={dayTime.checkOut}
                                    onChange={(time) => handleDayTimeChange(index, 'checkOut', time)}
                                    className="dark:bg-gray-600 dark:border-gray-500"
                                    size="large"
                                  />
                                </Col>
                              </Row>
                            </Card>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {(status === 'absent' || status === 'late' || status === 'leave') && (
                    <>
                      <Form.Item 
                        label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.reason')}</span>} 
                        name="reason"
                        rules={[{ required: true, message: t('payroll.advanceManagement.messages.reasonRequired') }]}
                      >
                        <Input 
                          placeholder={
                            status === 'absent' ? t('payroll.attendanceManagement.absenceReason') :
                            status === 'late' ? t('payroll.attendanceManagement.lateReason') :
                            t('payroll.attendanceManagement.leaveReason')
                          }
                          className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" 
                        />
                      </Form.Item>

                      <Form.Item name="excused" valuePropName="checked">
                        <label className="flex items-center gap-2 cursor-pointer dark:text-gray-200">
                          <input type="checkbox" className="w-4 h-4" />
                          <span>{t('payroll.attendanceManagement.excused')}</span>
                        </label>
                      </Form.Item>
                    </>
                  )}
                </>
              );
            }}
          </Form.Item>

          <Form.Item label={<span className="dark:text-gray-200">{t('payroll.attendanceManagement.additionalNotes')}</span>} name="notes">
            <TextArea 
              rows={3} 
              placeholder={t('payroll.attendanceManagement.additionalNotesPlaceholder')} 
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" 
            />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" size="large">
                {t('common.save')}
              </Button>
              <Button 
                onClick={() => {
                  setAttendanceModalVisible(false);
                  attendanceForm.resetFields();
                  setDayTimes([]);
                  setTimeGroups([]);
                  setTimeMode('same');
                }} 
                size="large"
              >
                {t('common.cancel')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal إضافة سلفة */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Plus size={20} />
            <span>{t('payroll.advanceManagement.requestAdvance')}</span>
          </div>
        }
        open={advanceModalVisible}
        onCancel={() => {
          setAdvanceModalVisible(false);
          advanceForm.resetFields();
        }}
        footer={null}
        width={600}
        className="professional-modal warning-modal"
      >
        <Form form={advanceForm} layout="vertical" onFinish={handleSubmitAdvance}>
          <div className="info-box warning mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="font-medium">{t('payroll.advanceManagement.advanceWillBeDeducted')}</span>
            </div>
          </div>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.amount')}</span>}
            name="amount"
            rules={[{ required: true, message: t('payroll.advanceManagement.messages.amountRequired') }]}
          >
            <InputNumber
              {...numberOnlyInputProps} style={{ width: '100%' }}
              min={0}
              placeholder={t('payroll.advanceManagement.amountInCurrency')}
              className="dark:bg-gray-700 dark:border-gray-600"
              size="large"
              prefix={<DollarSign size={16} className="text-gray-400" />}
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.reason')}</span>}
            name="reason"
            rules={[{ required: true, message: t('payroll.advanceManagement.messages.reasonRequired') }]}
          >
            <TextArea
              rows={3}
              placeholder={t('payroll.advanceManagement.advanceReason')}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </Form.Item>

          <div className="form-section-header">
            <Calendar size={18} />
            <span>{t('payroll.advanceManagement.repaymentMethod')}</span>
          </div>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.advanceManagement.repaymentMethod')}</span>}
            name="repaymentMethod"
            initialValue="installments"
          >
            <Select className="dark:bg-gray-700" size="large">
              <Option value="full">{t('payroll.advanceManagement.repaymentMethods.full')}</Option>
              <Option value="installments">{t('payroll.advanceManagement.repaymentMethods.installments')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.repaymentMethod !== currentValues.repaymentMethod
            }
          >
            {({ getFieldValue }) => {
              const method = getFieldValue('repaymentMethod');
              return (
                method === 'installments' && (
                  <Form.Item
                    label={<span className="dark:text-gray-200">{t('payroll.advanceManagement.installments')}</span>}
                    name="installments"
                    rules={[{ required: true, message: t('payroll.advanceManagement.messages.installmentsRequired') }]}
                  >
                    <InputNumber
                      {...numberOnlyInputProps} style={{ width: '100%' }}
                      min={1}
                      placeholder={t('payroll.advanceManagement.monthlyInstallments')}
                      className="dark:bg-gray-700 dark:border-gray-600"
                      size="large"
                    />
                  </Form.Item>
                )
              );
            }}
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" size="large">
                {t('payroll.advanceManagement.submitRequest')}
              </Button>
              <Button onClick={() => {
                setAdvanceModalVisible(false);
                advanceForm.resetFields();
              }} size="large">
                {t('common.cancel')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal إضافة خصم */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Minus size={20} />
            <span>{t('payroll.deductionsManagement.addDeduction')}</span>
          </div>
        }
        open={deductionModalVisible}
        onCancel={() => {
          setDeductionModalVisible(false);
          deductionForm.resetFields();
        }}
        footer={null}
        width={600}
        className="professional-modal danger-modal"
      >
        <Form form={deductionForm} layout="vertical" onFinish={handleSubmitDeduction}>
          <div className="info-box error mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="font-medium">{t('payroll.deductionsManagement.amountWillBeDeducted')}</span>
            </div>
          </div>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.deductionsManagement.deductionType')}</span>}
            name="type"
            rules={[{ required: true, message: t('payroll.deductionsManagement.messages.typeRequired') }]}
          >
            <Select className="dark:bg-gray-700" size="large">
              <Option value="absence">{t('payroll.deductionsManagement.types.absence')}</Option>
              <Option value="late">{t('payroll.attendanceManagement.status.late')}</Option>
              <Option value="penalty">{t('payroll.deductionsManagement.types.penalty')}</Option>
              <Option value="loan">{t('payroll.deductionsManagement.types.loan')}</Option>
              <Option value="insurance">{t('payroll.deductionsManagement.types.insurance')}</Option>
              <Option value="tax">{t('payroll.deductionsManagement.types.tax')}</Option>
              <Option value="other">{t('payroll.deductionsManagement.types.other')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.amount')}</span>}
            name="amount"
            rules={[{ required: true, message: t('payroll.advanceManagement.messages.amountRequired') }]}
          >
            <InputNumber
              {...numberOnlyInputProps} style={{ width: '100%' }}
              min={0}
              placeholder={t('payroll.advanceManagement.amountInCurrency')}
              className="dark:bg-gray-700 dark:border-gray-600"
              size="large"
              prefix={<DollarSign size={16} className="text-gray-400" />}
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.date')}</span>}
            name="date"
            rules={[{ required: true, message: t('payroll.deductionsManagement.messages.dateRequired') }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder={t('common.selectDate')}
              className="dark:bg-gray-700 dark:border-gray-600"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.reason')}</span>}
            name="reason"
            rules={[{ required: true, message: t('payroll.advanceManagement.messages.reasonRequired') }]}
          >
            <TextArea
              rows={3}
              placeholder={t('payroll.deductionsManagement.deductionReason')}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" size="large">
                {t('common.add')}
              </Button>
              <Button onClick={() => {
                setDeductionModalVisible(false);
                deductionForm.resetFields();
              }} size="large">
                {t('common.cancel')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal تعديل بيانات الموظف */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <User size={20} />
            <span>{t('payroll.employeeList.editEmployee')}</span>
          </div>
        }
        open={editEmployeeModalVisible}
        onCancel={() => {
          setEditEmployeeModalVisible(false);
          editEmployeeForm.resetFields();
        }}
        footer={null}
        width={900}
        className="professional-modal info-modal"
      >
        <Form form={editEmployeeForm} layout="vertical" onFinish={handleEditEmployee}>
          <div className="mb-4">
            <div className="form-section-header">
              <User size={18} />
              <span>{t('payroll.employeeList.personalInfo')}</span>
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.name')}</span>}
                  name="name"
                  rules={[{ required: true, message: t('payroll.employeeList.messages.nameRequired') }]}
                >
                  <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" size="large" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.phone')}</span>}
                  name="phone"
                  rules={[{ required: true, message: t('payroll.employeeList.messages.phoneRequired') }]}
                >
                  <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" size="large" prefix={<Phone size={16} className="text-gray-400" />} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.nationalId')}</span>}
                  name="nationalId"
                >
                  <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" size="large" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.hireDate')}</span>}
                  name="hireDate"
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    size="large"
                    format="YYYY-MM-DD"
                    className="dark:bg-gray-700 dark:border-gray-600"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label={<span className="dark:text-gray-200">{t('payroll.employeeList.address')}</span>}
              name="address"
            >
              <TextArea rows={2} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            </Form.Item>
          </div>

          <div className="mb-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <div className="form-section-header">
              <Briefcase size={18} />
              <span>{t('payroll.employeeList.employmentInfo')}</span>
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.department')}</span>}
                  name="department"
                  rules={[{ required: true, message: t('payroll.employeeList.messages.departmentRequired') }]}
                >
                  <Select className="dark:bg-gray-700" size="large">
                    <Option value="kitchen">{t('payroll.employeeList.departments.kitchen')}</Option>
                    <Option value="cashier">{t('payroll.employeeList.departments.cashier')}</Option>
                    <Option value="waiter">{t('payroll.employeeList.departments.waiter')}</Option>
                    <Option value="admin">{t('payroll.employeeList.departments.admin')}</Option>
                    <Option value="gaming">{t('payroll.employeeList.departments.gaming')}</Option>
                    <Option value="other">{t('payroll.deductionsManagement.types.other')}</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.position')}</span>}
                  name="position"
                  rules={[{ required: true, message: t('payroll.employeeList.messages.positionRequired') }]}
                >
                  <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" size="large" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.employmentType')}</span>}
                  name="type"
                  rules={[{ required: true, message: t('payroll.employeeList.messages.typeRequired') }]}
                >
                  <Select className="dark:bg-gray-700" size="large">
                    <Option value="monthly">{t('payroll.employeeList.employmentTypes.monthly')}</Option>
                    <Option value="daily">{t('payroll.employeeList.employmentTypes.daily')}</Option>
                    <Option value="hourly">{t('payroll.employeeList.employmentTypes.hourly')}</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.table.status')}</span>}
                  name="status"
                  rules={[{ required: true, message: t('payroll.attendanceManagement.messages.statusRequired') }]}
                >
                  <Select className="dark:bg-gray-700" size="large">
                    <Option value="active">{t('payroll.employeeList.status.active')}</Option>
                    <Option value="suspended">{t('payroll.employeeList.status.suspended')}</Option>
                    <Option value="terminated">{t('payroll.employeeList.status.terminated')}</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
            <div className="form-section-header">
              <DollarSign size={18} />
              <span>{t('payroll.employeeList.compensation')}</span>
            </div>
            
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
            >
              {({ getFieldValue }) => {
                const employmentType = getFieldValue('type');
                
                return (
                  <Row gutter={16}>
                    {employmentType === 'monthly' && (
                      <Col span={12}>
                        <Form.Item
                          label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.monthlySalary')}</span>}
                          name="monthly"
                          rules={[{ required: true, message: t('payroll.employeeList.messages.salaryRequired') }]}
                        >
                          <InputNumber
                            {...numberOnlyInputProps} style={{ width: '100%' }}
                            min={0}
                            placeholder={t('payroll.employeeList.salaryInCurrency')}
                            className="dark:bg-gray-700 dark:border-gray-600"
                            size="large"
                            prefix={<DollarSign size={16} className="text-gray-400" />}
                          />
                        </Form.Item>
                      </Col>
                    )}
                    
                    {employmentType === 'daily' && (
                      <Col span={12}>
                        <Form.Item
                          label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.dailyWage')}</span>}
                          name="daily"
                          rules={[{ required: true, message: t('payroll.employeeList.messages.wageRequired') }]}
                        >
                          <InputNumber
                            {...numberOnlyInputProps} style={{ width: '100%' }}
                            min={0}
                            placeholder={t('payroll.employeeList.wageInCurrency')}
                            className="dark:bg-gray-700 dark:border-gray-600"
                            size="large"
                            prefix={<DollarSign size={16} className="text-gray-400" />}
                          />
                        </Form.Item>
                      </Col>
                    )}
                    
                    {employmentType === 'hourly' && (
                      <Col span={12}>
                        <Form.Item
                          label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.hourlyWage')}</span>}
                          name="hourly"
                          rules={[{ required: true, message: t('payroll.employeeList.messages.wageRequired') }]}
                        >
                          <InputNumber
                            {...numberOnlyInputProps} style={{ width: '100%' }}
                            min={0}
                            placeholder={t('payroll.employeeList.wageInCurrency')}
                            className="dark:bg-gray-700 dark:border-gray-600"
                            size="large"
                            prefix={<DollarSign size={16} className="text-gray-400" />}
                          />
                        </Form.Item>
                      </Col>
                    )}
                    
                    <Col span={12}>
                      <Form.Item
                        label={<span className="dark:text-gray-200">{t('payroll.employeeProfile.overtimeRate')}</span>}
                        name="overtimeHourlyRate"
                      >
                        <InputNumber
                          {...numberOnlyInputProps} style={{ width: '100%' }}
                          min={0}
                          placeholder={t('payroll.employeeList.wageInCurrency')}
                          className="dark:bg-gray-700 dark:border-gray-600"
                          size="large"
                          prefix={<DollarSign size={16} className="text-gray-400" />}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }}
            </Form.Item>
          </div>

          <Form.Item className="mt-6">
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit">
                {t('common.saveChanges')}
              </Button>
              <Button onClick={() => {
                setEditEmployeeModalVisible(false);
                editEmployeeForm.resetFields();
              }}>
                {t('common.cancel')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmployeeProfile;
