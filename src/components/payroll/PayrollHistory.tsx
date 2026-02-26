import React, { useState, useEffect } from 'react';
import { Select, Card, Row, Col, Empty, Spin, Tag, Statistic, Timeline, Divider } from 'antd';
import { DollarSign, Calendar, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

interface PayrollRecord {
  _id: string;
  payrollId: string;
  month: string;
  year: number;
  status: string;
  summary: {
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    paidAmount: number;
  };
  attendance: {
    present: number;
    absent: number;
    late: number;
    totalHours: number;
    overtimeHours: number;
    dailyRecords?: Array<{
      date: string;
      day: string;
      status: string;
      hours: number;
      overtime: number;
      dailySalary: number;
      overtimePay: number;
      totalPay: number;
    }>;
  };
}

const PayrollHistory: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchPayrollHistory();
    }
  }, [selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/payroll/employees');
      if (response.success && response.data) {
        setEmployees(Array.isArray(response.data) ? response.data : []);
      } else {
        setEmployees([]);
      }
    } catch (error: any) {
      console.error('فشل في تحميل الموظفين');
      setEmployees([]);
    }
  };

  const fetchPayrollHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/payroll/payrolls/employee/${selectedEmployee}`);
      if (response.success && response.data) {
        setPayrolls(response.data.payrolls || []);
        setStats(response.data.stats || null);
      } else {
        setPayrolls([]);
        setStats(null);
      }
    } catch (error: any) {
      console.error('فشل في تحميل سجل الرواتب');
      setPayrolls([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      draft: 'default',
      pending: 'warning',
      approved: 'processing',
      paid: 'success',
      locked: 'error'
    };
    return colors[status] || 'default';
  };

  const getStatusName = (status: string) => {
    const names: any = {
      draft: 'مسودة',
      pending: 'قيد المراجعة',
      approved: 'معتمد',
      paid: 'مدفوع',
      locked: 'مقفل'
    };
    return names[status] || status;
  };

  const toArabicNumbers = (num: number | string) => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).replace(/\d/g, (d) => arabicNumbers[parseInt(d)]);
  };

  return (
    <div>
      {/* Employee Selector */}
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <span className="text-gray-700 dark:text-gray-200 font-medium">اختر الموظف:</span>
          <Select
            placeholder="اختر موظف"
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            showSearch
            optionFilterProp="children"
            style={{ width: 300 }}
            className="dark:bg-gray-700"
          >
            {employees.map((emp: any) => (
              <Option key={emp._id} value={emp._id}>
                {emp.personalInfo.name} - {emp.employment.department}
              </Option>
            ))}
          </Select>
        </div>
      </Card>

      {!selectedEmployee ? (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <Empty description="الرجاء اختيار موظف لعرض سجل رواتبه" />
        </Card>
      ) : loading ? (
        <div className="flex justify-center items-center py-20">
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* Statistics */}
          {stats && (
            <Row gutter={16} className="mb-4">
              <Col span={6}>
                <Card className="dark:bg-gray-800 dark:border-gray-700">
                  <Statistic
                    title={<span className="dark:text-gray-300">عدد الكشوف</span>}
                    value={toArabicNumbers(stats.totalPayrolls)}
                    prefix={<Calendar size={20} />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className="dark:bg-gray-800 dark:border-gray-700">
                  <Statistic
                    title={<span className="dark:text-gray-300">إجمالي المستحقات</span>}
                    value={toArabicNumbers(stats.totalGross.toFixed(2))}
                    suffix="جنيه"
                    prefix={<TrendingUp size={20} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className="dark:bg-gray-800 dark:border-gray-700">
                  <Statistic
                    title={<span className="dark:text-gray-300">إجمالي الخصومات</span>}
                    value={toArabicNumbers(stats.totalDeductions.toFixed(2))}
                    suffix="جنيه"
                    prefix={<TrendingDown size={20} />}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card className="dark:bg-gray-800 dark:border-gray-700">
                  <Statistic
                    title={<span className="dark:text-gray-300">صافي المدفوع</span>}
                    value={toArabicNumbers(stats.totalNet.toFixed(2))}
                    suffix="جنيه"
                    prefix={<DollarSign size={20} />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* Payroll Timeline */}
          {payrolls.length === 0 ? (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <Empty description="لا يوجد سجل رواتب لهذا الموظف" />
            </Card>
          ) : (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4 dark:text-gray-100">سجل الرواتب</h3>
              <Timeline mode="left">
                {payrolls.map((payroll) => (
                  <Timeline.Item
                    key={payroll._id}
                    color={payroll.status === 'paid' ? 'green' : 'blue'}
                    label={
                      <div className="text-right">
                        <div className="font-medium dark:text-gray-200">
                          {dayjs(payroll.month).format('MMMM YYYY')}
                        </div>
                        <Tag color={getStatusColor(payroll.status)} className="mt-1">
                          {getStatusName(payroll.status)}
                        </Tag>
                      </div>
                    }
                  >
                    <Card size="small" className="dark:bg-gray-700 dark:border-gray-600">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 dark:text-gray-300">رقم الكشف:</span>
                          <span className="font-mono text-sm dark:text-gray-100">{payroll.payrollId}</span>
                        </div>
                        
                        <Divider className="my-2" />
                        
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 dark:text-gray-300">إجمالي المستحقات:</span>
                          <span className="font-bold text-green-600 dark:text-green-400">
                            {toArabicNumbers(payroll.summary.grossSalary.toFixed(2))} جنيه
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 dark:text-gray-300">الخصومات:</span>
                          <span className="font-bold text-red-600 dark:text-red-400">
                            -{toArabicNumbers(payroll.summary.totalDeductions.toFixed(2))} جنيه
                          </span>
                        </div>
                        
                        <Divider className="my-2" />
                        
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 dark:text-gray-200 font-medium">صافي المستحق:</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                            {toArabicNumbers(payroll.summary.netSalary.toFixed(2))} جنيه
                          </span>
                        </div>
                        
                        {payroll.attendance && (
                          <>
                            <Divider className="my-2" />
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <Clock size={14} className="text-gray-400" />
                                <span className="text-gray-600 dark:text-gray-300">
                                  حضور: {toArabicNumbers(payroll.attendance.present)} يوم
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock size={14} className="text-gray-400" />
                                <span className="text-gray-600 dark:text-gray-300">
                                  ساعات: {toArabicNumbers(payroll.attendance.totalHours.toFixed(1))}
                                </span>
                              </div>
                            </div>
                            
                            {/* Daily Records */}
                            {payroll.attendance.dailyRecords && payroll.attendance.dailyRecords.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">
                                  تفاصيل الحضور اليومي:
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                  <table className="w-full text-xs">
                                    <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                                      <tr>
                                        <th className="px-2 py-1 text-right">التاريخ</th>
                                        <th className="px-2 py-1 text-right">الحالة</th>
                                        <th className="px-2 py-1 text-right">الساعات</th>
                                        <th className="px-2 py-1 text-right">الراتب</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {payroll.attendance.dailyRecords.map((record: any, idx: number) => (
                                        <tr key={idx} className="border-b border-gray-200 dark:border-gray-600">
                                          <td className="px-2 py-1">
                                            {dayjs(record.date).format('DD/MM')}
                                          </td>
                                          <td className="px-2 py-1">
                                            <Tag 
                                              color={
                                                record.status === 'present' ? 'green' :
                                                record.status === 'late' ? 'orange' :
                                                record.status === 'absent' ? 'red' : 'default'
                                              }
                                              className="text-xs"
                                            >
                                              {
                                                record.status === 'present' ? 'حاضر' :
                                                record.status === 'late' ? 'متأخر' :
                                                record.status === 'absent' ? 'غائب' :
                                                record.status === 'leave' ? 'إجازة' :
                                                record.status
                                              }
                                            </Tag>
                                          </td>
                                          <td className="px-2 py-1">
                                            {record.hours ? toArabicNumbers(record.hours.toFixed(1)) : '-'}
                                            {record.overtime > 0 && (
                                              <span className="text-blue-600 dark:text-blue-400 mr-1">
                                                (+{toArabicNumbers(record.overtime.toFixed(1))})
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-2 py-1">
                                            {record.totalPay !== undefined && record.totalPay > 0 ? (
                                              <span className="text-green-600 dark:text-green-400 font-medium">
                                                {toArabicNumbers(record.totalPay.toFixed(2))}
                                              </span>
                                            ) : '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </Card>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default PayrollHistory;
