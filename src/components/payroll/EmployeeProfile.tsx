import React, { useState, useEffect } from 'react';
import { Card, Tabs, Tag, Statistic, Row, Col, Empty, Spin, Button, DatePicker, InputNumber, Modal, message, Form, Input, Select, TimePicker, Table } from 'antd';
import { User, DollarSign, AlertCircle, ArrowLeft, Wallet, TrendingUp, Calendar, Plus, Minus, Edit, Trash2, Download } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { pdf } from '@react-pdf/renderer';
import EmployeePDFDocument from './EmployeePDFDocument';
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
      console.error('فشل في تحميل بيانات الموظف:', error);
      setAttendance([]);
      setAdvances([]);
      setDeductions([]);
      setPayments([]);
      setPayrollData(null);
    } finally {
      setLoading(false);
    }
  };

  const toArabicNumbers = (num: number | string) => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).replace(/\d/g, (d) => arabicNumbers[parseInt(d)]);
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
      message.error('الرجاء إدخال مبلغ صحيح');
      return;
    }
    if (paymentAmount > stats.remainingBalance) {
      message.error('المبلغ المطلوب أكبر من المتبقي');
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
        message.success(`تم صرف ${toArabicNumbers(paymentAmount)} جنيه بنجاح`);
        setPaymentModalVisible(false);
        setPaymentAmount(0);
        setPaymentDate(dayjs());
        fetchEmployeeData();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'فشل في تسجيل الدفعة';
      message.error(errorMessage);
    }
  };

  const handleExportPDF = async () => {
    try {
      message.loading('جاري إنشاء ملف PDF...', 0);
      
      const monthName = selectedMonth.format('MMMM YYYY');
      
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
      message.success('تم تصدير التقرير بنجاح');
    } catch (error) {
      console.error('فشل في تصدير التقرير:', error);
      message.destroy();
      message.error('فشل في تصدير التقرير');
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
      message.success('تم تحديث الحضور بنجاح');
      setEditAttendanceModalVisible(false);
      setEditingAttendance(null);
      editForm.resetFields();
      fetchEmployeeData();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل في تحديث الحضور');
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    Modal.confirm({
      title: 'تأكيد الحذف',
      content: 'هل أنت متأكد من حذف هذا السجل؟',
      okText: 'حذف',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/payroll/attendance/${id}`);
          message.success('تم حذف السجل بنجاح');
          fetchEmployeeData();
        } catch (error: any) {
          message.error(error.response?.data?.error || 'فشل في حذف السجل');
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
      message.success('تم تحديث السلفة بنجاح');
      setEditAdvanceModalVisible(false);
      setEditingAdvance(null);
      editForm.resetFields();
      fetchEmployeeData();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل في تحديث السلفة');
    }
  };

  const handleDeleteAdvance = async (id: string) => {
    Modal.confirm({
      title: 'تأكيد الحذف',
      content: 'هل أنت متأكد من حذف هذه السلفة؟',
      okText: 'حذف',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/payroll/advances/${id}`);
          message.success('تم حذف السلفة بنجاح');
          fetchEmployeeData();
        } catch (error: any) {
          message.error(error.response?.data?.error || 'فشل في حذف السلفة');
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
      message.success('تم تحديث الخصم بنجاح');
      setEditDeductionModalVisible(false);
      setEditingDeduction(null);
      editForm.resetFields();
      fetchEmployeeData();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل في تحديث الخصم');
    }
  };

  const handleDeleteDeduction = async (id: string) => {
    Modal.confirm({
      title: 'تأكيد الحذف',
      content: 'هل أنت متأكد من حذف هذا الخصم؟',
      okText: 'حذف',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/payroll/deductions/${id}`);
          message.success('تم حذف الخصم بنجاح');
          fetchEmployeeData();
        } catch (error: any) {
          message.error(error.response?.data?.error || 'فشل في حذف الخصم');
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
      message.success('تم تحديث الدفعة بنجاح');
      setEditPaymentModalVisible(false);
      setEditingPayment(null);
      editForm.resetFields();
      fetchEmployeeData();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل في تحديث الدفعة');
    }
  };

  const handleDeletePayment = async (id: string) => {
    Modal.confirm({
      title: 'تأكيد الحذف',
      content: 'هل أنت متأكد من حذف هذه الدفعة؟',
      okText: 'حذف',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/payroll/payments/${id}`);
          message.success('تم حذف الدفعة بنجاح');
          fetchEmployeeData();
        } catch (error: any) {
          message.error(error.response?.data?.error || 'فشل في حذف الدفعة');
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
            message.error('الرجاء تحديد وقت الحضور');
            return;
          }
        } else if (timeMode === 'different') {
          const missingTimes = dayTimes.filter(dt => !dt.checkIn);
          if (missingTimes.length > 0) {
            message.error('الرجاء تحديد وقت الحضور لجميع الأيام');
            return;
          }
        } else if (timeMode === 'groups') {
          const invalidGroups = timeGroups.filter(g => !g.checkIn || g.dates.length === 0);
          if (invalidGroups.length > 0) {
            message.error('الرجاء تحديد الأيام والأوقات لجميع المجموعات');
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
        message.success(`تم تسجيل الحضور لـ ${successCount} يوم بنجاح`);
        setAttendanceModalVisible(false);
        attendanceForm.resetFields();
        setDayTimes([]);
        setTimeGroups([]);
        setTimeMode('same');
        fetchEmployeeData();
      } else {
        message.error('فشل في تسجيل الحضور');
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل في تسجيل الحضور');
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
      
      
      const response = await api.post('/payroll/advances', payload);
      
      message.success('تم إضافة السلفة بنجاح');
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
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'فشل في إضافة السلفة';
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
      
      
      const response = await api.post('/payroll/deductions', payload);
      
      message.success('تم إضافة الخصم بنجاح');
      setDeductionModalVisible(false);
      deductionForm.resetFields();
      fetchEmployeeData();
    } catch (error: any) {
      console.error('Deduction error:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'فشل في إضافة الخصم';
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
        message.success('تم تحديث بيانات الموظف بنجاح');
        setEditEmployeeModalVisible(false);
        editEmployeeForm.resetFields();
        fetchEmployeeData();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'فشل في تحديث بيانات الموظف';
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
    const names: any = {
      active: 'نشط', inactive: 'غير نشط', suspended: 'موقوف', pending: 'قيد الانتظار',
      approved: 'معتمد', paid: 'مدفوع', completed: 'مكتمل', rejected: 'مرفوض',
      present: 'حاضر', absent: 'غائب', late: 'متأخر', leave: 'إجازة', half_day: 'نصف يوم', weekly_off: 'إجازة أسبوعية'
    };
    return names[status] || status;
  };

  const getDepartmentName = (dept: string) => {
    const names: any = {
      kitchen: 'المطبخ', cashier: 'الكاشير', waiter: 'الخدمة',
      admin: 'الإدارة', gaming: 'الألعاب', other: 'أخرى'
    };
    return names[dept] || dept;
  };

  const getDeductionTypeName = (type: string) => {
    const types: any = {
      absence: 'غياب', late: 'تأخير', penalty: 'جزاء',
      loan: 'قرض', insurance: 'تأمينات', tax: 'ضرائب', other: 'أخرى'
    };
    return types[type] || type;
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
        <Empty description="لم يتم العثور على بيانات الموظف" />
      </Card>
    );
  }

  return (
    <div className="employee-profile">
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button icon={<ArrowLeft size={20} />} onClick={onClose} type="text" className="dark:text-gray-300">رجوع</Button>
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <User size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold dark:text-gray-100">{employee.personalInfo?.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Tag color={getStatusColor(employee.employment?.status)}>{getStatusName(employee.employment?.status)}</Tag>
                <span className="text-gray-600 dark:text-gray-300 text-sm">{employee.employment?.position} - {getDepartmentName(employee.employment?.department)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button 
                type="default" 
                size="large"
                icon={<Calendar size={20} />}
                onClick={() => setAttendanceModalVisible(true)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 w-full"
                block
              >
                الحضور والانصراف
              </Button>
              <Button 
                type="default" 
                size="large"
                icon={<Plus size={20} />}
                onClick={() => setAdvanceModalVisible(true)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 w-full"
                block
              >
                السلف
              </Button>
              <Button 
                type="default" 
                size="large"
                icon={<Minus size={20} />}
                onClick={() => setDeductionModalVisible(true)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 w-full"
                block
              >
                الخصومات
              </Button>
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">
              <span className="text-gray-600 dark:text-gray-300 text-sm whitespace-nowrap">الشهر:</span>
              <DatePicker 
                picker="month" 
                value={selectedMonth} 
                onChange={(date) => date && setSelectedMonth(date)} 
                format="MMMM YYYY" 
                className="dark:bg-gray-700 dark:border-gray-600" 
                style={{ width: 180 }} 
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Employee Information Card */}
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold dark:text-gray-100 flex items-center gap-2">
            <User size={20} className="text-blue-600 dark:text-blue-400" />
            بيانات الموظف
          </h3>
          <div className="flex gap-2">
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
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            >
              تعديل البيانات
            </Button>
            <Button 
              type="primary"
              icon={showFinancials ? <Minus size={16} /> : <Plus size={16} />}
              onClick={() => setShowFinancials(!showFinancials)}
            >
              {showFinancials ? 'إخفاء البيانات المالية' : 'إظهار البيانات المالية'}
            </Button>
          </div>
        </div>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">الاسم</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{employee.personalInfo?.name}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">رقم الهاتف</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{employee.personalInfo?.phone || '-'}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">الرقم القومي</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{employee.personalInfo?.nationalId || '-'}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">تاريخ التعيين</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">
                {employee.personalInfo?.hireDate ? dayjs(employee.personalInfo.hireDate).format('DD/MM/YYYY') : '-'}
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">القسم</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{getDepartmentName(employee.employment?.department)}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">المنصب</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{employee.employment?.position}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">نوع التوظيف</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">
                {employee.employment?.type === 'monthly' ? 'شهري' : employee.employment?.type === 'daily' ? 'يومي' : 'بالساعة'}
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">الحالة</div>
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
                  البيانات المالية
                </h4>
              </Col>
              {employee.employment?.type === 'monthly' && (
                <Col xs={24} sm={12} md={8}>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">الراتب الشهري</div>
                    <div className="font-bold text-lg text-green-700 dark:text-green-400">
                      {toArabicNumbers(employee.compensation?.monthly || 0)} جنيه
                    </div>
                  </div>
                </Col>
              )}
              {employee.employment?.type === 'daily' && (
                <Col xs={24} sm={12} md={8}>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">الأجر اليومي</div>
                    <div className="font-bold text-lg text-green-700 dark:text-green-400">
                      {toArabicNumbers(employee.compensation?.daily || 0)} جنيه
                    </div>
                  </div>
                </Col>
              )}
              {employee.employment?.type === 'hourly' && (
                <Col xs={24} sm={12} md={8}>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">الأجر بالساعة</div>
                    <div className="font-bold text-lg text-green-700 dark:text-green-400">
                      {toArabicNumbers(employee.compensation?.hourly || 0)} جنيه
                    </div>
                  </div>
                </Col>
              )}
              {employee.compensation?.overtimeHourlyRate > 0 && (
                <Col xs={24} sm={12} md={8}>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">أجر الساعة الإضافية</div>
                    <div className="font-bold text-lg text-blue-700 dark:text-blue-400">
                      {toArabicNumbers(employee.compensation?.overtimeHourlyRate || 0)} جنيه
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
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <Statistic title={<span className="dark:text-gray-300 text-sm">مرحل من أشهر سابقة</span>} value={toArabicNumbers(stats.carriedForward.toFixed(2))} suffix="جنيه" prefix={<TrendingUp size={18} />} valueStyle={{ color: stats.carriedForward > 0 ? '#fa8c16' : '#8c8c8c', fontSize: '20px' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <Statistic title={<span className="dark:text-gray-300 text-sm">مرتب الشهر الحالي</span>} value={toArabicNumbers(stats.currentMonthSalary.toFixed(2))} suffix="جنيه" prefix={<DollarSign size={18} />} valueStyle={{ color: '#52c41a', fontSize: '20px' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <Statistic title={<span className="dark:text-gray-300 text-sm">سلف الشهر</span>} value={toArabicNumbers(stats.currentMonthAdvances.toFixed(2))} suffix="جنيه" prefix={<AlertCircle size={18} />} valueStyle={{ color: '#faad14', fontSize: '20px' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <Statistic title={<span className="dark:text-gray-300 text-sm">خصومات الشهر</span>} value={toArabicNumbers(stats.currentMonthDeductions.toFixed(2))} suffix="جنيه" prefix={<AlertCircle size={18} />} valueStyle={{ color: '#ff4d4f', fontSize: '20px' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <Statistic title={<span className="dark:text-gray-300 text-sm">المرتب المصروف</span>} value={toArabicNumbers(stats.currentMonthPaid.toFixed(2))} suffix="جنيه" prefix={<Wallet size={18} />} valueStyle={{ color: '#722ed1', fontSize: '20px' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="dark:bg-gray-800 dark:border-gray-700 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <Statistic title={<span className="dark:text-gray-300 text-sm font-bold">الرصيد المتاح</span>} value={toArabicNumbers(stats.remainingBalance.toFixed(2))} suffix="جنيه" prefix={<Wallet size={18} />} valueStyle={{ color: '#1890ff', fontSize: '22px', fontWeight: 'bold' }} />
          </Card>
        </Col>
      </Row>
      )}

      {showFinancials && (
        <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-bold dark:text-gray-100">الرصيد المتاح للصرف</h3>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">{toArabicNumbers(stats.remainingBalance.toFixed(2))} جنيه</p>
              {!isCurrentMonth && (
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                  لا يمكن صرف مرتب إلا للشهر الحالي
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                type="default"
                size="large" 
                icon={<Download size={20} />} 
                onClick={handleExportPDF}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                تصدير تقرير شامل PDF
              </Button>
              <Button 
                type="primary" 
                size="large" 
                icon={<Wallet size={20} />} 
                onClick={() => setPaymentModalVisible(true)} 
                disabled={stats.remainingBalance <= 0 || !isCurrentMonth}
              >
                صرف جزء من المرتب
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
              label: 'الحضور والانصراف',
              children: (
                <Table
                  dataSource={attendance}
                  rowKey="_id"
                  loading={loading}
                  locale={{ emptyText: 'لا توجد سجلات حضور' }}
                  pagination={{ pageSize: 10 }}
                  className="dark:bg-gray-800"
                  scroll={{ x: 800 }}
                >
                  <Table.Column
                    title="التاريخ"
                    dataIndex="date"
                    key="date"
                    render={(date) => dayjs(date).format('DD/MM/YYYY')}
                  />
                  <Table.Column
                    title="اليوم"
                    dataIndex="day"
                    key="day"
                  />
                  <Table.Column
                    title="الحالة"
                    dataIndex="status"
                    key="status"
                    render={(status) => (
                      <Tag color={getStatusColor(status)}>
                        {getStatusName(status)}
                      </Tag>
                    )}
                  />
                  <Table.Column
                    title="الحضور"
                    dataIndex="checkIn"
                    key="checkIn"
                    render={(time) => time || '-'}
                  />
                  <Table.Column
                    title="الانصراف"
                    dataIndex="checkOut"
                    key="checkOut"
                    render={(time) => time || '-'}
                  />
                  <Table.Column
                    title="الساعات"
                    dataIndex="hours"
                    key="hours"
                    render={(hours) => hours ? toArabicNumbers(hours.toFixed(1)) : '-'}
                  />
                  <Table.Column
                    title="المرتب اليومي"
                    dataIndex="dailySalary"
                    key="dailySalary"
                    render={(salary) => salary ? `${toArabicNumbers(salary.toFixed(2))} جنيه` : '-'}
                  />
                  <Table.Column
                    title="الإجراءات"
                    key="actions"
                    render={(_, record: any) => (
                      <div className="flex gap-2">
                        <Button
                          type="link"
                          icon={<Edit size={16} />}
                          onClick={() => handleEditAttendance(record)}
                          className="dark:text-blue-400"
                        >
                          تعديل
                        </Button>
                        <Button
                          type="link"
                          danger
                          icon={<Trash2 size={16} />}
                          onClick={() => handleDeleteAttendance(record._id)}
                          className="dark:text-red-400"
                        >
                          حذف
                        </Button>
                      </div>
                    )}
                  />
                </Table>
              )
            },
            {
              key: '2',
              label: 'السلف',
              children: (
                <Table
                  dataSource={advances}
                  rowKey="_id"
                  loading={loading}
                  locale={{ emptyText: 'لا توجد سلف' }}
                  pagination={{ pageSize: 10 }}
                  className="dark:bg-gray-800"
                  scroll={{ x: 700 }}
                >
                  <Table.Column
                    title="التاريخ"
                    dataIndex="requestDate"
                    key="requestDate"
                    render={(date) => dayjs(date).format('DD/MM/YYYY')}
                  />
                  <Table.Column
                    title="المبلغ"
                    dataIndex="amount"
                    key="amount"
                    render={(amount) => `${toArabicNumbers(amount)} جنيه`}
                  />
                  <Table.Column
                    title="السبب"
                    dataIndex="reason"
                    key="reason"
                  />
                  <Table.Column
                    title="الحالة"
                    dataIndex="status"
                    key="status"
                    render={(status) => (
                      <Tag color={getStatusColor(status)}>
                        {getStatusName(status)}
                      </Tag>
                    )}
                  />
                  <Table.Column
                    title="المتبقي"
                    key="remaining"
                    render={(_, record: any) => 
                      record.repayment?.remainingAmount 
                        ? `${toArabicNumbers(record.repayment.remainingAmount)} جنيه`
                        : '-'
                    }
                  />
                  <Table.Column
                    title="الإجراءات"
                    key="actions"
                    render={(_, record: any) => (
                      <div className="flex gap-2">
                        <Button
                          type="link"
                          icon={<Edit size={16} />}
                          onClick={() => handleEditAdvance(record)}
                          className="dark:text-blue-400"
                        >
                          تعديل
                        </Button>
                        <Button
                          type="link"
                          danger
                          icon={<Trash2 size={16} />}
                          onClick={() => handleDeleteAdvance(record._id)}
                          className="dark:text-red-400"
                        >
                          حذف
                        </Button>
                      </div>
                    )}
                  />
                </Table>
              )
            },
            {
              key: '3',
              label: 'الخصومات',
              children: (
                <Table
                  dataSource={deductions}
                  rowKey="_id"
                  loading={loading}
                  locale={{ emptyText: 'لا توجد خصومات' }}
                  pagination={{ pageSize: 10 }}
                  className="dark:bg-gray-800"
                  scroll={{ x: 600 }}
                >
                  <Table.Column
                    title="التاريخ"
                    dataIndex="date"
                    key="date"
                    render={(date) => dayjs(date).format('DD/MM/YYYY')}
                  />
                  <Table.Column
                    title="النوع"
                    dataIndex="type"
                    key="type"
                    render={(type) => getDeductionTypeName(type)}
                  />
                  <Table.Column
                    title="المبلغ"
                    dataIndex="amount"
                    key="amount"
                    render={(amount) => `${toArabicNumbers(amount)} جنيه`}
                  />
                  <Table.Column
                    title="السبب"
                    dataIndex="reason"
                    key="reason"
                  />
                  <Table.Column
                    title="الإجراءات"
                    key="actions"
                    render={(_, record: any) => (
                      <div className="flex gap-2">
                        <Button
                          type="link"
                          icon={<Edit size={16} />}
                          onClick={() => handleEditDeduction(record)}
                          className="dark:text-blue-400"
                        >
                          تعديل
                        </Button>
                        <Button
                          type="link"
                          danger
                          icon={<Trash2 size={16} />}
                          onClick={() => handleDeleteDeduction(record._id)}
                          className="dark:text-red-400"
                        >
                          حذف
                        </Button>
                      </div>
                    )}
                  />
                </Table>
              )
            },
            {
              key: '4',
              label: 'المدفوعات',
              children: (
                <Table
                  dataSource={payments}
                  rowKey="_id"
                  loading={loading}
                  locale={{ emptyText: 'لا توجد مدفوعات' }}
                  pagination={{ pageSize: 10 }}
                  className="dark:bg-gray-800"
                  scroll={{ x: 600 }}
                >
                  <Table.Column
                    title="التاريخ"
                    dataIndex="paymentDate"
                    key="paymentDate"
                    render={(date) => dayjs(date).format('DD/MM/YYYY')}
                  />
                  <Table.Column
                    title="المبلغ"
                    dataIndex="amount"
                    key="amount"
                    render={(amount) => `${toArabicNumbers(amount)} جنيه`}
                  />
                  <Table.Column
                    title="الطريقة"
                    dataIndex="method"
                    key="method"
                    render={(method) => method === 'cash' ? 'نقدي' : method === 'card' ? 'بطاقة' : 'تحويل'}
                  />
                  <Table.Column
                    title="ملاحظات"
                    dataIndex="notes"
                    key="notes"
                    render={(notes) => notes || '-'}
                  />
                  <Table.Column
                    title="الإجراءات"
                    key="actions"
                    render={(_, record: any) => (
                      <div className="flex gap-2">
                        <Button
                          type="link"
                          icon={<Edit size={16} />}
                          onClick={() => handleEditPayment(record)}
                          className="dark:text-blue-400"
                        >
                          تعديل
                        </Button>
                        <Button
                          type="link"
                          danger
                          icon={<Trash2 size={16} />}
                          onClick={() => handleDeletePayment(record._id)}
                          className="dark:text-red-400"
                        >
                          حذف
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
        title="تعديل الحضور"
        open={editAttendanceModalVisible}
        onCancel={() => {
          setEditAttendanceModalVisible(false);
          setEditingAttendance(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        className="dark:bg-gray-800"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateAttendance}>
          <Form.Item
            label={<span className="dark:text-gray-200">التاريخ</span>}
            name="date"
          >
            <DatePicker 
              style={{ width: '100%' }} 
              format="YYYY-MM-DD" 
              className="dark:bg-gray-700 dark:border-gray-600"
              disabled
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">الحالة</span>}
            name="status"
            rules={[{ required: true, message: 'الرجاء اختيار الحالة' }]}
          >
            <Select className="dark:bg-gray-700">
              <Option value="present">حضور</Option>
              <Option value="absent">غياب</Option>
              <Option value="late">تأخير</Option>
              <Option value="leave">إجازة</Option>
              <Option value="half_day">نصف يوم</Option>
              <Option value="weekly_off">إجازة أسبوعية</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                label={<span className="dark:text-gray-200">وقت الحضور</span>} 
                name="checkIn"
              >
                <TimePicker 
                  style={{ width: '100%' }} 
                  format="hh:mm A"
                  use12Hours
                  className="dark:bg-gray-700 dark:border-gray-600"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                label={<span className="dark:text-gray-200">وقت الانصراف</span>} 
                name="checkOut"
              >
                <TimePicker 
                  style={{ width: '100%' }} 
                  format="hh:mm A"
                  use12Hours
                  className="dark:bg-gray-700 dark:border-gray-600"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item 
            label={<span className="dark:text-gray-200">السبب</span>} 
            name="reason"
          >
            <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item label={<span className="dark:text-gray-200">ملاحظات</span>} name="notes">
            <TextArea rows={3} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit">
                حفظ
              </Button>
              <Button onClick={() => {
                setEditAttendanceModalVisible(false);
                setEditingAttendance(null);
                editForm.resetFields();
              }}>
                إلغاء
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal تعديل السلفة */}
      <Modal
        title="تعديل السلفة"
        open={editAdvanceModalVisible}
        onCancel={() => {
          setEditAdvanceModalVisible(false);
          setEditingAdvance(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        className="dark:bg-gray-800"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateAdvance}>
          <Form.Item
            label={<span className="dark:text-gray-200">المبلغ</span>}
            name="amount"
            rules={[{ required: true, message: 'الرجاء إدخال المبلغ' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">السبب</span>}
            name="reason"
            rules={[{ required: true, message: 'الرجاء إدخال السبب' }]}
          >
            <TextArea rows={3} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">تاريخ الطلب</span>}
            name="requestDate"
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit">
                حفظ
              </Button>
              <Button onClick={() => {
                setEditAdvanceModalVisible(false);
                setEditingAdvance(null);
                editForm.resetFields();
              }}>
                إلغاء
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal تعديل الخصم */}
      <Modal
        title="تعديل الخصم"
        open={editDeductionModalVisible}
        onCancel={() => {
          setEditDeductionModalVisible(false);
          setEditingDeduction(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        className="dark:bg-gray-800"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateDeduction}>
          <Form.Item
            label={<span className="dark:text-gray-200">النوع</span>}
            name="type"
            rules={[{ required: true, message: 'الرجاء اختيار النوع' }]}
          >
            <Select className="dark:bg-gray-700">
              <Option value="absence">غياب</Option>
              <Option value="late">تأخير</Option>
              <Option value="penalty">جزاء</Option>
              <Option value="loan">قرض</Option>
              <Option value="insurance">تأمينات</Option>
              <Option value="tax">ضرائب</Option>
              <Option value="other">أخرى</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">المبلغ</span>}
            name="amount"
            rules={[{ required: true, message: 'الرجاء إدخال المبلغ' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">التاريخ</span>}
            name="date"
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">السبب</span>}
            name="reason"
            rules={[{ required: true, message: 'الرجاء إدخال السبب' }]}
          >
            <TextArea rows={3} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit">
                حفظ
              </Button>
              <Button onClick={() => {
                setEditDeductionModalVisible(false);
                setEditingDeduction(null);
                editForm.resetFields();
              }}>
                إلغاء
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal تعديل الدفعة */}
      <Modal
        title="تعديل الدفعة"
        open={editPaymentModalVisible}
        onCancel={() => {
          setEditPaymentModalVisible(false);
          setEditingPayment(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        className="dark:bg-gray-800"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdatePayment}>
          <Form.Item
            label={<span className="dark:text-gray-200">المبلغ</span>}
            name="amount"
            rules={[{ required: true, message: 'الرجاء إدخال المبلغ' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">طريقة الدفع</span>}
            name="method"
          >
            <Select className="dark:bg-gray-700">
              <Option value="cash">نقدي</Option>
              <Option value="card">بطاقة</Option>
              <Option value="transfer">تحويل</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">تاريخ الصرف</span>}
            name="paymentDate"
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">ملاحظات</span>}
            name="notes"
          >
            <TextArea rows={3} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit">
                حفظ
              </Button>
              <Button onClick={() => {
                setEditPaymentModalVisible(false);
                setEditingPayment(null);
                editForm.resetFields();
              }}>
                إلغاء
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="صرف جزء من المرتب" open={paymentModalVisible} onCancel={() => { setPaymentModalVisible(false); setPaymentAmount(0); setPaymentDate(dayjs()); }} onOk={handlePayment} okText="صرف" cancelText="إلغاء" className="dark:bg-gray-800">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium mb-2 dark:text-gray-200">الرصيد المتاح: {toArabicNumbers(stats.remainingBalance.toFixed(2))} جنيه</label></div>
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">المبلغ المطلوب صرفه</label>
            <InputNumber value={paymentAmount} onChange={(value) => setPaymentAmount(value || 0)} min={0} max={stats.remainingBalance} style={{ width: '100%' }} className="dark:bg-gray-700 dark:border-gray-600" placeholder="أدخل المبلغ" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">تاريخ الصرف</label>
            <DatePicker 
              value={paymentDate} 
              onChange={(date) => date && setPaymentDate(date)} 
              format="YYYY-MM-DD" 
              style={{ width: '100%' }} 
              className="dark:bg-gray-700 dark:border-gray-600"
              placeholder="اختر تاريخ الصرف"
              disabledDate={(current) => {
                if (!current) return false;
                const today = dayjs();
                const currentMonthStart = selectedMonth.startOf('month');
                const currentMonthEnd = selectedMonth.endOf('month');
                
                // لا يمكن اختيار تاريخ في المستقبل
                if (current.isAfter(today, 'day')) return true;
                
                // يجب أن يكون التاريخ في الشهر المحدد
                if (current.isBefore(currentMonthStart, 'day') || current.isAfter(currentMonthEnd, 'day')) return true;
                
                return false;
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Modal تسجيل الحضور */}
      <Modal
        title="تسجيل حضور"
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
        className="dark:bg-gray-800"
      >
        <Form form={attendanceForm} layout="vertical" onFinish={handleSubmitAttendance}>
          <Form.Item
            label={<span className="dark:text-gray-200">الأيام (يمكن اختيار عدة أيام)</span>}
            name="dates"
            rules={[{ required: true, message: 'الرجاء اختيار الأيام' }]}
          >
            <DatePicker
              multiple
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              className="dark:bg-gray-700 dark:border-gray-600"
              placeholder="اختر يوم أو أكثر"
              onChange={handleDatesChange}
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">الحالة</span>}
            name="status"
            rules={[{ required: true, message: 'الرجاء اختيار الحالة' }]}
          >
            <Select className="dark:bg-gray-700">
              <Option value="present">حضور</Option>
              <Option value="absent">غياب</Option>
              <Option value="late">تأخير</Option>
              <Option value="leave">إجازة</Option>
              <Option value="half_day">نصف يوم</Option>
              <Option value="weekly_off">إجازة أسبوعية</Option>
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
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-200">
                            اختر طريقة تحديد الأوقات:
                          </div>
                          <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-all hover:bg-blue-100 dark:hover:bg-blue-900/30 dark:text-gray-200"
                              style={{
                                borderColor: timeMode === 'same' ? '#1890ff' : '#d9d9d9',
                                backgroundColor: timeMode === 'same' ? '#e6f7ff' : 'transparent'
                              }}
                            >
                              <input
                                type="radio"
                                checked={timeMode === 'same'}
                                onChange={() => setTimeMode('same')}
                                className="w-5 h-5"
                              />
                              <div>
                                <div className="font-medium">نفس الوقت لجميع الأيام</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  سيتم تطبيق نفس وقت الحضور والانصراف على جميع الأيام المختارة
                                </div>
                              </div>
                            </label>
                            
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-all hover:bg-blue-100 dark:hover:bg-blue-900/30 dark:text-gray-200"
                              style={{
                                borderColor: timeMode === 'groups' ? '#1890ff' : '#d9d9d9',
                                backgroundColor: timeMode === 'groups' ? '#e6f7ff' : 'transparent'
                              }}
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
                                className="w-5 h-5"
                              />
                              <div>
                                <div className="font-medium">مجموعات أيام بأوقات مختلفة</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  يمكنك تقسيم الأيام إلى مجموعات، كل مجموعة لها وقت خاص
                                </div>
                              </div>
                            </label>
                            
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-all hover:bg-blue-100 dark:hover:bg-blue-900/30 dark:text-gray-200"
                              style={{
                                borderColor: timeMode === 'different' ? '#1890ff' : '#d9d9d9',
                                backgroundColor: timeMode === 'different' ? '#e6f7ff' : 'transparent'
                              }}
                            >
                              <input
                                type="radio"
                                checked={timeMode === 'different'}
                                onChange={() => setTimeMode('different')}
                                className="w-5 h-5"
                              />
                              <div>
                                <div className="font-medium">وقت مختلف لكل يوم</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  يمكنك تحديد وقت حضور وانصراف مختلف لكل يوم على حدة
                                </div>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}

                      {timeMode === 'same' && (
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item 
                              label={<span className="dark:text-gray-200">وقت الحضور</span>} 
                              name="checkIn"
                              rules={status === 'present' || status === 'late' ? [{ required: true, message: 'مطلوب' }] : []}
                            >
                              <TimePicker 
                                style={{ width: '100%' }} 
                                format="hh:mm A"
                                use12Hours
                                className="dark:bg-gray-700 dark:border-gray-600"
                                placeholder="اختر الوقت"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item 
                              label={<span className="dark:text-gray-200">وقت الانصراف</span>} 
                              name="checkOut"
                            >
                              <TimePicker 
                                style={{ width: '100%' }} 
                                format="hh:mm A"
                                use12Hours
                                className="dark:bg-gray-700 dark:border-gray-600"
                                placeholder="اختر الوقت"
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      )}

                      {timeMode === 'groups' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                              المجموعات ({toArabicNumbers(timeGroups.length)})
                            </span>
                            <Button 
                              type="dashed" 
                              size="small"
                              onClick={addTimeGroup}
                              className="dark:border-gray-600 dark:text-gray-200"
                            >
                              + إضافة مجموعة
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
                                        حذف
                                      </Button>
                                    )
                                  }
                                  title={
                                    <span className="dark:text-gray-200">
                                      المجموعة {toArabicNumbers(index + 1)}
                                    </span>
                                  }
                                >
                                  <div className="space-y-3">
                                    <div>
                                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        اختر الأيام *
                                      </div>
                                      <Select
                                        mode="multiple"
                                        style={{ width: '100%' }}
                                        placeholder="اختر الأيام لهذه المجموعة"
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
                                          وقت الحضور *
                                        </div>
                                        <TimePicker
                                          style={{ width: '100%' }}
                                          format="hh:mm A"
                                          use12Hours
                                          placeholder="اختر الوقت"
                                          value={group.checkIn}
                                          onChange={(time) => updateTimeGroup(group.id, 'checkIn', time)}
                                          className="dark:bg-gray-600 dark:border-gray-500"
                                        />
                                      </Col>
                                      <Col span={12}>
                                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                          وقت الانصراف
                                        </div>
                                        <TimePicker
                                          style={{ width: '100%' }}
                                          format="hh:mm A"
                                          use12Hours
                                          placeholder="اختر الوقت"
                                          value={group.checkOut}
                                          onChange={(time) => updateTimeGroup(group.id, 'checkOut', time)}
                                          className="dark:bg-gray-600 dark:border-gray-500"
                                        />
                                      </Col>
                                    </Row>
                                    
                                    {group.dates.length > 0 && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                                        {toArabicNumbers(group.dates.length)} يوم محدد
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
                            حدد أوقات الحضور والانصراف لكل يوم:
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
                                  اليوم {toArabicNumbers(index + 1)} من {toArabicNumbers(dayTimes.length)}
                                </div>
                              </div>
                              <Row gutter={8}>
                                <Col span={12}>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">وقت الحضور *</div>
                                  <TimePicker
                                    style={{ width: '100%' }}
                                    format="hh:mm A"
                                    use12Hours
                                    placeholder="اختر الوقت"
                                    value={dayTime.checkIn}
                                    onChange={(time) => handleDayTimeChange(index, 'checkIn', time)}
                                    className="dark:bg-gray-600 dark:border-gray-500"
                                    size="large"
                                  />
                                </Col>
                                <Col span={12}>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">وقت الانصراف</div>
                                  <TimePicker
                                    style={{ width: '100%' }}
                                    format="hh:mm A"
                                    use12Hours
                                    placeholder="اختر الوقت"
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
                        label={<span className="dark:text-gray-200">السبب</span>} 
                        name="reason"
                        rules={[{ required: true, message: 'الرجاء إدخال السبب' }]}
                      >
                        <Input 
                          placeholder={
                            status === 'absent' ? 'سبب الغياب...' :
                            status === 'late' ? 'سبب التأخير...' :
                            'سبب الإجازة...'
                          }
                          className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" 
                        />
                      </Form.Item>

                      <Form.Item name="excused" valuePropName="checked">
                        <label className="flex items-center gap-2 cursor-pointer dark:text-gray-200">
                          <input type="checkbox" className="w-4 h-4" />
                          <span>بعذر مقبول</span>
                        </label>
                      </Form.Item>
                    </>
                  )}
                </>
              );
            }}
          </Form.Item>

          <Form.Item label={<span className="dark:text-gray-200">ملاحظات إضافية</span>} name="notes">
            <TextArea 
              rows={3} 
              placeholder="ملاحظات إضافية..." 
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" 
            />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" size="large">
                حفظ
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
                إلغاء
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal إضافة سلفة */}
      <Modal
        title="طلب سلفة جديدة"
        open={advanceModalVisible}
        onCancel={() => {
          setAdvanceModalVisible(false);
          advanceForm.resetFields();
        }}
        footer={null}
        width={600}
        className="dark:bg-gray-800"
      >
        <Form form={advanceForm} layout="vertical" onFinish={handleSubmitAdvance}>
          <Form.Item
            label={<span className="dark:text-gray-200">المبلغ</span>}
            name="amount"
            rules={[{ required: true, message: 'الرجاء إدخال المبلغ' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              placeholder="المبلغ بالجنيه"
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">السبب</span>}
            name="reason"
            rules={[{ required: true, message: 'الرجاء إدخال السبب' }]}
          >
            <TextArea
              rows={3}
              placeholder="سبب طلب السلفة..."
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">طريقة السداد</span>}
            name="repaymentMethod"
            initialValue="installments"
          >
            <Select className="dark:bg-gray-700">
              <Option value="full">دفعة واحدة</Option>
              <Option value="installments">أقساط شهرية</Option>
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
                    label={<span className="dark:text-gray-200">عدد الأقساط</span>}
                    name="installments"
                    rules={[{ required: true, message: 'الرجاء إدخال عدد الأقساط' }]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      placeholder="عدد الأقساط الشهرية"
                      className="dark:bg-gray-700 dark:border-gray-600"
                    />
                  </Form.Item>
                )
              );
            }}
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit">
                تقديم الطلب
              </Button>
              <Button onClick={() => {
                setAdvanceModalVisible(false);
                advanceForm.resetFields();
              }}>
                إلغاء
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal إضافة خصم */}
      <Modal
        title="إضافة خصم"
        open={deductionModalVisible}
        onCancel={() => {
          setDeductionModalVisible(false);
          deductionForm.resetFields();
        }}
        footer={null}
        width={600}
        className="dark:bg-gray-800"
      >
        <Form form={deductionForm} layout="vertical" onFinish={handleSubmitDeduction}>
          <Form.Item
            label={<span className="dark:text-gray-200">نوع الخصم</span>}
            name="type"
            rules={[{ required: true, message: 'الرجاء اختيار نوع الخصم' }]}
          >
            <Select className="dark:bg-gray-700">
              <Option value="absence">غياب</Option>
              <Option value="late">تأخير</Option>
              <Option value="penalty">جزاء</Option>
              <Option value="loan">قرض</Option>
              <Option value="insurance">تأمينات</Option>
              <Option value="tax">ضرائب</Option>
              <Option value="other">أخرى</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">المبلغ</span>}
            name="amount"
            rules={[{ required: true, message: 'الرجاء إدخال المبلغ' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              placeholder="المبلغ بالجنيه"
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">التاريخ</span>}
            name="date"
            rules={[{ required: true, message: 'الرجاء اختيار التاريخ' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="اختر التاريخ"
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">السبب</span>}
            name="reason"
            rules={[{ required: true, message: 'الرجاء إدخال السبب' }]}
          >
            <TextArea
              rows={3}
              placeholder="سبب الخصم..."
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit">
                إضافة
              </Button>
              <Button onClick={() => {
                setDeductionModalVisible(false);
                deductionForm.resetFields();
              }}>
                إلغاء
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal تعديل بيانات الموظف */}
      <Modal
        title="تعديل بيانات الموظف"
        open={editEmployeeModalVisible}
        onCancel={() => {
          setEditEmployeeModalVisible(false);
          editEmployeeForm.resetFields();
        }}
        footer={null}
        width={800}
        className="dark:bg-gray-800"
      >
        <Form form={editEmployeeForm} layout="vertical" onFinish={handleEditEmployee}>
          <div className="mb-4">
            <h4 className="text-md font-bold text-gray-700 dark:text-gray-300 mb-3">المعلومات الشخصية</h4>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">الاسم</span>}
                  name="name"
                  rules={[{ required: true, message: 'الرجاء إدخال الاسم' }]}
                >
                  <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">رقم الهاتف</span>}
                  name="phone"
                  rules={[{ required: true, message: 'الرجاء إدخال رقم الهاتف' }]}
                >
                  <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">الرقم القومي</span>}
                  name="nationalId"
                >
                  <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">تاريخ التعيين</span>}
                  name="hireDate"
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    format="YYYY-MM-DD"
                    className="dark:bg-gray-700 dark:border-gray-600"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label={<span className="dark:text-gray-200">العنوان</span>}
              name="address"
            >
              <TextArea rows={2} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            </Form.Item>
          </div>

          <div className="mb-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <h4 className="text-md font-bold text-gray-700 dark:text-gray-300 mb-3">بيانات التوظيف</h4>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">القسم</span>}
                  name="department"
                  rules={[{ required: true, message: 'الرجاء اختيار القسم' }]}
                >
                  <Select className="dark:bg-gray-700">
                    <Option value="kitchen">المطبخ</Option>
                    <Option value="cashier">الكاشير</Option>
                    <Option value="waiter">الخدمة</Option>
                    <Option value="admin">الإدارة</Option>
                    <Option value="gaming">الألعاب</Option>
                    <Option value="other">أخرى</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">المنصب</span>}
                  name="position"
                  rules={[{ required: true, message: 'الرجاء إدخال المنصب' }]}
                >
                  <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">نوع التوظيف</span>}
                  name="type"
                  rules={[{ required: true, message: 'الرجاء اختيار نوع التوظيف' }]}
                >
                  <Select className="dark:bg-gray-700">
                    <Option value="monthly">شهري</Option>
                    <Option value="daily">يومي</Option>
                    <Option value="hourly">بالساعة</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<span className="dark:text-gray-200">الحالة</span>}
                  name="status"
                  rules={[{ required: true, message: 'الرجاء اختيار الحالة' }]}
                >
                  <Select className="dark:bg-gray-700">
                    <Option value="active">نشط</Option>
                    <Option value="suspended">موقوف</Option>
                    <Option value="terminated">منتهي</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
            <h4 className="text-md font-bold text-gray-700 dark:text-gray-300 mb-3">التعويضات</h4>
            
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
                          label={<span className="dark:text-gray-200">الراتب الشهري</span>}
                          name="monthly"
                          rules={[{ required: true, message: 'الرجاء إدخال الراتب' }]}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            placeholder="الراتب بالجنيه"
                            className="dark:bg-gray-700 dark:border-gray-600"
                          />
                        </Form.Item>
                      </Col>
                    )}
                    
                    {employmentType === 'daily' && (
                      <Col span={12}>
                        <Form.Item
                          label={<span className="dark:text-gray-200">الأجر اليومي</span>}
                          name="daily"
                          rules={[{ required: true, message: 'الرجاء إدخال الأجر' }]}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            placeholder="الأجر بالجنيه"
                            className="dark:bg-gray-700 dark:border-gray-600"
                          />
                        </Form.Item>
                      </Col>
                    )}
                    
                    {employmentType === 'hourly' && (
                      <Col span={12}>
                        <Form.Item
                          label={<span className="dark:text-gray-200">الأجر بالساعة</span>}
                          name="hourly"
                          rules={[{ required: true, message: 'الرجاء إدخال الأجر' }]}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            placeholder="الأجر بالجنيه"
                            className="dark:bg-gray-700 dark:border-gray-600"
                          />
                        </Form.Item>
                      </Col>
                    )}
                    
                    <Col span={12}>
                      <Form.Item
                        label={<span className="dark:text-gray-200">أجر الساعة الإضافية</span>}
                        name="overtimeHourlyRate"
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          placeholder="الأجر بالجنيه"
                          className="dark:bg-gray-700 dark:border-gray-600"
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
                حفظ التعديلات
              </Button>
              <Button onClick={() => {
                setEditEmployeeModalVisible(false);
                editEmployeeForm.resetFields();
              }}>
                إلغاء
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmployeeProfile;
