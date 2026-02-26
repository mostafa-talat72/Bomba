import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Button, Space, Table, Tag, Spin, Empty, Divider } from 'antd';
import { DollarSign, TrendingUp, TrendingDown, Users, Calendar, Download, FileText, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

dayjs.locale('ar');

interface PayrollSummaryData {
  month: string;
  year: number;
  totalEmployees: number;
  statistics: {
    totalGrossSalary: number;
    totalDeductions: number;
    totalNetSalary: number;
    totalPaid: number;
    totalUnpaid: number;
    totalUnpaidCurrentMonth: number;
    totalAdvances: number;
    totalOtherDeductions: number;
    totalCarriedForward: number;
    employeesWithDues: number;
    employeesWithDebts: number;
    employeesBalanced: number;
    totalEmployeeDues: number;
    totalEmployeeDebts: number;
  };
  employees: Array<{
    employeeId: string;
    employeeName: string;
    department: string;
    position: string;
    grossSalary: number;
    advances: number;
    otherDeductions: number;
    deductions: number;
    netSalary: number;
    paidAmount: number;
    unpaidBalance: number;
    carriedForward: number;
    totalUnpaid: number;
    status: string;
  }>;
}

const PayrollSummary: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<PayrollSummaryData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());

  useEffect(() => {
    fetchSummary();
  }, [selectedMonth]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      
      const month = selectedMonth.month() + 1; // 1-12
      const year = selectedMonth.year();
      const params = { month, year };
      
      
      const response = await api.get('/payroll/payrolls/summary', { params });
            
      if (response.success && response.data) {
        setSummaryData(response.data);
      } else {
        console.error('Invalid response:', response);
      }
    } catch (error: any) {
      console.error('فشل في تحميل ملخص المرتبات:', error);
      console.error('Error details:', error.response?.data);
      setSummaryData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const month = selectedMonth.month() + 1;
      const year = selectedMonth.year();
      
      // TODO: Implement PDF export
    } catch (error) {
      console.error('فشل في تصدير التقرير');
    }
  };

  const columns = [
    {
      title: 'الموظف',
      dataIndex: 'employeeName',
      key: 'employeeName',
      render: (name: string, record: any) => (
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-gray-500">{record.department} - {record.position}</div>
        </div>
      )
    },
    {
      title: 'الراتب الإجمالي',
      dataIndex: 'grossSalary',
      key: 'grossSalary',
      render: (amount: number) => (
        <span className="font-medium text-green-600">{amount.toFixed(2)} جنيه</span>
      )
    },
    {
      title: 'السلف',
      dataIndex: 'advances',
      key: 'advances',
      render: (amount: number = 0) => (
        <span className="text-orange-600">-{amount.toFixed(2)} جنيه</span>
      )
    },
    {
      title: 'الخصومات الأخرى',
      dataIndex: 'otherDeductions',
      key: 'otherDeductions',
      render: (amount: number = 0) => (
        <span className="text-red-600">-{amount.toFixed(2)} جنيه</span>
      )
    },
    {
      title: 'إجمالي الخصومات',
      dataIndex: 'deductions',
      key: 'deductions',
      render: (amount: number) => (
        <span className="text-red-600 font-medium">-{amount.toFixed(2)} جنيه</span>
      )
    },
    {
      title: 'الصافي',
      dataIndex: 'netSalary',
      key: 'netSalary',
      render: (amount: number) => (
        <span className="font-bold text-blue-600">{amount.toFixed(2)} جنيه</span>
      )
    },
    {
      title: 'المدفوع',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      render: (amount: number) => (
        <span className="text-green-700">{amount.toFixed(2)} جنيه</span>
      )
    },
    {
      title: 'المتبقي (الشهر الحالي)',
      dataIndex: 'unpaidBalance',
      key: 'unpaidBalance',
      render: (amount: number) => (
        <span className={amount > 0 ? 'text-orange-600' : 'text-gray-400'}>
          {amount.toFixed(2)} جنيه
        </span>
      )
    },
    {
      title: 'المرحل من الأشهر السابقة',
      dataIndex: 'carriedForward',
      key: 'carriedForward',
      render: (amount: number = 0) => (
        <span className={amount > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
          {amount.toFixed(2)} جنيه
        </span>
      )
    },
    {
      title: 'إجمالي المتبقي',
      dataIndex: 'totalUnpaid',
      key: 'totalUnpaid',
      render: (amount: number) => (
        <span className={amount > 0 ? 'text-red-700 font-bold' : amount < 0 ? 'text-green-700 font-bold' : 'text-gray-400'}>
          {amount.toFixed(2)} جنيه
        </span>
      )
    },
    {
      title: 'الحالة المالية',
      key: 'financialStatus',
      render: (_: any, record: any) => {
        const totalUnpaid = record.totalUnpaid || 0;
        
        if (totalUnpaid > 0) {
          // الموظف له مستحقات
          return (
            <div className="flex flex-col items-center">
              <Tag color="green" className="font-medium">
                له مستحقات
              </Tag>
              <span className="text-xs text-green-600 font-bold mt-1">
                +{totalUnpaid.toFixed(2)} جنيه
              </span>
            </div>
          );
        } else if (totalUnpaid < 0) {
          // الموظف مديون (عليه فلوس)
          return (
            <div className="flex flex-col items-center">
              <Tag color="red" className="font-medium">
                مديون
              </Tag>
              <span className="text-xs text-red-600 font-bold mt-1">
                {Math.abs(totalUnpaid).toFixed(2)} جنيه
              </span>
            </div>
          );
        } else {
          // متساوي
          return (
            <div className="flex flex-col items-center">
              <Tag color="default" className="font-medium">
                متساوي
              </Tag>
              <span className="text-xs text-gray-500 mt-1">
                0.00 جنيه
              </span>
            </div>
          );
        }
      }
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig: any = {
          draft: { color: 'default', text: 'مسودة' },
          approved: { color: 'processing', text: 'معتمد' },
          paid: { color: 'success', text: 'مدفوع' },
          partial: { color: 'warning', text: 'دفع جزئي' }
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FileText size={28} />
              كشف المصروفات الشامل
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              ملخص مالي شامل لجميع الموظفين
            </p>
          </div>
          
          <Space size="middle">
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(date) => date && setSelectedMonth(date)}
              placeholder="اختر الشهر"
              style={{ width: 200 }}
              format="MMMM YYYY"
            />
            <Button
              icon={<RefreshCw size={16} />}
              onClick={() => fetchSummary()}
            >
              تحديث
            </Button>
            <Button
              type="primary"
              icon={<Download size={16} />}
              onClick={handleExport}
            >
              تصدير PDF
            </Button>
          </Space>
        </div>
      </Card>

      {summaryData ? (
        <>
          {/* Statistics Cards */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card className="hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">عدد الموظفين</p>
                    <p className="text-3xl font-bold text-blue-600">{summaryData.totalEmployees}</p>
                  </div>
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <Users size={32} className="text-blue-600" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card className="hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">لهم مستحقات</p>
                    <p className="text-3xl font-bold text-green-600">
                      {summaryData.statistics.employeesWithDues}
                    </p>
                    <p className="text-xs text-gray-500">موظف</p>
                  </div>
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <TrendingUp size={32} className="text-green-600" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card className="hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">مدينون</p>
                    <p className="text-3xl font-bold text-red-600">
                      {summaryData.statistics.employeesWithDebts}
                    </p>
                    <p className="text-xs text-gray-500">موظف</p>
                  </div>
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <TrendingDown size={32} className="text-red-600" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card className="hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">متساوون</p>
                    <p className="text-3xl font-bold text-gray-600">
                      {summaryData.statistics.employeesBalanced}
                    </p>
                    <p className="text-xs text-gray-500">موظف</p>
                  </div>
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <DollarSign size={32} className="text-gray-600" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card className="hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">إجمالي المستحقات</p>
                    <p className="text-3xl font-bold text-green-600">
                      {summaryData.statistics.totalGrossSalary.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">جنيه</p>
                  </div>
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <TrendingUp size={32} className="text-green-600" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card className="hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">إجمالي الخصومات</p>
                    <p className="text-3xl font-bold text-red-600">
                      {summaryData.statistics.totalDeductions.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">جنيه</p>
                  </div>
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <TrendingDown size={32} className="text-red-600" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">صافي المستحق</p>
                    <p className="text-4xl font-bold text-blue-700 dark:text-blue-400">
                      {summaryData.statistics.totalNetSalary.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">جنيه</p>
                  </div>
                  <div className="w-16 h-16 bg-blue-200 dark:bg-blue-800/50 rounded-full flex items-center justify-center">
                    <DollarSign size={32} className="text-blue-700 dark:text-blue-400" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card className="hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">المدفوع</p>
                    <p className="text-3xl font-bold text-green-700">
                      {summaryData.statistics.totalPaid.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">جنيه</p>
                  </div>
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <DollarSign size={32} className="text-green-700" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card className="hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">المتبقي (الشهر الحالي)</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {summaryData.statistics.totalUnpaidCurrentMonth.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">جنيه</p>
                  </div>
                  <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                    <Calendar size={32} className="text-orange-600" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">إجمالي المستحقات للموظفين</p>
                    <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                      {summaryData.statistics.totalEmployeeDues.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">جنيه</p>
                  </div>
                  <div className="w-16 h-16 bg-green-200 dark:bg-green-800/50 rounded-full flex items-center justify-center">
                    <TrendingUp size={32} className="text-green-700 dark:text-green-400" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">إجمالي ديون الموظفين</p>
                    <p className="text-3xl font-bold text-red-700 dark:text-red-400">
                      {summaryData.statistics.totalEmployeeDebts.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">جنيه</p>
                  </div>
                  <div className="w-16 h-16 bg-red-200 dark:bg-red-800/50 rounded-full flex items-center justify-center">
                    <TrendingDown size={32} className="text-red-700 dark:text-red-400" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-1 font-medium">المرحل من أشهر سابقة</p>
                    <p className={`text-3xl font-bold ${
                      summaryData.statistics.totalCarriedForward > 0 
                        ? 'text-green-700 dark:text-green-400' 
                        : summaryData.statistics.totalCarriedForward < 0
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-gray-700 dark:text-gray-400'
                    }`}>
                      {summaryData.statistics.totalCarriedForward.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {summaryData.statistics.totalCarriedForward > 0 
                        ? 'مستحقات مرحلة' 
                        : summaryData.statistics.totalCarriedForward < 0
                        ? 'ديون مرحلة'
                        : 'لا يوجد'}
                    </p>
                  </div>
                  <div className="w-16 h-16 bg-purple-200 dark:bg-purple-800/50 rounded-full flex items-center justify-center">
                    <Calendar size={32} className="text-purple-700 dark:text-purple-400" />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-2 border-indigo-300 dark:border-indigo-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-1 font-bold">إجمالي المستحقات الكلي</p>
                    <p className={`text-4xl font-extrabold ${
                      summaryData.statistics.totalUnpaid > 0 
                        ? 'text-indigo-700 dark:text-indigo-400' 
                        : summaryData.statistics.totalUnpaid < 0
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-gray-700 dark:text-gray-400'
                    }`}>
                      {summaryData.statistics.totalUnpaid.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                      المتبقي (الشهر الحالي) + المرحل من الأشهر السابقة
                    </p>
                  </div>
                  <div className="w-16 h-16 bg-indigo-200 dark:bg-indigo-800/50 rounded-full flex items-center justify-center">
                    <DollarSign size={32} className="text-indigo-700 dark:text-indigo-400" />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Breakdown Cards */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card 
                title="تفاصيل الخصومات"
                className="h-full"
                styles={{ header: { backgroundColor: '#fee2e2', color: '#991b1b' } }}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">السلف</span>
                    <span className="font-bold text-orange-600">
                      {summaryData.statistics.totalAdvances.toFixed(2)} جنيه
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">خصومات أخرى (غياب، جزاءات، إلخ)</span>
                    <span className="font-bold text-red-600">
                      {summaryData.statistics.totalOtherDeductions?.toFixed(2) || '0.00'} جنيه
                    </span>
                  </div>
                  <Divider className="my-2" />
                  <div className="flex justify-between items-center p-3 bg-red-100 dark:bg-red-900/30 rounded">
                    <span className="font-bold text-gray-800 dark:text-gray-200">إجمالي الخصومات</span>
                    <span className="font-bold text-xl text-red-700">
                      {summaryData.statistics.totalDeductions.toFixed(2)} جنيه
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    السلف + الخصومات الأخرى = {(summaryData.statistics.totalAdvances + (summaryData.statistics.totalOtherDeductions || 0)).toFixed(2)} جنيه
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card 
                title="الملخص المالي"
                className="h-full"
                styles={{ header: { backgroundColor: '#dbeafe', color: '#1e40af' } }}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">إجمالي المستحقات</span>
                    <span className="font-bold text-green-600">
                      +{summaryData.statistics.totalGrossSalary.toFixed(2)} جنيه
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">إجمالي الخصومات</span>
                    <span className="font-bold text-red-600">
                      -{summaryData.statistics.totalDeductions.toFixed(2)} جنيه
                    </span>
                  </div>
                  <Divider className="my-2" />
                  <div className="flex justify-between items-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded">
                    <span className="font-bold text-gray-800 dark:text-gray-200">صافي المستحق</span>
                    <span className="font-bold text-xl text-blue-700">
                      {summaryData.statistics.totalNetSalary.toFixed(2)} جنيه
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    {summaryData.statistics.totalGrossSalary.toFixed(2)} - {summaryData.statistics.totalDeductions.toFixed(2)} = {summaryData.statistics.totalNetSalary.toFixed(2)} جنيه
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card 
                title="المرحل من أشهر سابقة"
                className="h-full"
                styles={{ header: { backgroundColor: '#f3e8ff', color: '#6b21a8' } }}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">مستحقات مرحلة</span>
                    <span className="font-bold text-green-600">
                      +{summaryData.employees
                        .filter((e: any) => (e.carriedForward || 0) > 0)
                        .reduce((sum: number, e: any) => sum + (e.carriedForward || 0), 0)
                        .toFixed(2)} جنيه
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">ديون مرحلة</span>
                    <span className="font-bold text-red-600">
                      {Math.abs(summaryData.employees
                        .filter((e: any) => (e.carriedForward || 0) < 0)
                        .reduce((sum: number, e: any) => sum + (e.carriedForward || 0), 0))
                        .toFixed(2)} جنيه
                    </span>
                  </div>
                  <Divider className="my-2" />
                  <div className={`flex justify-between items-center p-3 rounded ${
                    summaryData.employees.reduce((sum: number, e: any) => sum + (e.carriedForward || 0), 0) > 0
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : summaryData.employees.reduce((sum: number, e: any) => sum + (e.carriedForward || 0), 0) < 0
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <span className="font-bold text-gray-800 dark:text-gray-200">صافي المرحل</span>
                    <span className={`font-bold text-xl ${
                      summaryData.employees.reduce((sum: number, e: any) => sum + (e.carriedForward || 0), 0) > 0
                        ? 'text-green-700'
                        : summaryData.employees.reduce((sum: number, e: any) => sum + (e.carriedForward || 0), 0) < 0
                        ? 'text-red-700'
                        : 'text-gray-700'
                    }`}>
                      {summaryData.employees
                        .reduce((sum: number, e: any) => sum + (e.carriedForward || 0), 0)
                        .toFixed(2)} جنيه
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    {summaryData.employees.filter((e: any) => (e.carriedForward || 0) !== 0).length} موظف لديهم مرحل
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Employees Table */}
          <Card title="تفاصيل الموظفين">
            <Table
              columns={columns}
              dataSource={summaryData.employees}
              rowKey="employeeId"
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `إجمالي ${total} موظف` }}
              scroll={{ x: 1000 }}
            />
          </Card>
        </>
      ) : (
        <Card>
          <Empty 
            description={
              <div className="text-center">
                <p className="text-lg font-medium mb-2">لا توجد بيانات للشهر المحدد</p>
                <p className="text-gray-500 mb-4">
                  لا توجد كشوف رواتب لهذا الشهر.
                </p>
                <div className="text-right max-w-md mx-auto bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="font-medium mb-2">كيفية إنشاء كشف راتب:</p>
                  <ol className="text-sm space-y-2">
                    <li>1. اذهب إلى تبويب "الموظفين"</li>
                    <li>2. اختر موظف واضغط "عرض التفاصيل"</li>
                    <li>3. في صفحة الموظف، اضغط "صرف جزء من المرتب"</li>
                    <li>4. سيتم إنشاء كشف الراتب تلقائياً</li>
                  </ol>
                </div>
              </div>
            }
          />
        </Card>
      )}
    </div>
  );
};

export default PayrollSummary;
