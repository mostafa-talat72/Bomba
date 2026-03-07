import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, InputNumber, Input, Select, Tag, message, Card, Row, Col, Empty, Spin } from 'antd';
import { Plus, Check, X, DollarSign, User, Calendar, FileText } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';
import { numberOnlyInputProps, integerOnlyInputProps } from '../../utils/inputHelpers';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';

const { Option } = Select;
const { TextArea } = Input;

interface AdvanceManagementProps {
  preSelectedEmployeeId?: string;
  autoOpenModal?: boolean;
}

const AdvanceManagement: React.FC<AdvanceManagementProps> = ({ preSelectedEmployeeId, autoOpenModal = false }) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [advances, setAdvances] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(autoOpenModal);
  const [form] = Form.useForm();

  // Update dayjs locale when language changes
  useEffect(() => {
    dayjs.locale(i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    fetchAdvances();
    fetchEmployees();
    if (preSelectedEmployeeId) {
      form.setFieldsValue({ employeeId: preSelectedEmployeeId });
    }
    if (autoOpenModal) {
      setIsModalVisible(true);
    }
  }, [preSelectedEmployeeId, autoOpenModal]);

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payroll/advances');
      if (response.success && response.data) {
        setAdvances(Array.isArray(response.data) ? response.data : []);
      } else {
        setAdvances([]);
      }
    } catch (error: any) {
      message.error(t('payroll.advanceManagement.messages.loadAdvancesError'));
      setAdvances([]);
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
      message.error(t('payroll.advanceManagement.messages.loadEmployeesError'));
      setEmployees([]);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      await api.post('/payroll/advances', values);
      message.success(t('payroll.advanceManagement.messages.submitSuccess'));
      setIsModalVisible(false);
      form.resetFields();
      fetchAdvances();
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.advanceManagement.messages.submitError'));
    }
  };

  const handleApprove = async (id: string) => {
    Modal.confirm({
      title: t('payroll.advanceManagement.confirmApprove.title'),
      content: t('payroll.advanceManagement.confirmApprove.content'),
      okText: t('payroll.advanceManagement.confirmApprove.okText'),
      cancelText: t('payroll.advanceManagement.confirmApprove.cancelText'),
      onOk: async () => {
        try {
          await api.put(`/payroll/advances/${id}/status`, { status: 'approved' });
          message.success(t('payroll.advanceManagement.messages.approveSuccess'));
          fetchAdvances();
        } catch (error: any) {
          message.error(error.response?.data?.error || t('payroll.advanceManagement.messages.approveError'));
        }
      }
    });
  };

  const handleReject = async (id: string) => {
    Modal.confirm({
      title: t('payroll.advanceManagement.confirmReject.title'),
      content: t('payroll.advanceManagement.confirmReject.content'),
      okText: t('payroll.advanceManagement.confirmReject.okText'),
      cancelText: t('payroll.advanceManagement.confirmReject.cancelText'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.put(`/payroll/advances/${id}/status`, { status: 'rejected' });
          message.success(t('payroll.advanceManagement.messages.rejectSuccess'));
          fetchAdvances();
        } catch (error: any) {
          message.error(error.response?.data?.error || t('payroll.advanceManagement.messages.rejectError'));
        }
      }
    });
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      pending: 'warning',
      approved: 'success',
      rejected: 'error',
      paid: 'blue',
      completed: 'default'
    };
    return colors[status] || 'default';
  };

  const getStatusName = (status: string) => {
    return t(`payroll.advanceManagement.status.${status}`, status);
  };

  return (
    <div>
      {/* Header */}
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold dark:text-gray-100">{t('payroll.advanceManagement.title')}</h3>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsModalVisible(true)}
          >
            {t('payroll.advanceManagement.addNew')}
          </Button>
        </div>
      </Card>

      {/* Advances Cards */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Spin size="large" />
        </div>
      ) : advances.length === 0 ? (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <Empty description={t('payroll.advanceManagement.noAdvances')} />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {advances.map((advance) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={advance._id}>
              <Card
                className="h-full hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700"
                actions={
                  advance.status === 'pending'
                    ? [
                        <Button
                          type="link"
                          icon={<Check size={16} />}
                          onClick={() => handleApprove(advance._id)}
                          className="text-green-600 dark:text-green-400"
                        >
                          {t('payroll.advanceManagement.confirmApprove.okText')}
                        </Button>,
                        <Button
                          type="link"
                          danger
                          icon={<X size={16} />}
                          onClick={() => handleReject(advance._id)}
                          className="dark:text-red-400"
                        >
                          {t('payroll.advanceManagement.confirmReject.okText')}
                        </Button>
                      ]
                    : []
                }
              >
                <div className="space-y-3">
                  {/* Employee Name */}
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <User size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
                        {advance.employeeId?.personalInfo?.name || t('payroll.advanceManagement.employee')}
                      </h3>
                      <Tag color={getStatusColor(advance.status)} className="text-xs">
                        {getStatusName(advance.status)}
                      </Tag>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center justify-between py-3 px-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign size={20} className="text-green-600 dark:text-green-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">{t('payroll.advanceManagement.form.amount')}</span>
                    </div>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {advance.amount} {t('common.currency')}
                    </span>
                  </div>

                  {/* Request Date */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Calendar size={16} className="flex-shrink-0" />
                    <span>{t('payroll.pendingAdvances.table.requestDate')}: {dayjs(advance.requestDate).format('DD/MM/YYYY')}</span>
                  </div>

                  {/* Reason */}
                  <div className="flex items-start gap-2 text-sm">
                    <FileText size={16} className="flex-shrink-0 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">{t('payroll.advanceManagement.form.reason')}:</div>
                      <div className="text-gray-700 dark:text-gray-200 line-clamp-2">
                        {advance.reason}
                      </div>
                    </div>
                  </div>

                  {/* Repayment Info */}
                  {advance.repayment && (
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1 text-xs">
                      <div className="flex justify-between text-gray-600 dark:text-gray-300">
                        <span>{t('payroll.advanceManagement.repaymentMethod')}:</span>
                        <span className="font-medium">
                          {advance.repayment.method === 'full' 
                            ? t('payroll.advanceManagement.fullPayment')
                            : t('payroll.advanceManagement.installmentsCount', { count: advance.repayment.installments })}
                        </span>
                      </div>
                      {advance.repayment.method === 'installments' && (
                        <>
                          <div className="flex justify-between text-gray-600 dark:text-gray-300">
                            <span>{t('payroll.pendingAdvances.repayment.installmentsDetail', { amount: '' })}:</span>
                            <span className="font-medium">{advance.repayment.amountPerMonth} {t('common.currency')}</span>
                          </div>
                          {advance.repayment.remainingAmount !== undefined && (
                            <div className="flex justify-between text-gray-600 dark:text-gray-300">
                              <span>{t('common.subtotal')}:</span>
                              <span className="font-medium text-orange-600 dark:text-orange-400">
                                {advance.repayment.remainingAmount} {t('common.currency')}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Request Modal */}
      <Modal
        title={t('payroll.advanceManagement.form.title')}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
        className="dark:bg-gray-800"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.advanceManagement.form.employee')}</span>}
            name="employeeId"
            rules={[{ required: true, message: t('payroll.advanceManagement.form.employeeRequired') }]}
          >
            <Select
              placeholder={t('payroll.advanceManagement.form.employeePlaceholder')}
              showSearch
              optionFilterProp="children"
              className="dark:bg-gray-700"
              disabled={!!preSelectedEmployeeId}
            >
              {employees.map((emp: any) => (
                <Option key={emp._id} value={emp._id}>
                  {emp.personalInfo.name} - {emp.employment.department}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.advanceManagement.form.amount')}</span>}
            name="amount"
            rules={[{ required: true, message: t('payroll.advanceManagement.form.amountRequired') }]}
          >
            <InputNumber
              {...numberOnlyInputProps}
              style={{ width: '100%' }}
              min={0}
              placeholder={t('payroll.advanceManagement.form.amountPlaceholder')}
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.advanceManagement.form.reason')}</span>}
            name="reason"
            rules={[{ required: true, message: t('payroll.advanceManagement.form.reasonRequired') }]}
          >
            <TextArea
              rows={3}
              placeholder={t('payroll.advanceManagement.form.reasonPlaceholder')}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.advanceManagement.form.repaymentMethod')}</span>}
            name={['repayment', 'method']}
            initialValue="installments"
          >
            <Select className="dark:bg-gray-700">
              <Option value="full">{t('payroll.advanceManagement.form.fullPayment')}</Option>
              <Option value="installments">{t('payroll.advanceManagement.form.installments')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.repayment?.method !== currentValues.repayment?.method
            }
          >
            {({ getFieldValue }) => {
              const method = getFieldValue(['repayment', 'method']);
              return (
                method === 'installments' && (
                  <Form.Item
                    label={<span className="dark:text-gray-200">{t('payroll.advanceManagement.form.installmentsCount')}</span>}
                    name={['repayment', 'installments']}
                    rules={[{ required: true, message: t('payroll.advanceManagement.form.installmentsCountRequired') }]}
                  >
                    <InputNumber
                      {...numberOnlyInputProps}
                      style={{ width: '100%' }}
                      min={1}
                      placeholder={t('payroll.advanceManagement.form.installmentsCountPlaceholder')}
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
                {t('payroll.advanceManagement.form.submit')}
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>
                {t('payroll.advanceManagement.form.cancel')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdvanceManagement;
