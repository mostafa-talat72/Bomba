import React, { useState, useEffect } from 'react';
import { Button, DatePicker, Select, Tag, message, Card, Statistic, Row, Col, Modal, Form, Input, TimePicker, Empty, Spin } from 'antd';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Edit2 } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

dayjs.locale('ar');

const { Option } = Select;
const { TextArea } = Input;

interface AttendanceRecord {
  _id?: string;
  date: string;
  day: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  hours?: number;
  overtime?: number;
  lateMinutes?: number;
  reason?: string;
  excused?: boolean;
  notes?: string;
  dailySalary?: number;
  overtimePay?: number;
  totalPay?: number;
}

interface AttendanceSummary {
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  leaves: number;
  totalHours: number;
  overtimeHours: number;
}

interface DayTime {
  date: string;
  checkIn: any;
  checkOut: any;
}

interface TimeGroup {
  id: string;
  dates: string[];
  checkIn: any;
  checkOut: any;
}

interface AttendanceManagementProps {
  preSelectedEmployeeId?: string;
}

const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ preSelectedEmployeeId }) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [selectedEmployee, setSelectedEmployee] = useState(preSelectedEmployeeId || '');
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [isMarkModalVisible, setIsMarkModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [form] = Form.useForm();
  const [timeMode, setTimeMode] = useState<'same' | 'different' | 'groups'>('same');
  const [dayTimes, setDayTimes] = useState<DayTime[]>([]);
  const [timeGroups, setTimeGroups] = useState<TimeGroup[]>([]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchAttendance();
    }
  }, [selectedEmployee, selectedMonth]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/payroll/employees', { params: { status: 'active' } });
      if (response.success && response.data) {
        setEmployees(Array.isArray(response.data) ? response.data : []);
      } else {
        setEmployees([]);
      }
    } catch (error: any) {
      message.error('فشل في تحميل الموظفين');
      setEmployees([]);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const month = selectedMonth.format('YYYY-MM');
      const response = await api.get(`/payroll/attendance/${selectedEmployee}/${month}`);
      
      if (response.success && response.data) {
        setAttendance(response.data.attendance || []);
        setSummary(response.data.summary || null);
      } else {
        setAttendance([]);
        setSummary(null);
      }
    } catch (error: any) {
      message.error('فشل في تحميل بيانات الحضور');
      setAttendance([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = (record?: AttendanceRecord) => {
    if (record) {
      setEditingRecord(record);
      setTimeMode('same');
      form.setFieldsValue({
        dates: [dayjs(record.date)],
        status: record.status,
        checkIn: record.checkIn ? dayjs(record.checkIn, 'HH:mm') : null,
        checkOut: record.checkOut ? dayjs(record.checkOut, 'HH:mm') : null,
        reason: record.reason,
        excused: record.excused,
        notes: record.notes
      });
      setDayTimes([]);
      setTimeGroups([]);
    } else {
      setEditingRecord(null);
      setTimeMode('same');
      form.resetFields();
      form.setFieldsValue({
        dates: [dayjs()],
        status: 'present'
      });
      setDayTimes([]);
      setTimeGroups([]);
    }
    setIsMarkModalVisible(true);
  };

  const handleDatesChange = (dates: any) => {
    if (!dates || dates.length === 0) {
      setDayTimes([]);
      return;
    }

    // إنشاء قائمة بالأيام المختارة
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
    const newGroup: TimeGroup = {
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

  const updateTimeGroup = (groupId: string, field: 'dates' | 'checkIn' | 'checkOut', value: any) => {
    setTimeGroups(timeGroups.map(g => 
      g.id === groupId ? { ...g, [field]: value } : g
    ));
  };

  const getAvailableDatesForGroup = (currentGroupId: string) => {
    const selectedDates = form.getFieldValue('dates') || [];
    const usedDates = timeGroups
      .filter(g => g.id !== currentGroupId)
      .flatMap(g => g.dates);
    
    return selectedDates.filter((date: any) => 
      !usedDates.includes(date.format('YYYY-MM-DD'))
    );
  };

  const handleSubmit = async (values: any) => {
    try {
      const dates = values.dates || [];
      const status = values.status;
      
      // التحقق من الأوقات فقط للحالات التي تحتاج أوقات
      const needsTimes = status === 'present' || status === 'late' || status === 'half_day';
      
      if (needsTimes) {
        // التحقق حسب الوضع المختار
        if (timeMode === 'same') {
          // التحقق من وجود وقت الحضور على الأقل
          if (!values.checkIn) {
            message.error('الرجاء تحديد وقت الحضور');
            return;
          }
        } else if (timeMode === 'different') {
          // التحقق من أن جميع الأيام لديها أوقات
          const missingTimes = dayTimes.filter(dt => !dt.checkIn);
          if (missingTimes.length > 0) {
            message.error('الرجاء تحديد وقت الحضور لجميع الأيام');
            return;
          }
          
          // التحقق من أن عدد الأيام في dayTimes يساوي عدد الأيام المختارة
          if (dayTimes.length !== dates.length) {
            message.error('خطأ في تحديد الأوقات، الرجاء المحاولة مرة أخرى');
            return;
          }
        } else if (timeMode === 'groups') {
          // التحقق من أن جميع المجموعات لديها أوقات وأيام
          const invalidGroups = timeGroups.filter(g => !g.checkIn || g.dates.length === 0);
          if (invalidGroups.length > 0) {
            message.error('الرجاء تحديد الأيام والأوقات لجميع المجموعات');
            return;
          }
          
          // التحقق من أن جميع الأيام المختارة تم تعيينها لمجموعة
          const allGroupDates = timeGroups.flatMap(g => g.dates);
          const allDates = dates.map((d: any) => d.format('YYYY-MM-DD'));
          const unassignedDates = allDates.filter((d: string) => !allGroupDates.includes(d));
          
          if (unassignedDates.length > 0) {
            const unassignedDatesStr = unassignedDates.map((d: string) => dayjs(d).format('DD/MM/YYYY')).join('، ');
            message.error(`الأيام التالية لم يتم تعيين وقت لها: ${unassignedDatesStr}`);
            return;
          }
          
          // التحقق من عدم وجود أيام مكررة
          if (allGroupDates.length !== new Set(allGroupDates).size) {
            message.error('يوجد أيام مكررة في المجموعات');
            return;
          }
          
          // التحقق من أن جميع الأيام في المجموعات موجودة في الأيام المختارة
          const extraDates = allGroupDates.filter((d: string) => !allDates.includes(d));
          if (extraDates.length > 0) {
            message.error('يوجد أيام في المجموعات غير موجودة في الأيام المختارة');
            return;
          }
        }
      }
      
      let successCount = 0;
      const errors: string[] = [];
      
      // تسجيل الحضور لكل يوم
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const dateStr = date.format('YYYY-MM-DD');
        
        // تحديد الأوقات حسب الوضع المختار (فقط للحالات التي تحتاج أوقات)
        let checkIn = null, checkOut = null;
        
        if (needsTimes) {
          if (timeMode === 'same') {
            checkIn = values.checkIn;
            checkOut = values.checkOut;
          } else if (timeMode === 'different') {
            const dayTime = dayTimes.find(dt => dt.date === dateStr);
            if (!dayTime || !dayTime.checkIn) {
              errors.push(`${date.format('DD/MM/YYYY')}: لم يتم تحديد وقت الحضور`);
              continue;
            }
            checkIn = dayTime.checkIn;
            checkOut = dayTime.checkOut;
          } else if (timeMode === 'groups') {
            const group = timeGroups.find(g => g.dates.includes(dateStr));
            if (!group || !group.checkIn) {
              errors.push(`${date.format('DD/MM/YYYY')}: لم يتم تعيين وقت له`);
              continue;
            }
            checkIn = group.checkIn;
            checkOut = group.checkOut;
          }
        }
        
        const data = {
          employeeId: selectedEmployee,
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
          const errorMsg = error.response?.data?.error || 'خطأ غير معروف';
          errors.push(`${date.format('DD/MM/YYYY')}: ${errorMsg}`);
          console.error(`فشل تسجيل ${dateStr}:`, error);
        }
      }
      
      if (successCount > 0) {
        message.success(`تم تسجيل الحضور لـ ${successCount} يوم بنجاح`);
        if (errors.length > 0) {
          message.warning(`فشل تسجيل ${errors.length} يوم`);
          console.log('الأخطاء:', errors);
        }
        setIsMarkModalVisible(false);
        form.resetFields();
        setDayTimes([]);
        setTimeGroups([]);
        fetchAttendance();
      } else {
        message.error('فشل في تسجيل الحضور لجميع الأيام');
        if (errors.length > 0) {
          console.log('الأخطاء:', errors);
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل في تسجيل الحضور');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      present: 'success',
      absent: 'error',
      late: 'warning',
      leave: 'blue',
      half_day: 'cyan',
      weekly_off: 'default'
    };
    return colors[status] || 'default';
  };

  const getStatusName = (status: string) => {
    const names: any = {
      present: 'حضور',
      absent: 'غياب',
      late: 'تأخير',
      leave: 'إجازة',
      half_day: 'نصف يوم',
      weekly_off: 'إجازة أسبوعية'
    };
    return names[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle size={20} className="text-green-500" />;
      case 'absent':
        return <XCircle size={20} className="text-red-500" />;
      case 'late':
        return <AlertCircle size={20} className="text-yellow-500" />;
      default:
        return <Clock size={20} className="text-gray-500" />;
    }
  };

  return (
    <div>
      {/* Filters */}
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">الموظف</label>
            <Select
              placeholder="اختر موظف"
              value={selectedEmployee}
              onChange={setSelectedEmployee}
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="children"
              size="large"
              className="dark:bg-gray-700"
              disabled={!!preSelectedEmployeeId}
            >
              {employees.map((emp: any) => (
                <Option key={emp._id} value={emp._id}>
                  {emp.personalInfo.name} - {emp.employment.department}
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">الشهر</label>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(date) => date && setSelectedMonth(date)}
              format="YYYY-MM"
              placeholder="اختر الشهر"
              size="large"
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <Button
            type="primary"
            icon={<Calendar size={16} />}
            onClick={() => handleMarkAttendance()}
            disabled={!selectedEmployee}
            size="large"
          >
            تسجيل حضور
          </Button>
        </div>
      </Card>

      {/* Summary Cards */}
      {selectedEmployee && summary && (
        <Row gutter={[16, 16]} className="mb-4">
          <Col xs={12} sm={12} md={6}>
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <Statistic
                title={<span className="dark:text-gray-300">إجمالي أيام العمل</span>}
                value={toArabicNumbers(summary.totalDays)}
                suffix="يوم"
                valueStyle={{ color: '#1890ff' }}
                className="dark:text-gray-100"
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <Statistic
                title={<span className="dark:text-gray-300">أيام الحضور</span>}
                value={toArabicNumbers(summary.present)}
                suffix={`/ ${toArabicNumbers(summary.totalDays)}`}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircle size={20} />}
                className="dark:text-gray-100"
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <Statistic
                title={<span className="dark:text-gray-300">أيام الغياب</span>}
                value={toArabicNumbers(summary.absent)}
                suffix="يوم"
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<XCircle size={20} />}
                className="dark:text-gray-100"
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <Statistic
                title={<span className="dark:text-gray-300">الساعات الإضافية</span>}
                value={toArabicNumbers(summary.overtimeHours)}
                suffix="ساعة"
                valueStyle={{ color: '#faad14' }}
                prefix={<Clock size={20} />}
                className="dark:text-gray-100"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Attendance Cards */}
      {selectedEmployee && (
        loading ? (
          <div className="flex justify-center items-center py-20">
            <Spin size="large" />
          </div>
        ) : attendance.length === 0 ? (
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <Empty description="لا توجد سجلات حضور" />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {attendance.map((record) => (
              <Col xs={24} sm={12} md={8} lg={6} key={record.date}>
                <Card
                  className="h-full hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700"
                >
                  <div className="space-y-3">
                    {/* Date */}
                    <div className="text-center pb-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {toArabicNumbers(dayjs(record.date).format('DD'))}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {record.day}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {toArabicNumbers(dayjs(record.date).format('YYYY-MM'))}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-center gap-2">
                      {getStatusIcon(record.status)}
                      <Tag color={getStatusColor(record.status)}>
                        {getStatusName(record.status)}
                      </Tag>
                      {record.excused && <Tag color="blue">بعذر</Tag>}
                    </div>

                    {/* Times */}
                    {(record.checkIn || record.checkOut) && (
                      <div className="space-y-1 text-sm">
                        {record.checkIn && (
                          <div className="flex justify-between text-gray-600 dark:text-gray-300">
                            <span>الحضور:</span>
                            <span className="font-medium">{formatTime12Hour(record.checkIn)}</span>
                          </div>
                        )}
                        {record.checkOut && (
                          <div className="flex justify-between text-gray-600 dark:text-gray-300">
                            <span>الانصراف:</span>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{formatTime12Hour(record.checkOut)}</span>
                              {record.checkIn && record.checkOut && 
                               parseInt(record.checkOut.split(':')[0]) < parseInt(record.checkIn.split(':')[0]) && (
                                <span className="text-xs text-orange-500 dark:text-orange-400">
                                  (اليوم التالي)
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hours */}
                    {record.hours && record.hours > 0 && (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-300">الساعات:</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {toArabicNumbers(record.hours.toFixed(1))} ساعة
                          </span>
                        </div>
                        {record.overtime !== undefined && record.overtime !== null && record.overtime > 0 && (
                          <div key={`overtime-${record._id}`} className="flex justify-between text-xs mt-1">
                            <span className="text-gray-500 dark:text-gray-400">إضافي:</span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              +{toArabicNumbers(record.overtime.toFixed(1))}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Financial Details */}
                    {(record.dailySalary || record.overtimePay || record.totalPay) && (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                        {record.dailySalary !== undefined && record.dailySalary > 0 && (
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-300">الراتب اليومي:</span>
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {toArabicNumbers(record.dailySalary.toFixed(2))} جنيه
                            </span>
                          </div>
                        )}
                        {record.overtimePay !== undefined && record.overtimePay > 0 && (
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 dark:text-gray-400">قيمة الساعات الإضافية:</span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              +{toArabicNumbers(record.overtimePay.toFixed(2))} جنيه
                            </span>
                          </div>
                        )}
                        {record.totalPay !== undefined && record.totalPay > 0 && (
                          <div className="flex justify-between text-sm font-bold pt-1 border-t border-green-200 dark:border-green-800">
                            <span className="text-gray-700 dark:text-gray-200">الإجمالي:</span>
                            <span className="text-green-700 dark:text-green-300">
                              {toArabicNumbers(record.totalPay.toFixed(2))} جنيه
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Late */}
                    {record.lateMinutes !== undefined && record.lateMinutes !== null && record.lateMinutes > 0 && (
                      <div key={`late-${record._id}`} className="text-xs text-red-600 dark:text-red-400 text-center">
                        تأخير: {toArabicNumbers(record.lateMinutes)} دقيقة
                      </div>
                    )}

                    {/* Reason */}
                    {record.reason && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center italic">
                        {record.reason}
                      </div>
                    )}
                    
                    {/* Edit Button */}
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700 text-center">
                      <Button
                        type="link"
                        size="small"
                        icon={<Edit2 size={14} />}
                        onClick={() => handleMarkAttendance(record)}
                        className="dark:text-blue-400"
                      >
                        تعديل
                      </Button>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )
      )}

      {/* Mark Attendance Modal */}
      <Modal
        title={editingRecord ? 'تعديل الحضور' : 'تسجيل حضور'}
        open={isMarkModalVisible}
        onCancel={() => {
          setIsMarkModalVisible(false);
          setDayTimes([]);
          setTimeGroups([]);
          setTimeMode('same');
        }}
        footer={null}
        width={800}
        className="dark:bg-gray-800"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {editingRecord ? (
            <Form.Item
              label={<span className="dark:text-gray-200">التاريخ</span>}
              name="dates"
              rules={[{ required: true, message: 'الرجاء اختيار التاريخ' }]}
            >
              <DatePicker 
                style={{ width: '100%' }} 
                format="YYYY-MM-DD" 
                className="dark:bg-gray-700 dark:border-gray-600"
                disabled
              />
            </Form.Item>
          ) : (
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
          )}

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
                      {/* خيار استخدام نفس الوقت أو أوقات مختلفة */}
                      {!editingRecord && dates.length > 1 && (
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

                      {/* نفس الوقت لجميع الأيام */}
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

                      {/* مجموعات أيام بأوقات مختلفة */}
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
                                    {/* اختيار الأيام */}
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
                                        {group.dates.map(dateStr => {
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
                                    
                                    {/* الأوقات */}
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
                                    
                                    {/* عرض الأيام المختارة */}
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

                      {/* أوقات مختلفة لكل يوم */}
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
                  setIsMarkModalVisible(false);
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
    </div>
  );
};

// Helper function to format time to 12-hour format
const formatTime12Hour = (time: string) => {
  if (!time) return '';
  
  // Handle both HH:mm and full date formats
  let timeStr = time;
  if (time.includes('T') || time.includes(' ')) {
    const date = new Date(time);
    timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'م' : 'ص';
  const hour12 = hour % 12 || 12;
  
  return `${toArabicNumbers(hour12)}:${toArabicNumbers(minutes)} ${ampm}`;
};

// Helper function to convert numbers to Arabic
const toArabicNumbers = (num: number | string): string => {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/\d/g, (digit) => arabicNumbers[parseInt(digit)]);
};

export default AttendanceManagement;
