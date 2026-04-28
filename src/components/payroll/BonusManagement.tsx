import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, InputNumber, Input, Select, DatePicker, Tag, message, Card, Row, Col, Empty, Spin, ConfigProvider } from 'antd';
import { Plus, Trash2, DollarSign, User, Calendar, FileText, Award, Edit } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';
import { numberOnlyInputProps } from '../../utils/inputHelpers';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useOrganization } from '../../context/OrganizationContext';
import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';

const { Option } = Select;
const { TextArea } = Input;

interface Bonus {
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
  notes?: string;
}

interface BonusManagementProps {
  preSelectedEmployeeId?: string;
  autoOpenModal?: boolean;
}

const BonusManagement: React.FC<BonusManagementProps> = ({ preSelectedEmployeeId, autoOpenModal = false }) => {
  const { t, i18n } = useTranslation();
  const { currentLanguage, isRTL } = useLanguage();
  const { getCurrencySymbol } = useOrganization();
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(autoOpenModal);
  const [editingBonus, setEditingBonus] = useState<Bonus | null>(null);
  const [form] = Form.useForm();

  const currency = () => getCurrencySymbol(currentLanguage);

  const formatNumber = (num: number | string) => {
    if (currentLanguage === 'ar') {
      const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      return String(num).replace(/\d/g, (d) => arabicNumbers[parseInt(d)]);
    }
    return String(num);
  };

  // Get locale based on current language
  const getAntdLocale = () => {
    switch (i18n.language) {
      case 'ar':
        return arEG;
      case 'fr':
        return frFR;
      case 'en':
      default:
        return enUS;
    }
  };

  useEffect(() => {
    dayjs.locale(currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    fetchBonuses();
    fetchEmployees();
    if (preSelectedEmployeeId) {
      form.setFieldsValue({ employeeId: preSelectedEmployeeId });
    }
    if (autoOpenModal) {
      setIsModalVisible(true);
    }
  }, [preSelectedEmployeeId, autoOpenModal]);

  const fetchBonuses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payroll/bonuses');
      if (response.success && response.data) {
        setBonuses(Array.isArray(response.data) ? response.data : []);
      } else {
        setBonuses([]);
      }
    } catch (error: any) {
      message.error(t('payroll.bonusManagement.messages.loadError'));
      setBonuses([]);
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
      message.error(t('payroll.bonusManagement.messages.loadEmployeesError'));
      setEmployees([]);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        date: values.date.format('YYYY-MM-DD')
      };

      if (editingBonus) {
        await api.put(`/payroll/bonuses/${editingBonus._id}`, payload);
        message.success(t('payroll.bonusManagement.messages.updateSuccess'));
      } else {
        await api.post('/payroll/bonuses', payload);
        message.success(t('payroll.bonusManagement.messages.addSuccess'));
      }
      
      setIsModalVisible(false);
      setEditingBonus(null);
      form.resetFields();
      fetchBonuses();
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.bonusManagement.messages.addError'));
    }
  };

  const handleEdit = (bonus: Bonus) => {
    setEditingBonus(bonus);
    form.setFieldsValue({
      employeeId: bonus.employeeId._id,
      type: bonus.type,
      amount: bonus.amount,
      reason: bonus.reason,
      date: dayjs(bonus.date),
      notes: bonus.notes
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: t('payroll.bonusManagement.confirmDelete.title'),
      content: t('payroll.bonusManagement.confirmDelete.content'),
      okText: t('payroll.bonusManagement.confirmDelete.okText'),
      cancelText: t('payroll.bonusManagement.confirmDelete.cancelText'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/payroll/bonuses/${id}`);
          message.success(t('payroll.bonusManagement.messages.deleteSuccess'));
          fetchBonuses();
        } catch (error: any) {
          message.error(error.response?.data?.error || t('payroll.bonusManagement.messages.deleteError'));
        }
      }
    });
  };

  const getBonusTypeName = (type: string) => {
    return t(`payroll.bonusManagement.types.${type}`, type);
  };

  const getBonusTypeColor = (type: string) => {
    const colors: any = {
      performance: 'green',
      holiday: 'blue',
      achievement: 'purple',
      sales: 'cyan',
      attendance: 'gold',
      overtime: 'orange',
      other: 'default'
    };
    return colors[type] || 'default';
  };

  return (
    <div>
      {/* Header */}
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold dark:text-gray-100">{t('payroll.bonusManagement.title')}</h3>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditingBonus(null);
              form.resetFields();
              setIsModalVisible(true);
            }}
          >
            {t('payroll.bonusManagement.addNew')}
          </Button>
        </div>
      </Card>

      {/* Bonuses Cards */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Spin size="large" />
        </div>
      ) : bonuses.length === 0 ? (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <Empty description={t('payroll.bonusManagement.empty')} />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {bonuses.map((bonus) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={bonus._id}>
              <Card
                className="h-full hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700"
                actions={[
                  <Button
                    type="link"
                    icon={<Edit size={16} />}
                    onClick={() => handleEdit(bonus)}
                    className="dark:text-blue-400"
                  >
                    {t('payroll.bonusManagement.edit')}
                  </Button>,
                  <Button
                    type="link"
                    danger
                    icon={<Trash2 size={16} />}
                    onClick={() => handleDelete(bonus._id)}
                    className="dark:text-red-400"
                  >
                    {t('payroll.bonusManagement.delete')}
                  </Button>
                ]}
              >
                <div className="space-y-3">
                  {/* Employee Name */}
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <Award size={20} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
                        {bonus.employeeId?.personalInfo?.name || t('payroll.bonusManagement.employee')}
                      </h3>
                      <Tag color={getBonusTypeColor(bonus.type)} className="text-xs">
                        {getBonusTypeName(bonus.type)}
                      </Tag>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center justify-between py-3 px-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign size={20} className="text-green-600 dark:text-green-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">{t('payroll.bonusManagement.amount')}</span>
                    </div>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      +{formatNumber(bonus.amount)} {currency()}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Calendar size={16} className="flex-shrink-0" />
                    <span>{t('payroll.bonusManagement.date')} {dayjs(bonus.date).format('DD/MM/YYYY')}</span>
                  </div>

                  {/* Reason */}
                  <div className="flex items-start gap-2 text-sm">
                    <FileText size={16} className="flex-shrink-0 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">{t('payroll.bonusManagement.reason')}</div>
                      <div className="text-gray-700 dark:text-gray-200 line-clamp-2">
                        {bonus.reason}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {bonus.notes && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('payroll.bonusManagement.notes')}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                        {bonus.notes}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Add/Edit Bonus Modal */}
      <ConfigProvider direction={isRTL ? 'rtl' : 'ltr'} locale={getAntdLocale()}>
        <Modal
          title={editingBonus ? t('payroll.bonusManagement.form.editTitle') : t('payroll.bonusManagement.form.title')}
          open={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            setEditingBonus(null);
            form.resetFields();
          }}
          footer={null}
          width={600}
          className="dark:bg-gray-800"
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label={<span className="dark:text-gray-200">{t('payroll.bonusManagement.form.employee')}</span>}
              name="employeeId"
              rules={[{ required: true, message: t('payroll.bonusManagement.form.employeeRequired') }]}
            >
              <Select
                placeholder={t('payroll.bonusManagement.form.employeePlaceholder')}
                showSearch
                optionFilterProp="children"
                className="dark:bg-gray-700"
                disabled={!!preSelectedEmployeeId || !!editingBonus}
              >
                {employees.map((emp: any) => (
                  <Option key={emp._id} value={emp._id}>
                    {emp.personalInfo.name} - {emp.employment.department}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label={<span className="dark:text-gray-200">{t('payroll.bonusManagement.form.type')}</span>}
              name="type"
              rules={[{ required: true, message: t('payroll.bonusManagement.form.typeRequired') }]}
            >
              <Select className="dark:bg-gray-700">
                <Option value="performance">{t('payroll.bonusManagement.types.performance')}</Option>
                <Option value="holiday">{t('payroll.bonusManagement.types.holiday')}</Option>
                <Option value="achievement">{t('payroll.bonusManagement.types.achievement')}</Option>
                <Option value="sales">{t('payroll.bonusManagement.types.sales')}</Option>
                <Option value="attendance">{t('payroll.bonusManagement.types.attendance')}</Option>
                <Option value="overtime">{t('payroll.bonusManagement.types.overtime')}</Option>
                <Option value="other">{t('payroll.bonusManagement.types.other')}</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label={<span className="dark:text-gray-200">{t('payroll.bonusManagement.form.amount')}</span>}
              name="amount"
              rules={[{ required: true, message: t('payroll.bonusManagement.form.amountRequired') }]}
            >
              <InputNumber
                {...numberOnlyInputProps}
                style={{ width: '100%' }}
                min={0}
                placeholder={t('payroll.bonusManagement.form.amountPlaceholder')}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </Form.Item>

            <Form.Item
              label={<span className="dark:text-gray-200">{t('payroll.bonusManagement.form.date')}</span>}
              name="date"
              rules={[{ required: true, message: t('payroll.bonusManagement.form.dateRequired') }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                placeholder={t('payroll.bonusManagement.form.datePlaceholder')}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </Form.Item>

            <Form.Item
              label={<span className="dark:text-gray-200">{t('payroll.bonusManagement.form.reason')}</span>}
              name="reason"
              rules={[{ required: true, message: t('payroll.bonusManagement.form.reasonRequired') }]}
            >
              <TextArea
                rows={3}
                placeholder={t('payroll.bonusManagement.form.reasonPlaceholder')}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </Form.Item>

            <Form.Item
              label={<span className="dark:text-gray-200">{t('payroll.bonusManagement.form.notes')}</span>}
              name="notes"
            >
              <TextArea
                rows={2}
                placeholder={t('payroll.bonusManagement.form.notesPlaceholder')}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </Form.Item>

            <Form.Item>
              <div className="flex gap-2">
                <Button type="primary" htmlType="submit">
                  {editingBonus ? t('payroll.bonusManagement.form.update') : t('payroll.bonusManagement.form.submit')}
                </Button>
                <Button onClick={() => {
                  setIsModalVisible(false);
                  setEditingBonus(null);
                  form.resetFields();
                }}>
                  {t('payroll.bonusManagement.form.cancel')}
                </Button>
              </div>
            </Form.Item>
          </Form>
        </Modal>
      </ConfigProvider>
    </div>
  );
};

export default BonusManagement;
