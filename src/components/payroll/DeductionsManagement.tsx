import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, InputNumber, Input, Select, DatePicker, Tag, message, Card, Row, Col, Empty, Spin } from 'antd';
import { Plus, Trash2, DollarSign, User, Calendar, FileText } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';
import { numberOnlyInputProps, integerOnlyInputProps } from '../../utils/inputHelpers';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../contexts/LanguageContext';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';

const { Option } = Select;
const { TextArea } = Input;

interface Deduction {
  _id: string;
  employeeId: {
    _id: string;
    personalInfo: {
      name: string;
    };
  };
  type: string;
  amount: number;
  reason: string;
  date: string;
  month: string;
  recurring: boolean;
}

interface DeductionsManagementProps {
  preSelectedEmployeeId?: string;
  autoOpenModal?: boolean;
}

const DeductionsManagement: React.FC<DeductionsManagementProps> = ({ preSelectedEmployeeId, autoOpenModal = false }) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(autoOpenModal);
  const [form] = Form.useForm();

  useEffect(() => {
    dayjs.locale(language);
  }, [language]);

  useEffect(() => {
    fetchDeductions();
    fetchEmployees();
    if (preSelectedEmployeeId) {
      form.setFieldsValue({ employeeId: preSelectedEmployeeId });
    }
    if (autoOpenModal) {
      setIsModalVisible(true);
    }
  }, [preSelectedEmployeeId, autoOpenModal]);

  const fetchDeductions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payroll/deductions');
      if (response.success && response.data) {
        setDeductions(Array.isArray(response.data) ? response.data : []);
      } else {
        setDeductions([]);
      }
    } catch (error: any) {
      message.error(t('payroll.deductionsManagement.messages.loadError'));
      setDeductions([]);
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
      message.error(t('payroll.deductionsManagement.messages.loadEmployeesError'));
      setEmployees([]);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      await api.post('/payroll/deductions', {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        month: values.date.format('YYYY-MM')
      });
      message.success(t('payroll.deductionsManagement.messages.addSuccess'));
      setIsModalVisible(false);
      form.resetFields();
      fetchDeductions();
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.deductionsManagement.messages.addError'));
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: t('payroll.deductionsManagement.confirmDelete.title'),
      content: t('payroll.deductionsManagement.confirmDelete.content'),
      okText: t('payroll.deductionsManagement.confirmDelete.okText'),
      cancelText: t('payroll.deductionsManagement.confirmDelete.cancelText'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/payroll/deductions/${id}`);
          message.success(t('payroll.deductionsManagement.messages.deleteSuccess'));
          fetchDeductions();
        } catch (error: any) {
          message.error(error.response?.data?.error || t('payroll.deductionsManagement.messages.deleteError'));
        }
      }
    });
  };

  const getDeductionTypeName = (type: string) => {
    return t(`payroll.deductionsManagement.types.${type}`, type);
  };

  const getDeductionTypeColor = (type: string) => {
    const colors: any = {
      absence: 'red',
      late: 'orange',
      penalty: 'volcano',
      loan: 'purple',
      insurance: 'blue',
      tax: 'cyan',
      other: 'default'
    };
    return colors[type] || 'default';
  };

  return (
    <div>
      {/* Header */}
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold dark:text-gray-100">{t('payroll.deductionsManagement.title')}</h3>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsModalVisible(true)}
          >
            {t('payroll.deductionsManagement.addNew')}
          </Button>
        </div>
      </Card>

      {/* Deductions Cards */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Spin size="large" />
        </div>
      ) : deductions.length === 0 ? (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <Empty description={t('payroll.deductionsManagement.empty')} />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {deductions.map((deduction) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={deduction._id}>
              <Card
                className="h-full hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700"
                actions={[
                  <Button
                    type="link"
                    danger
                    icon={<Trash2 size={16} />}
                    onClick={() => handleDelete(deduction._id)}
                    className="dark:text-red-400"
                  >
                    {t('payroll.deductionsManagement.delete')}
                  </Button>
                ]}
              >
                <div className="space-y-3">
                  {/* Employee Name */}
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <User size={20} className="text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
                        {deduction.employeeId?.personalInfo?.name || t('payroll.deductionsManagement.employee')}
                      </h3>
                      <Tag color={getDeductionTypeColor(deduction.type)} className="text-xs">
                        {getDeductionTypeName(deduction.type)}
                      </Tag>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center justify-between py-3 px-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign size={20} className="text-red-600 dark:text-red-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">{t('payroll.deductionsManagement.amount')}</span>
                    </div>
                    <span className="text-xl font-bold text-red-600 dark:text-red-400">
                      -{deduction.amount} {t('common.currency')}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Calendar size={16} className="flex-shrink-0" />
                    <span>{t('payroll.deductionsManagement.date')} {dayjs(deduction.date).format('DD/MM/YYYY')}</span>
                  </div>

                  {/* Reason */}
                  <div className="flex items-start gap-2 text-sm">
                    <FileText size={16} className="flex-shrink-0 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">{t('payroll.deductionsManagement.reason')}</div>
                      <div className="text-gray-700 dark:text-gray-200 line-clamp-2">
                        {deduction.reason}
                      </div>
                    </div>
                  </div>

                  {/* Recurring Badge */}
                  {deduction.recurring && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <Tag color="processing" className="text-xs">
                        {t('payroll.deductionsManagement.recurring')}
                      </Tag>
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Add Deduction Modal */}
      <Modal
        title={t('payroll.deductionsManagement.form.title')}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
        className="dark:bg-gray-800"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.deductionsManagement.form.employee')}</span>}
            name="employeeId"
            rules={[{ required: true, message: t('payroll.deductionsManagement.form.employeeRequired') }]}
          >
            <Select
              placeholder={t('payroll.deductionsManagement.form.employeePlaceholder')}
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
            label={<span className="dark:text-gray-200">{t('payroll.deductionsManagement.form.type')}</span>}
            name="type"
            rules={[{ required: true, message: t('payroll.deductionsManagement.form.typeRequired') }]}
          >
            <Select className="dark:bg-gray-700">
              <Option value="absence">{t('payroll.deductionsManagement.types.absence')}</Option>
              <Option value="late">{t('payroll.deductionsManagement.types.late')}</Option>
              <Option value="penalty">{t('payroll.deductionsManagement.types.penalty')}</Option>
              <Option value="loan">{t('payroll.deductionsManagement.types.loan')}</Option>
              <Option value="insurance">{t('payroll.deductionsManagement.types.insurance')}</Option>
              <Option value="tax">{t('payroll.deductionsManagement.types.tax')}</Option>
              <Option value="other">{t('payroll.deductionsManagement.types.other')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.deductionsManagement.form.amount')}</span>}
            name="amount"
            rules={[{ required: true, message: t('payroll.deductionsManagement.form.amountRequired') }]}
          >
            <InputNumber
              {...numberOnlyInputProps} style={{ width: '100%' }}
              min={0}
              placeholder={t('payroll.deductionsManagement.form.amountPlaceholder')}
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.deductionsManagement.form.date')}</span>}
            name="date"
            rules={[{ required: true, message: t('payroll.deductionsManagement.form.dateRequired') }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder={t('payroll.deductionsManagement.form.datePlaceholder')}
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.deductionsManagement.form.reason')}</span>}
            name="reason"
            rules={[{ required: true, message: t('payroll.deductionsManagement.form.reasonRequired') }]}
          >
            <TextArea
              rows={3}
              placeholder={t('payroll.deductionsManagement.form.reasonPlaceholder')}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </Form.Item>

          <Form.Item
            name="recurring"
            valuePropName="checked"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4" />
              <span className="dark:text-gray-200">{t('payroll.deductionsManagement.form.recurring')}</span>
            </label>
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit">
                {t('payroll.deductionsManagement.form.submit')}
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>
                {t('payroll.deductionsManagement.form.cancel')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DeductionsManagement;
