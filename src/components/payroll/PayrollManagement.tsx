import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, DatePicker, Tag, Space, Descriptions, message, Tabs, InputNumber, Input, Card, Statistic, Row, Col, Divider } from 'antd';
import { Plus, Eye, Check, DollarSign, Lock, Unlock, Printer, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useOrganization } from '../../context/OrganizationContext';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';

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
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { getCurrencySymbol } = useOrganization();
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

  // Helper functions to format currency with current language
  const currency = () => getCurrencySymbol(currentLanguage);
  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(2)} ${currency()}`;
  };

  useEffect(() => {
    dayjs.locale(currentLanguage);
  }, [currentLanguage]);

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
      message.error(t('payroll.payrollManagement.messages.loadError'));
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
      message.error(t('payroll.payrollManagement.messages.loadEmployeesError'));
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
      console.error(t('payroll.payrollManagement.messages.loadStatsError'));
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
      
      message.success(t('payroll.payrollManagement.messages.generateSuccess'));
      setIsGenerateModalVisible(false);
      form.resetFields();
      fetchPayrolls();
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.payrollManagement.messages.generateError'));
    }
  };

  const handleView = async (payroll: Payroll) => {
    try {
      const response = await api.get(`/payroll/payrolls/${payroll._id}`);
      setSelectedPayroll(response.data);
      setIsViewModalVisible(true);
    } catch (error: any) {
      message.error(t('payroll.payrollManagement.messages.loadDetailsError'));
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/payroll/payrolls/${id}/approve`);
      message.success(t('payroll.payrollManagement.messages.approveSuccess'));
      fetchPayrolls();
    } catch (error: any) {
      message.error(t('payroll.payrollManagement.messages.approveError'));
    }
  };

  const handlePay = async (values: any) => {
    if (!selectedPayroll) return;
    
    try {
      await api.post(`/payroll/payrolls/${selectedPayroll._id}/pay`, values);
      message.success(t('payroll.payrollManagement.messages.paySuccess'));
      setIsPayModalVisible(false);
      payForm.resetFields();
      fetchPayrolls();
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.payrollManagement.messages.payError'));
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
        message.success(t('payroll.payrollManagement.messages.printSuccess'));
        // You can open the PDF in a new window or download it
        // window.open(response.data.pdfUrl, '_blank');
      }
    } catch (error: any) {
      message.error(t('payroll.payrollManagement.messages.printError'));
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
      
      message.success(t('payroll.payrollManagement.messages.bulkGenerateSuccess'));
      setIsBulkGenerateModalVisible(false);
      bulkForm.resetFields();
      fetchPayrolls();
      fetchStats();
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.payrollManagement.messages.bulkGenerateError'));
    }
  };

  const handleLock = async (id: string) => {
    Modal.confirm({
      title: t('payroll.payrollManagement.confirmLock.title'),
      content: t('payroll.payrollManagement.confirmLock.content'),
      okText: t('payroll.payrollManagement.confirmLock.okText'),
      cancelText: t('payroll.payrollManagement.confirmLock.cancelText'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.post(`/payroll/payrolls/${id}/lock`, {
            reason: t('payroll.payrollManagement.confirmLock.reason')
          });
          message.success(t('payroll.payrollManagement.messages.lockSuccess'));
          fetchPayrolls();
        } catch (error: any) {
          message.error(t('payroll.payrollManagement.messages.lockError'));
        }
      }
    });
  };

  const handleUnlock = async (id: string) => {
    Modal.confirm({
      title: t('payroll.payrollManagement.confirmUnlock.title'),
      content: t('payroll.payrollManagement.confirmUnlock.content'),
      okText: t('payroll.payrollManagement.confirmUnlock.okText'),
      cancelText: t('payroll.payrollManagement.confirmUnlock.cancelText'),
      onOk: async () => {
        try {
          await api.post(`/payroll/payrolls/${id}/unlock`, {
            reason: t('payroll.payrollManagement.confirmUnlock.reason')
          });
          message.success(t('payroll.payrollManagement.messages.unlockSuccess'));
          fetchPayrolls();
        } catch (error: any) {
          message.error(t('payroll.payrollManagement.messages.unlockError'));
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
      draft: t('payroll.payrollManagement.status.draft'),
      pending: t('payroll.payrollManagement.status.pending'),
      approved: t('payroll.payrollManagement.status.approved'),
      paid: t('payroll.payrollManagement.status.paid'),
      locked: t('payroll.payrollManagement.status.locked')
    };
    return names[status] || status;
  };

  const columns = [
    {
      title: t('payroll.payrollManagement.table.payrollId'),
      dataIndex: 'payrollId',
      key: 'payrollId',
      render: (id: string) => <span className="font-mono text-sm">{id}</span>
    },
    {
      title: t('payroll.payrollManagement.table.employee'),
      dataIndex: 'employeeName',
      key: 'employeeName',
      render: (name: string) => <span className="font-medium">{name}</span>
    },
    {
      title: t('payroll.payrollManagement.table.month'),
      dataIndex: 'month',
      key: 'month',
      render: (month: string) => dayjs(month).locale(currentLanguage).format('MMMM YYYY')
    },
    {
      title: t('payroll.payrollManagement.table.gross'),
      dataIndex: ['summary', 'grossSalary'],
      key: 'grossSalary',
      render: (amount: number) => (
        <span className="font-medium">{amount.toFixed(2)} {t('common.currency')}</span>
      )
    },
    {
      title: t('payroll.payrollManagement.table.deductions'),
      dataIndex: ['summary', 'totalDeductions'],
      key: 'totalDeductions',
      render: (amount: number) => (
        <span className="text-red-600">-{amount.toFixed(2)} {t('common.currency')}</span>
      )
    },
    {
      title: t('payroll.payrollManagement.table.net'),
      dataIndex: ['summary', 'netSalary'],
      key: 'netSalary',
      render: (amount: number) => (
        <span className="font-bold text-green-600 text-lg">
          {amount.toFixed(2)} {t('common.currency')}
        </span>
      )
    },
    {
      title: t('payroll.payrollManagement.table.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusName(status)}</Tag>
      )
    },
    {
      title: t('payroll.payrollManagement.table.actions'),
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
            {t('payroll.payrollManagement.actions.view')}
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<Check size={14} />}
              onClick={() => handleApprove(record._id)}
            >
              {t('payroll.payrollManagement.actions.approve')}
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
              {t('payroll.payrollManagement.actions.pay')}
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
              {t('payroll.payrollManagement.actions.lock')}
            </Button>
          )}
          {record.status === 'locked' && (
            <Button
              type="link"
              size="small"
              icon={<Unlock size={14} />}
              onClick={() => handleUnlock(record._id)}
            >
              {t('payroll.payrollManagement.actions.unlock')}
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<Printer size={14} />}
            onClick={() => handlePrint(record._id)}
          >
            {t('payroll.payrollManagement.actions.print')}
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
                title={t('payroll.payrollManagement.statistics.totalPayrolls')}
                value={stats.total}
                prefix={<FileText size={20} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('payroll.payrollManagement.statistics.totalGross')}
                value={stats.totalGrossSalary}
                suffix={currency()}
                precision={2}
                valueStyle={{ color: '#52c41a' }}
                prefix={<TrendingUp size={20} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('payroll.payrollManagement.statistics.totalDeductions')}
                value={stats.totalDeductions}
                suffix={currency()}
                precision={2}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<TrendingDown size={20} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('payroll.payrollManagement.statistics.totalNet')}
                value={stats.totalNetSalary}
                suffix={currency()}
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
              placeholder={t('payroll.payrollManagement.filters.filterByMonth')}
              onChange={(date) => setFilterMonth(date ? date.format('YYYY-MM') : '')}
              style={{ width: 200 }}
            />
            <Select
              placeholder={t('payroll.payrollManagement.filters.filterByStatus')}
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 150 }}
              allowClear
            >
              <Option value="draft">{t('payroll.payrollManagement.status.draft')}</Option>
              <Option value="pending">{t('payroll.payrollManagement.status.pending')}</Option>
              <Option value="approved">{t('payroll.payrollManagement.status.approved')}</Option>
              <Option value="paid">{t('payroll.payrollManagement.status.paid')}</Option>
              <Option value="locked">{t('payroll.payrollManagement.status.locked')}</Option>
            </Select>
          </Space>

          <Space>
            <Button
              type="default"
              icon={<Plus size={16} />}
              onClick={() => setIsBulkGenerateModalVisible(true)}
            >
              {t('payroll.payrollManagement.buttons.bulkGenerate')}
            </Button>
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => setIsGenerateModalVisible(true)}
            >
              {t('payroll.payrollManagement.buttons.generatePayroll')}
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
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => t('payroll.payrollManagement.table.totalPayrolls', { count: total }) }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Generate Modal */}
      <Modal
        title={t('payroll.payrollManagement.modals.generate.title')}
        open={isGenerateModalVisible}
        onCancel={() => setIsGenerateModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleGenerate}>
          <Form.Item
            label={t('payroll.payrollManagement.modals.generate.employee')}
            name="employeeId"
            rules={[{ required: true, message: t('payroll.payrollManagement.modals.generate.employeeRequired') }]}
          >
            <Select placeholder={t('payroll.payrollManagement.modals.generate.selectEmployee')} showSearch optionFilterProp="children">
              {employees.map((emp: any) => (
                <Option key={emp._id} value={emp._id}>
                  {emp.personalInfo.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={t('payroll.payrollManagement.modals.generate.month')}
            name="month"
            rules={[{ required: true, message: t('payroll.payrollManagement.modals.generate.monthRequired') }]}
          >
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('payroll.payrollManagement.modals.generate.create')}
              </Button>
              <Button onClick={() => setIsGenerateModalVisible(false)}>
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Generate Modal */}
      <Modal
        title={t('payroll.payrollManagement.modals.bulkGenerate.title')}
        open={isBulkGenerateModalVisible}
        onCancel={() => setIsBulkGenerateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={bulkForm} layout="vertical" onFinish={handleBulkGenerate}>
          <Form.Item
            label={t('payroll.payrollManagement.modals.bulkGenerate.employees')}
            name="employeeIds"
            rules={[{ required: true, message: t('payroll.payrollManagement.modals.bulkGenerate.employeesRequired') }]}
          >
            <Select
              mode="multiple"
              placeholder={t('payroll.payrollManagement.modals.bulkGenerate.selectEmployees')}
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
            label={t('payroll.payrollManagement.modals.bulkGenerate.month')}
            name="month"
            rules={[{ required: true, message: t('payroll.payrollManagement.modals.bulkGenerate.monthRequired') }]}
          >
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('payroll.payrollManagement.modals.bulkGenerate.createPayrolls')}
              </Button>
              <Button onClick={() => setIsBulkGenerateModalVisible(false)}>
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* View Modal - Enhanced */}
      <Modal
        title={
          <div className="flex items-center justify-between">
            <span>{t('payroll.payrollManagement.viewModal.title')}</span>
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
                <Descriptions.Item label={t('payroll.payrollManagement.viewModal.employee')}>
                  <span className="font-medium">{selectedPayroll.employeeName}</span>
                </Descriptions.Item>
                <Descriptions.Item label={t('payroll.payrollManagement.viewModal.month')}>
                  {dayjs(selectedPayroll.month).locale(currentLanguage).format('MMMM YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label={t('payroll.payrollManagement.viewModal.payrollId')}>
                  <span className="font-mono text-sm">{selectedPayroll.payrollId}</span>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Tabs 
              defaultActiveKey="summary"
              items={[
                {
                  key: 'summary',
                  label: t('payroll.payrollManagement.viewModal.tabs.summary'),
                  children: (
                    <>
                      <Row gutter={16} className="mb-4">
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title={t('payroll.payrollManagement.viewModal.grossSalary')}
                              value={selectedPayroll.summary.grossSalary}
                              suffix={currency()}
                              precision={2}
                              valueStyle={{ color: '#52c41a' }}
                            />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title={t('payroll.payrollManagement.viewModal.totalDeductions')}
                              value={selectedPayroll.summary.totalDeductions}
                              suffix={currency()}
                              precision={2}
                              valueStyle={{ color: '#ff4d4f' }}
                            />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title={t('payroll.payrollManagement.viewModal.netSalary')}
                              value={selectedPayroll.summary.netSalary}
                              suffix={currency()}
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
                                    {formatCurrency((selectedPayroll.summary.carriedForwardFromPrevious || 0))}
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
                                    {formatCurrency((selectedPayroll.summary.carriedForwardToNext || 0))}
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
                                        <span className="font-medium">{formatCurrency(adv.remainingToCarryforward)}</span>
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
                                        <span className="font-medium">{formatCurrency(ded.remainingToCarryforward)}</span>
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
                  label: t('payroll.payrollManagement.viewModal.tabs.earnings'),
                  children: (
                    <Descriptions bordered column={1} size="small">
                      <Descriptions.Item label="الراتب الأساسي">
                        <div className="flex justify-between items-center">
                          <span>{formatCurrency(selectedPayroll.earnings?.basic?.amount)}</span>
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
                                <span>{formatCurrency(allowance.amount)}</span>
                              </div>
                            ))}
                            <Divider className="my-2" />
                            <div className="flex justify-between font-medium">
                              <span>الإجمالي</span>
                              <span>{formatCurrency(selectedPayroll.earnings?.allowancesTotal)}</span>
                            </div>
                          </div>
                        </Descriptions.Item>
                      )}
                      
                      {selectedPayroll.earnings?.overtime?.amount > 0 && (
                        <Descriptions.Item label="الساعات الإضافية">
                          <div className="flex justify-between items-center">
                            <span>{formatCurrency(selectedPayroll.earnings?.overtime?.amount)}</span>
                            <span className="text-xs text-gray-500">
                              {selectedPayroll.earnings?.overtime?.hours} ساعة × {formatCurrency(selectedPayroll.earnings?.overtime?.rate)}
                            </span>
                          </div>
                        </Descriptions.Item>
                      )}
                      
                      {selectedPayroll.earnings?.commission?.amount > 0 && (
                        <Descriptions.Item label="العمولة">
                          <div className="flex justify-between items-center">
                            <span>{formatCurrency(selectedPayroll.earnings?.commission?.amount)}</span>
                            <span className="text-xs text-gray-500">
                              {selectedPayroll.earnings?.commission?.rate}% من {formatCurrency(selectedPayroll.earnings?.commission?.salesAmount)}
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
                                  <span>{formatCurrency(bonus.amount)}</span>
                                </div>
                                {bonus.reason && (
                                  <div className="text-xs text-gray-500 mt-1">{bonus.reason}</div>
                                )}
                              </div>
                            ))}
                            <Divider className="my-2" />
                            <div className="flex justify-between font-medium">
                              <span>الإجمالي</span>
                              <span>{formatCurrency(selectedPayroll.earnings?.bonusesTotal)}</span>
                            </div>
                          </div>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  )
                },

                {
                  key: 'deductions',
                  label: t('payroll.payrollManagement.viewModal.tabs.deductions'),
                  children: (
                    <Descriptions bordered column={1} size="small">
                      <Descriptions.Item label="التأمينات الاجتماعية">
                        <div className="flex justify-between items-center">
                          <span>{formatCurrency(selectedPayroll.deductions?.insurance?.amount || 0)}</span>
                          <span className="text-xs text-gray-500">
                            {selectedPayroll.deductions?.insurance?.rate}% من الأساسي
                          </span>
                        </div>
                      </Descriptions.Item>
                      
                      <Descriptions.Item label="الضرائب">
                        <div className="flex justify-between items-center">
                          <span>{formatCurrency(selectedPayroll.deductions?.tax?.amount || 0)}</span>
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
                                  <span>{formatCurrency(item.amount)}</span>
                                </div>
                                {item.reason && (
                                  <div className="text-xs text-gray-500 mt-1">{item.reason}</div>
                                )}
                              </div>
                            ))}
                            <Divider className="my-2" />
                            <div className="flex justify-between font-medium">
                              <span>الإجمالي</span>
                              <span>{formatCurrency(selectedPayroll.deductions?.absenceTotal)}</span>
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
                                  <span>{formatCurrency(adv.amount)}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  المتبقي: {formatCurrency(adv.remainingAfter)}
                                </div>
                                {adv.reason && (
                                  <div className="text-xs text-gray-500">{adv.reason}</div>
                                )}
                              </div>
                            ))}
                            <Divider className="my-2" />
                            <div className="flex justify-between font-medium">
                              <span>الإجمالي</span>
                              <span>{formatCurrency(selectedPayroll.deductions?.advancesTotal)}</span>
                            </div>
                          </div>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  )
                },
                {
                  key: 'attendance',
                  label: t('payroll.payrollManagement.viewModal.tabs.attendance'),
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
                                          {formatCurrency(record.dailySalary)}
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
                    {formatCurrency(selectedPayroll.summary.netSalary)}
                  </div>
                </div>
                {selectedPayroll.summary.unpaidBalance > 0 && (
                  <div className="text-right">
                    <div className="text-sm text-gray-600">المتبقي</div>
                    <div className="text-xl font-bold text-orange-600">
                      {formatCurrency(selectedPayroll.summary.unpaidBalance)}
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
            <InputNumber style={{ width: '100%' }} min={0} />
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
