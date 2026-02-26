import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, DatePicker, Tag, Space, Descriptions, message, Tabs, InputNumber, Input, Card, Statistic, Row, Col, Divider } from 'antd';
import { Plus, Eye, Check, DollarSign, Lock, Unlock, Printer, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';
import { numberOnlyInputProps, integerOnlyInputProps } from '../../utils/inputHelpers';
import 'dayjs/locale/ar';

dayjs.locale('ar');

const { Option } = Select;
const { TextArea } = Input;

interface Payroll {
  _id: string;
  payrollId: string;
  employeeName: string;
  month: string;
  year: number;
  status: string;
  summary: {
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    paidAmount: number;
    unpaidBalance: number;
    carriedForwardFromPrevious?: number;
    carriedForwardToNext?: number;
    carryforwardDetails?: {
      advances?: Array<{
        advanceId: string;
        originalAmount: number;
        deductedThisMonth: number;
        remainingToCarryforward: number;
        reason: string;
      }>;
      deductions?: Array<{
        type: string;
        originalAmount: number;
        deductedThisMonth: number;
        remainingToCarryforward: number;
        reason: string;
      }>;
    };
  };
  employeeId: any;
  earnings: any;
  deductions: any;
  attendance: any;
}

const PayrollManagement: React.FC = () => {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isGenerateModalVisible, setIsGenerateModalVisible] = useState(false);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [isPayModalVisible, setIsPayModalVisible] = useState(false);
  const [isBulkGenerateModalVisible, setIsBulkGenerateModalVisible] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [form] = Form.useForm();
  const [payForm] = Form.useForm();
  const [bulkForm] = Form.useForm();

  useEffect(() => {
    fetchPayrolls();
    fetchEmployees();
    fetchStats();
  }, [filterMonth, filterStatus]);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterMonth) params.month = filterMonth;
      if (filterStatus) params.status = filterStatus;
      
      const response = await api.get('/payroll/payrolls', { params });
      if (response.success && response.data) {
        setPayrolls(Array.isArray(response.data) ? response.data : []);
      } else {
        setPayrolls([]);
      }
    } catch (error: any) {
      message.error('فشل في تحميل كشوف الرواتب');
      setPayrolls([]);
    } finally {
      setLoading(false);
    }
  };

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

  const fetchStats = async () => {
    try {
      const params: any = {};
      if (filterMonth) params.month = filterMonth;
      
      const response = await api.get('/payroll/payrolls/stats', { params });
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        setStats(null);
      }
    } catch (error: any) {
      console.error('فشل في تحميل الإحصائيات');
      setStats(null);
    }
  };

  const handleGenerate = async (values: any) => {
    try {
      const month = dayjs(values.month).month() + 1;
      const year = dayjs(values.month).year();
      
      await api.post('/payroll/payrolls/generate', {
        employeeId: values.employeeId,
        month,
        year
      });
      
      message.success('تم إنشاء كشف الراتب بنجاح');
      setIsGenerateModalVisible(false);
      form.resetFields();
      fetchPayrolls();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل في إنشاء كشف الراتب');
    }
  };

  const handleView = async (payroll: Payroll) => {
    try {
      const response = await api.get(`/payroll/payrolls/${payroll._id}`);
      setSelectedPayroll(response.data);
      setIsViewModalVisible(true);
    } catch (error: any) {
      message.error('فشل في تحميل التفاصيل');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/payroll/payrolls/${id}/approve`);
      message.success('تم اعتماد كشف الراتب');
      fetchPayrolls();
    } catch (error: any) {
      message.error('فشل في الاعتماد');
    }
  };

  const handlePay = async (values: any) => {
    if (!selectedPayroll) return;
    
    try {
      await api.post(`/payroll/payrolls/${selectedPayroll._id}/pay`, values);
      message.success('تم دفع الراتب بنجاح');
      setIsPayModalVisible(false);
      payForm.resetFields();
      fetchPayrolls();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل في دفع الراتب');
    }
  };

  const handlePrint = async (id: string) => {
    try {
      // Note: This is a simplified version. For proper PDF download,
      // you may need to implement a custom fetch request with blob response
      const response = await api.post(`/payroll/payrolls/${id}/print`, {
        template: 'detailed',
        options: {
          includeAttendanceDetails: true,
          includeReasons: true,
          includeSignatures: true
        }
      });
      
      // If the API returns a PDF URL or base64, handle it here
      if (response.success && response.data) {
        message.success('تم إنشاء كشف الراتب');
        // You can open the PDF in a new window or download it
        // window.open(response.data.pdfUrl, '_blank');
      }
    } catch (error: any) {
      message.error('فشل في طباعة كشف الراتب');
    }
  };


  const handleBulkGenerate = async (values: any) => {
    try {
      const month = dayjs(values.month).month() + 1;
      const year = dayjs(values.month).year();
      
      await api.post('/payroll/payrolls/bulk-generate', {
        employeeIds: values.employeeIds,
        month,
        year
      });
      
      message.success('تم إنشاء كشوف الرواتب بنجاح');
      setIsBulkGenerateModalVisible(false);
      bulkForm.resetFields();
      fetchPayrolls();
      fetchStats();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل في إنشاء كشوف الرواتب');
    }
  };

  const handleLock = async (id: string) => {
    Modal.confirm({
      title: 'قفل كشف الراتب',
      content: 'هل أنت متأكد من قفل هذا الكشف؟ لن يمكن تعديله بعد القفل.',
      okText: 'قفل',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.post(`/payroll/payrolls/${id}/lock`, {
            reason: 'إقفال نهاية الشهر'
          });
          message.success('تم قفل كشف الراتب');
          fetchPayrolls();
        } catch (error: any) {
          message.error('فشل في القفل');
        }
      }
    });
  };

  const handleUnlock = async (id: string) => {
    Modal.confirm({
      title: 'فك قفل كشف الراتب',
      content: 'هل أنت متأكد من فك قفل هذا الكشف؟',
      okText: 'فك القفل',
      cancelText: 'إلغاء',
      onOk: async () => {
        try {
          await api.post(`/payroll/payrolls/${id}/unlock`, {
            reason: 'تعديل البيانات'
          });
          message.success('تم فك قفل كشف الراتب');
          fetchPayrolls();
        } catch (error: any) {
          message.error('فشل في فك القفل');
        }
      }
    });
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

  const columns = [
    {
      title: 'رقم الكشف',
      dataIndex: 'payrollId',
      key: 'payrollId',
      render: (id: string) => <span className="font-mono text-sm">{id}</span>
    },
    {
      title: 'الموظف',
      dataIndex: 'employeeName',
      key: 'employeeName',
      render: (name: string) => <span className="font-medium">{name}</span>
    },
    {
      title: 'الشهر',
      dataIndex: 'month',
      key: 'month',
      render: (month: string) => dayjs(month).format('MMMM YYYY')
    },
    {
      title: 'الإجمالي',
      dataIndex: ['summary', 'grossSalary'],
      key: 'grossSalary',
      render: (amount: number) => (
        <span className="font-medium">{amount.toFixed(2)} جنيه</span>
      )
    },
    {
      title: 'الخصومات',
      dataIndex: ['summary', 'totalDeductions'],
      key: 'totalDeductions',
      render: (amount: number) => (
        <span className="text-red-600">-{amount.toFixed(2)} جنيه</span>
      )
    },
    {
      title: 'الصافي',
      dataIndex: ['summary', 'netSalary'],
      key: 'netSalary',
      render: (amount: number) => (
        <span className="font-bold text-green-600 text-lg">
          {amount.toFixed(2)} جنيه
        </span>
      )
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusName(status)}</Tag>
      )
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      fixed: 'right' as const,
      width: 200,
      render: (_: any, record: Payroll) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<Eye size={14} />}
            onClick={() => handleView(record)}
          >
            عرض
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<Check size={14} />}
              onClick={() => handleApprove(record._id)}
            >
              اعتماد
            </Button>
          )}
          {record.status === 'approved' && (
            <Button
              type="link"
              size="small"
              icon={<DollarSign size={14} />}
              onClick={() => {
                setSelectedPayroll(record);
                payForm.setFieldsValue({ amount: record.summary.netSalary });
                setIsPayModalVisible(true);
              }}
            >
              دفع
            </Button>
          )}
          {record.status === 'paid' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<Lock size={14} />}
              onClick={() => handleLock(record._id)}
            >
              قفل
            </Button>
          )}
          {record.status === 'locked' && (
            <Button
              type="link"
              size="small"
              icon={<Unlock size={14} />}
              onClick={() => handleUnlock(record._id)}
            >
              فك القفل
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<Printer size={14} />}
            onClick={() => handlePrint(record._id)}
          >
            طباعة
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* Statistics Cards */}
      {stats && (
        <Row gutter={16} className="mb-4">
          <Col span={6}>
            <Card>
              <Statistic
                title="إجمالي الكشوف"
                value={stats.total}
                prefix={<FileText size={20} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="إجمالي المستحقات"
                value={stats.totalGrossSalary}
                suffix="جنيه"
                precision={2}
                valueStyle={{ color: '#52c41a' }}
                prefix={<TrendingUp size={20} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="إجمالي الخصومات"
                value={stats.totalDeductions}
                suffix="جنيه"
                precision={2}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<TrendingDown size={20} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="صافي المدفوعات"
                value={stats.totalNetSalary}
                suffix="جنيه"
                precision={2}
                valueStyle={{ color: '#faad14' }}
                prefix={<DollarSign size={20} />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters and Actions */}
      <Card className="mb-4">
        <div className="flex gap-4 items-center justify-between">
          <Space>
            <DatePicker
              picker="month"
              placeholder="تصفية بالشهر"
              onChange={(date) => setFilterMonth(date ? date.format('YYYY-MM') : '')}
              style={{ width: 200 }}
            />
            <Select
              placeholder="تصفية بالحالة"
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 150 }}
              allowClear
            >
              <Option value="draft">مسودة</Option>
              <Option value="pending">قيد المراجعة</Option>
              <Option value="approved">معتمد</Option>
              <Option value="paid">مدفوع</Option>
              <Option value="locked">مقفل</Option>
            </Select>
          </Space>

          <Space>
            <Button
              type="default"
              icon={<Plus size={16} />}
              onClick={() => setIsBulkGenerateModalVisible(true)}
            >
              إنشاء دفعة
            </Button>
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => setIsGenerateModalVisible(true)}
            >
              إنشاء كشف راتب
            </Button>
          </Space>
        </div>
      </Card>

      {/* Payrolls Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={payrolls}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `إجمالي ${total} كشف` }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Generate Modal */}
      <Modal
        title="إنشاء كشف راتب"
        open={isGenerateModalVisible}
        onCancel={() => setIsGenerateModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleGenerate}>
          <Form.Item
            label="الموظف"
            name="employeeId"
            rules={[{ required: true, message: 'الرجاء اختيار الموظف' }]}
          >
            <Select placeholder="اختر موظف" showSearch optionFilterProp="children">
              {employees.map((emp: any) => (
                <Option key={emp._id} value={emp._id}>
                  {emp.personalInfo.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="الشهر"
            name="month"
            rules={[{ required: true, message: 'الرجاء اختيار الشهر' }]}
          >
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                إنشاء
              </Button>
              <Button onClick={() => setIsGenerateModalVisible(false)}>
                إلغاء
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Generate Modal */}
      <Modal
        title="إنشاء كشوف رواتب دفعة واحدة"
        open={isBulkGenerateModalVisible}
        onCancel={() => setIsBulkGenerateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={bulkForm} layout="vertical" onFinish={handleBulkGenerate}>
          <Form.Item
            label="الموظفين"
            name="employeeIds"
            rules={[{ required: true, message: 'الرجاء اختيار الموظفين' }]}
          >
            <Select
              mode="multiple"
              placeholder="اختر الموظفين"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option: any) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {employees.map((emp: any) => (
                <Option key={emp._id} value={emp._id}>
                  {emp.personalInfo.name} - {emp.employment.department}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="الشهر"
            name="month"
            rules={[{ required: true, message: 'الرجاء اختيار الشهر' }]}
          >
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                إنشاء الكشوف
              </Button>
              <Button onClick={() => setIsBulkGenerateModalVisible(false)}>
                إلغاء
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* View Modal - Enhanced */}
      <Modal
        title={
          <div className="flex items-center justify-between">
            <span>تفاصيل كشف الراتب</span>
            {selectedPayroll && (
              <Tag color={getStatusColor(selectedPayroll.status)}>
                {getStatusName(selectedPayroll.status)}
              </Tag>
            )}
          </div>
        }
        open={isViewModalVisible}
        onCancel={() => setIsViewModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedPayroll && (
          <div>
            {/* Header Info */}
            <Card className="mb-4" size="small">
              <Descriptions column={3} size="small">
                <Descriptions.Item label="الموظف">
                  <span className="font-medium">{selectedPayroll.employeeName}</span>
                </Descriptions.Item>
                <Descriptions.Item label="الشهر">
                  {dayjs(selectedPayroll.month).format('MMMM YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label="رقم الكشف">
                  <span className="font-mono text-sm">{selectedPayroll.payrollId}</span>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Tabs 
              defaultActiveKey="summary"
              items={[
                {
                  key: 'summary',
                  label: 'الملخص',
                  children: (
                    <>
                      <Row gutter={16} className="mb-4">
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="إجمالي المستحقات"
                              value={selectedPayroll.summary.grossSalary}
                              suffix="جنيه"
                              precision={2}
                              valueStyle={{ color: '#52c41a' }}
                            />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="إجمالي الخصومات"
                              value={selectedPayroll.summary.totalDeductions}
                              suffix="جنيه"
                              precision={2}
                              valueStyle={{ color: '#ff4d4f' }}
                            />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="صافي المستحق"
                              value={selectedPayroll.summary.netSalary}
                              suffix="جنيه"
                              precision={2}
                              valueStyle={{ color: '#1890ff', fontSize: '24px', fontWeight: 'bold' }}
                            />
                          </Card>
                        </Col>
                      </Row>
                      
                      {/* Carryforward Information */}
                      {((selectedPayroll.summary.carriedForwardFromPrevious || 0) > 0 || (selectedPayroll.summary.carriedForwardToNext || 0) > 0) && (
                        <Card className="mb-4" title="معلومات الترحيل" size="small">
                          <Row gutter={16}>
                            {(selectedPayroll.summary.carriedForwardFromPrevious || 0) > 0 && (
                              <Col span={12}>
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded">
                                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">مرحل من الشهر السابق</div>
                                  <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                                    {(selectedPayroll.summary.carriedForwardFromPrevious || 0).toFixed(2)} جنيه
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    (تم خصمه من هذا الشهر)
                                  </div>
                                </div>
                              </Col>
                            )}
                            {(selectedPayroll.summary.carriedForwardToNext || 0) > 0 && (
                              <Col span={12}>
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded">
                                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">مرحل للشهر التالي</div>
                                  <div className="text-xl font-bold text-red-600 dark:text-red-400">
                                    {(selectedPayroll.summary.carriedForwardToNext || 0).toFixed(2)} جنيه
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    (لم يمكن خصمه من هذا الشهر)
                                  </div>
                                </div>
                              </Col>
                            )}
                          </Row>
                          
                          {/* Carryforward Details */}
                          {selectedPayroll.summary.carryforwardDetails && (
                            <div className="mt-4">
                              {selectedPayroll.summary.carryforwardDetails.advances && selectedPayroll.summary.carryforwardDetails.advances.length > 0 && (
                                <div className="mb-3">
                                  <div className="font-medium text-sm mb-2">تفاصيل السلف المرحلة:</div>
                                  {selectedPayroll.summary.carryforwardDetails.advances.map((adv: any, idx: number) => (
                                    <div key={idx} className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded mb-1">
                                      <div className="flex justify-between">
                                        <span>{adv.reason}</span>
                                        <span className="font-medium">{adv.remainingToCarryforward.toFixed(2)} جنيه</span>
                                      </div>
                                      <div className="text-gray-500 dark:text-gray-400 mt-1">
                                        المبلغ الأصلي: {adv.originalAmount.toFixed(2)} | المخصوم: {adv.deductedThisMonth.toFixed(2)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {selectedPayroll.summary.carryforwardDetails.deductions && selectedPayroll.summary.carryforwardDetails.deductions.length > 0 && (
                                <div>
                                  <div className="font-medium text-sm mb-2">تفاصيل الخصومات المرحلة:</div>
                                  {selectedPayroll.summary.carryforwardDetails.deductions.map((ded: any, idx: number) => (
                                    <div key={idx} className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded mb-1">
                                      <div className="flex justify-between">
                                        <span>{ded.reason}</span>
                                        <span className="font-medium">{ded.remainingToCarryforward.toFixed(2)} جنيه</span>
                                      </div>
                                      <div className="text-gray-500 dark:text-gray-400 mt-1">
                                        المبلغ الأصلي: {ded.originalAmount.toFixed(2)} | المخصوم: {ded.deductedThisMonth.toFixed(2)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      )}
                    </>
                  )
                },

                {
                  key: 'earnings',
                  label: 'المستحقات',
                  children: (
                    <Descriptions bordered column={1} size="small">
                      <Descriptions.Item label="الراتب الأساسي">
                        <div className="flex justify-between items-center">
                          <span>{selectedPayroll.earnings?.basic?.amount.toFixed(2)} جنيه</span>
                          <span className="text-xs text-gray-500">
                            {selectedPayroll.earnings?.basic?.calculation}
                          </span>
                        </div>
                      </Descriptions.Item>
                      
                      {selectedPayroll.earnings?.allowancesTotal > 0 && (
                        <Descriptions.Item label="البدلات">
                          <div>
                            {selectedPayroll.earnings?.allowances?.map((allowance: any, index: number) => (
                              <div key={index} className="flex justify-between py-1">
                                <span>{allowance.name}</span>
                                <span>{allowance.amount.toFixed(2)} جنيه</span>
                              </div>
                            ))}
                            <Divider className="my-2" />
                            <div className="flex justify-between font-medium">
                              <span>الإجمالي</span>
                              <span>{selectedPayroll.earnings?.allowancesTotal.toFixed(2)} جنيه</span>
                            </div>
                          </div>
                        </Descriptions.Item>
                      )}
                      
                      {selectedPayroll.earnings?.overtime?.amount > 0 && (
                        <Descriptions.Item label="الساعات الإضافية">
                          <div className="flex justify-between items-center">
                            <span>{selectedPayroll.earnings?.overtime?.amount.toFixed(2)} جنيه</span>
                            <span className="text-xs text-gray-500">
                              {selectedPayroll.earnings?.overtime?.hours} ساعة × {selectedPayroll.earnings?.overtime?.rate.toFixed(2)} جنيه
                            </span>
                          </div>
                        </Descriptions.Item>
                      )}
                      
                      {selectedPayroll.earnings?.commission?.amount > 0 && (
                        <Descriptions.Item label="العمولة">
                          <div className="flex justify-between items-center">
                            <span>{selectedPayroll.earnings?.commission?.amount.toFixed(2)} جنيه</span>
                            <span className="text-xs text-gray-500">
                              {selectedPayroll.earnings?.commission?.rate}% من {selectedPayroll.earnings?.commission?.salesAmount} جنيه
                            </span>
                          </div>
                        </Descriptions.Item>
                      )}
                      
                      {selectedPayroll.earnings?.bonusesTotal > 0 && (
                        <Descriptions.Item label="المكافآت">
                          <div>
                            {selectedPayroll.earnings?.bonuses?.map((bonus: any, index: number) => (
                              <div key={index} className="py-1">
                                <div className="flex justify-between">
                                  <span>{bonus.name}</span>
                                  <span>{bonus.amount.toFixed(2)} جنيه</span>
                                </div>
                                {bonus.reason && (
                                  <div className="text-xs text-gray-500 mt-1">{bonus.reason}</div>
                                )}
                              </div>
                            ))}
                            <Divider className="my-2" />
                            <div className="flex justify-between font-medium">
                              <span>الإجمالي</span>
                              <span>{selectedPayroll.earnings?.bonusesTotal.toFixed(2)} جنيه</span>
                            </div>
                          </div>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  )
                },

                {
                  key: 'deductions',
                  label: 'الخصومات',
                  children: (
                    <Descriptions bordered column={1} size="small">
                      <Descriptions.Item label="التأمينات الاجتماعية">
                        <div className="flex justify-between items-center">
                          <span>{selectedPayroll.deductions?.insurance?.amount?.toFixed(2)} جنيه</span>
                          <span className="text-xs text-gray-500">
                            {selectedPayroll.deductions?.insurance?.rate}% من الأساسي
                          </span>
                        </div>
                      </Descriptions.Item>
                      
                      <Descriptions.Item label="الضرائب">
                        <div className="flex justify-between items-center">
                          <span>{selectedPayroll.deductions?.tax?.amount?.toFixed(2)} جنيه</span>
                          <span className="text-xs text-gray-500">
                            {selectedPayroll.deductions?.tax?.rate}%
                          </span>
                        </div>
                      </Descriptions.Item>
                      
                      {selectedPayroll.deductions?.absenceTotal > 0 && (
                        <Descriptions.Item label="خصم الغياب">
                          <div>
                            {selectedPayroll.deductions?.absence?.map((item: any, index: number) => (
                              <div key={index} className="py-1">
                                <div className="flex justify-between">
                                  <span>{dayjs(item.date).format('DD/MM/YYYY')}</span>
                                  <span>{item.amount.toFixed(2)} جنيه</span>
                                </div>
                                {item.reason && (
                                  <div className="text-xs text-gray-500 mt-1">{item.reason}</div>
                                )}
                              </div>
                            ))}
                            <Divider className="my-2" />
                            <div className="flex justify-between font-medium">
                              <span>الإجمالي</span>
                              <span>{selectedPayroll.deductions?.absenceTotal.toFixed(2)} جنيه</span>
                            </div>
                          </div>
                        </Descriptions.Item>
                      )}
                      
                      {selectedPayroll.deductions?.advancesTotal > 0 && (
                        <Descriptions.Item label="السلف">
                          <div>
                            {selectedPayroll.deductions?.advances?.map((adv: any, index: number) => (
                              <div key={index} className="py-1">
                                <div className="flex justify-between">
                                  <span>قسط {adv.installmentNumber} من {adv.totalInstallments}</span>
                                  <span>{adv.amount.toFixed(2)} جنيه</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  المتبقي: {adv.remainingAfter.toFixed(2)} جنيه
                                </div>
                                {adv.reason && (
                                  <div className="text-xs text-gray-500">{adv.reason}</div>
                                )}
                              </div>
                            ))}
                            <Divider className="my-2" />
                            <div className="flex justify-between font-medium">
                              <span>الإجمالي</span>
                              <span>{selectedPayroll.deductions?.advancesTotal.toFixed(2)} جنيه</span>
                            </div>
                          </div>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  )
                },
                {
                  key: 'attendance',
                  label: 'الحضور',
                  children: (
                    <>
                      <Descriptions bordered column={2} size="small" className="mb-4">
                        <Descriptions.Item label="أيام العمل">{selectedPayroll.attendance?.workingDays}</Descriptions.Item>
                        <Descriptions.Item label="أيام الحضور">{selectedPayroll.attendance?.present}</Descriptions.Item>
                        <Descriptions.Item label="أيام الغياب">{selectedPayroll.attendance?.absent}</Descriptions.Item>
                        <Descriptions.Item label="مرات التأخير">{selectedPayroll.attendance?.late}</Descriptions.Item>
                        <Descriptions.Item label="إجمالي الساعات">{selectedPayroll.attendance?.totalHours}</Descriptions.Item>
                        <Descriptions.Item label="ساعات إضافية">{selectedPayroll.attendance?.overtimeHours}</Descriptions.Item>
                      </Descriptions>
                      
                      {/* Daily Records Table */}
                      {selectedPayroll.attendance?.dailyRecords && selectedPayroll.attendance.dailyRecords.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-bold mb-2">سجل الحضور اليومي</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="bg-gray-100 dark:bg-gray-700">
                                  <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">التاريخ</th>
                                  <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">اليوم</th>
                                  <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">الحالة</th>
                                  <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">الدخول</th>
                                  <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">الخروج</th>
                                  <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">الساعات</th>
                                  <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">إضافي</th>
                                  <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right">الراتب اليومي</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedPayroll.attendance.dailyRecords.map((record: any, index: number) => (
                                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                                      {dayjs(record.date).format('DD/MM/YYYY')}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                                      {record.day}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                                      <Tag 
                                        color={
                                          record.status === 'present' ? 'green' :
                                          record.status === 'late' ? 'orange' :
                                          record.status === 'absent' ? 'red' :
                                          record.status === 'leave' ? 'blue' :
                                          'default'
                                        }
                                        className="text-xs"
                                      >
                                        {
                                          record.status === 'present' ? 'حاضر' :
                                          record.status === 'late' ? 'متأخر' :
                                          record.status === 'absent' ? 'غائب' :
                                          record.status === 'leave' ? 'إجازة' :
                                          record.status === 'half_day' ? 'نصف يوم' :
                                          record.status === 'weekly_off' ? 'راحة' :
                                          record.status
                                        }
                                      </Tag>
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                                      {record.checkIn || '-'}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                                      {record.checkOut || '-'}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                                      {record.hours ? record.hours.toFixed(1) : '-'}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                                      {record.overtime > 0 ? (
                                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                                          {record.overtime.toFixed(1)}
                                        </span>
                                      ) : '-'}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                                      {record.dailySalary !== undefined && record.dailySalary > 0 ? (
                                        <span className="text-green-600 dark:text-green-400 font-bold">
                                          {record.dailySalary.toFixed(2)} جنيه
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
                  )
                }
              ]}
            />

            <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-600">صافي المستحق</div>
                  <div className="text-3xl font-bold text-green-600">
                    {selectedPayroll.summary.netSalary.toFixed(2)} جنيه
                  </div>
                </div>
                {selectedPayroll.summary.unpaidBalance > 0 && (
                  <div className="text-right">
                    <div className="text-sm text-gray-600">المتبقي</div>
                    <div className="text-xl font-bold text-orange-600">
                      {selectedPayroll.summary.unpaidBalance.toFixed(2)} جنيه
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Pay Modal */}
      <Modal
        title="دفع الراتب"
        open={isPayModalVisible}
        onCancel={() => setIsPayModalVisible(false)}
        footer={null}
      >
        <Form form={payForm} layout="vertical" onFinish={handlePay}>
          <Form.Item
            label="المبلغ"
            name="amount"
            rules={[{ required: true, message: 'الرجاء إدخال المبلغ' }]}
          >
            <InputNumber {...numberOnlyInputProps} style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item
            label="طريقة الدفع"
            name="method"
            rules={[{ required: true, message: 'الرجاء اختيار طريقة الدفع' }]}
          >
            <Select>
              <Option value="cash">نقدي</Option>
              <Option value="bank_transfer">تحويل بنكي</Option>
              <Option value="check">شيك</Option>
            </Select>
          </Form.Item>

          <Form.Item label="رقم المرجع" name="reference">
            <Input />
          </Form.Item>

          <Form.Item label="ملاحظات" name="notes">
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                تأكيد الدفع
              </Button>
              <Button onClick={() => setIsPayModalVisible(false)}>
                إلغاء
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PayrollManagement;
