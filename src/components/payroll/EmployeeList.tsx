import React, { useState, useEffect } from 'react';
import { Button, Tag, Input, Select, Modal, Form, InputNumber, message, Card, Row, Col, Empty, Spin, DatePicker, ConfigProvider } from 'antd';
import { Plus, Trash2, Search, User, Phone, Briefcase } from 'lucide-react';
import api from '../../services/api';
import EmployeeProfile from './EmployeeProfile';
import { numberOnlyInputProps } from '../../utils/inputHelpers';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';

const { Option } = Select;

interface Employee {
  _id: string;
  personalInfo: {
    name: string;
    phone: string;
    nationalId?: string;
    hireDate?: string;
  };
  employment: {
    type: string;
    department: string;
    position: string;
    status: string;
  };
  compensation: {
    monthly: number;
    daily: number;
    hourly: number;
    overtimeHourlyRate: number;
  };
}

interface EmployeeListProps {
  onAdvanceAdded?: () => void;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ onAdvanceAdded }) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [form] = Form.useForm();

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
    fetchEmployees();
  }, [filterStatus, filterDepartment]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (filterDepartment) params.department = filterDepartment;
      if (searchText) params.search = searchText;

      const response = await api.get('/payroll/employees', { params });
      if (response.success && response.data) {
        setEmployees(Array.isArray(response.data) ? response.data : []);
      } else {
        setEmployees([]);
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.employeeList.messages.loadError'));
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchEmployees();
  };

  const handleAdd = () => {
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: t('payroll.employeeList.deleteModal.title'),
      content: (
        <div className="space-y-2">
          <p>{t('payroll.employeeList.deleteModal.description')}</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>{t('payroll.employeeList.deleteModal.terminate')}:</strong> {t('payroll.employeeList.deleteModal.terminateInfo')}</li>
            <li><strong>{t('payroll.employeeList.deleteModal.permanentDelete')}:</strong> {t('payroll.employeeList.deleteModal.deleteInfo')}</li>
          </ul>
        </div>
      ),
      okText: t('payroll.employeeList.deleteModal.terminate'),
      cancelText: t('payroll.employeeList.deleteModal.cancel'),
      okButtonProps: { danger: false, type: 'primary' },
      onOk: async () => {
        try {
          await api.put(`/payroll/employees/${id}`, {
            employment: { status: 'terminated' }
          });
          message.success(t('payroll.employeeList.messages.terminateSuccess'));
          fetchEmployees();
        } catch (error: any) {
          message.error(error.response?.data?.error || t('payroll.employeeList.messages.terminateError'));
        }
      },
      footer: (_, { OkBtn, CancelBtn }) => (
        <div className="flex gap-2 justify-end">
          <CancelBtn />
          <OkBtn />
          <Button
            danger
            onClick={() => {
              Modal.destroyAll();
              Modal.confirm({
                title: t('payroll.employeeList.deleteModal.confirmDeleteTitle'),
                content: t('payroll.employeeList.deleteModal.confirmDeleteMessage'),
                okText: t('payroll.employeeList.deleteModal.permanentDelete'),
                cancelText: t('payroll.employeeList.deleteModal.cancel'),
                okButtonProps: { danger: true },
                onOk: async () => {
                  try {
                    await api.delete(`/payroll/employees/${id}`);
                    message.success(t('payroll.employeeList.messages.deleteSuccess'));
                    fetchEmployees();
                  } catch (error: any) {
                    message.error(error.response?.data?.error || t('payroll.employeeList.messages.deleteError'));
                  }
                }
              });
            }}
          >
            {t('payroll.employeeList.deleteModal.permanentDelete')}
          </Button>
        </div>
      )
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        personalInfo: {
          name: values.name,
          phone: values.phone,
          nationalId: values.nationalId,
          hireDate: values.hireDate ? values.hireDate.toISOString() : new Date().toISOString()
        },
        employment: {
          type: values.type,
          department: values.department,
          position: values.position,
          status: 'active'
        },
        compensation: {
          monthly: values.monthly || 0,
          daily: values.daily || 0,
          hourly: values.hourly || 0,
          overtimeHourlyRate: values.overtimeHourlyRate || 0
        }
      };

      await api.post('/payroll/employees', data);
      message.success(t('payroll.employeeList.messages.addSuccess'));
      setIsModalVisible(false);
      fetchEmployees();
    } catch (error: any) {
      message.error(error.response?.data?.error || t('payroll.employeeList.messages.saveError'));
    }
  };

  const getCompensationDisplay = (employee: Employee) => {
    if (employee.employment.type === 'monthly') {
      return `${employee.compensation.monthly} ${t('payroll.employeeList.compensation.perMonth')}`;
    } else if (employee.employment.type === 'daily') {
      return `${employee.compensation.daily} ${t('payroll.employeeList.compensation.perDay')}`;
    } else {
      return `${employee.compensation.hourly} ${t('payroll.employeeList.compensation.perHour')}`;
    }
  };

  const getDepartmentName = (dept: string) => {
    return t(`payroll.employeeList.departments.${dept}`, dept);
  };

  const getEmploymentType = (type: string) => {
    return t(`payroll.employeeList.employmentTypes.${type}`, type);
  };

  const getStatusName = (status: string) => {
    return t(`payroll.employeeList.status.${status}`, status);
  };

  const handleCardClick = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
  };

  const handleCloseProfile = () => {
    setSelectedEmployeeId(null);
  };

  // إذا تم اختيار موظف، اعرض صفحة الملف الشخصي
  if (selectedEmployeeId) {
    return <EmployeeProfile employeeId={selectedEmployeeId} onClose={handleCloseProfile} onAdvanceAdded={onAdvanceAdded} />;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Filters */}
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-wrap gap-4">
          <Input
            placeholder={t('payroll.employeeList.search')}
            prefix={<Search size={16} className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            style={{ width: 300 }}
          />
          <Select
            placeholder={t('payroll.employeeList.filters.status')}
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 150 }}
            allowClear
            className="dark:bg-gray-700"
          >
            <Option value="active">{t('payroll.employeeList.status.active')}</Option>
            <Option value="suspended">{t('payroll.employeeList.status.suspended')}</Option>
            <Option value="terminated">{t('payroll.employeeList.status.terminated')}</Option>
          </Select>
          <Select
            placeholder={t('payroll.employeeList.filters.department')}
            value={filterDepartment}
            onChange={setFilterDepartment}
            style={{ width: 150 }}
            allowClear
            className="dark:bg-gray-700"
          >
            <Option value="kitchen">{t('payroll.employeeList.departments.kitchen')}</Option>
            <Option value="cashier">{t('payroll.employeeList.departments.cashier')}</Option>
            <Option value="waiter">{t('payroll.employeeList.departments.waiter')}</Option>
            <Option value="admin">{t('payroll.employeeList.departments.admin')}</Option>
            <Option value="gaming">{t('payroll.employeeList.departments.gaming')}</Option>
          </Select>
          <Button type="primary" onClick={handleSearch}>
            {t('payroll.employeeList.searchButton')}
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={handleAdd}>
            {t('payroll.employeeList.addEmployee')}
          </Button>
        </div>
      </Card>

      {/* Employee Cards */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Spin size="large" />
        </div>
      ) : employees.length === 0 ? (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <Empty description={t('payroll.employeeList.empty')} />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {employees.map((employee) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={employee._id}>
              <Card
                className="h-full hover:shadow-lg transition-shadow cursor-pointer dark:bg-gray-800 dark:border-gray-700"
                onClick={() => handleCardClick(employee._id)}
                actions={[
                  <Button
                    type="link"
                    danger
                    icon={<Trash2 size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(employee._id);
                    }}
                    className="dark:text-red-400"
                  >
                    {t('payroll.employeeList.deleteButton')}
                  </Button>
                ]}
              >
                <div className="space-y-3">
                  {/* Name */}
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <User size={20} className="text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
                        {employee.personalInfo.name}
                      </h3>
                      <Tag
                        color={employee.employment.status === 'active' ? 'success' : employee.employment.status === 'suspended' ? 'warning' : 'error'}
                        className="text-xs"
                      >
                        {getStatusName(employee.employment.status)}
                      </Tag>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Phone size={16} className="flex-shrink-0" />
                    <span className="truncate">{employee.personalInfo.phone}</span>
                  </div>

                  {/* Department & Position */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Briefcase size={16} className="flex-shrink-0" />
                    <span className="truncate">
                      {getDepartmentName(employee.employment.department)} - {employee.employment.position}
                    </span>
                  </div>

                  {/* Employment Type */}
                  <div>
                    <Tag color={employee.employment.type === 'monthly' ? 'blue' : employee.employment.type === 'daily' ? 'green' : 'orange'}>
                      {getEmploymentType(employee.employment.type)}
                    </Tag>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Add Modal */}
      <ConfigProvider direction={isRTL ? 'rtl' : 'ltr'} locale={getAntdLocale()}>
        <Modal
          title={t('payroll.employeeList.addEmployee')}
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
          width={600}
          className="dark:bg-gray-800"
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeList.form.name')}</span>}
            name="name"
            rules={[{ required: true, message: t('payroll.employeeList.form.nameRequired') }]}
          >
            <Input 
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" 
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeList.form.phone')}</span>}
            name="phone"
            rules={[{ required: true, message: t('payroll.employeeList.form.phoneRequired') }]}
          >
            <Input 
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" 
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </Form.Item>

          <Form.Item label={<span className="dark:text-gray-200">{t('payroll.employeeList.form.nationalId')}</span>} name="nationalId">
            <Input 
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" 
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </Form.Item>

          <Form.Item 
            label={<span className="dark:text-gray-200">{t('payroll.employeeList.form.hireDate')}</span>} 
            name="hireDate"
            rules={[{ required: true, message: t('payroll.employeeList.form.hireDateRequired') }]}
          >
            <DatePicker 
              style={{ width: '100%' }} 
              format="YYYY-MM-DD"
              placeholder={t('payroll.employeeList.form.hireDatePlaceholder')}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeList.form.employmentType')}</span>}
            name="type"
            rules={[{ required: true, message: t('payroll.employeeList.form.employmentTypeRequired') }]}
          >
            <Select className="dark:bg-gray-700">
              <Option value="monthly">{t('payroll.employeeList.employmentTypes.monthly')}</Option>
              <Option value="daily">{t('payroll.employeeList.employmentTypes.daily')}</Option>
              <Option value="hourly">{t('payroll.employeeList.employmentTypes.hourly')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeList.form.department')}</span>}
            name="department"
            rules={[{ required: true, message: t('payroll.employeeList.form.departmentRequired') }]}
          >
            <Select className="dark:bg-gray-700">
              <Option value="kitchen">{t('payroll.employeeList.departments.kitchen')}</Option>
              <Option value="cashier">{t('payroll.employeeList.departments.cashier')}</Option>
              <Option value="waiter">{t('payroll.employeeList.departments.waiter')}</Option>
              <Option value="admin">{t('payroll.employeeList.departments.admin')}</Option>
              <Option value="gaming">{t('payroll.employeeList.departments.gaming')}</Option>
              <Option value="other">{t('payroll.employeeList.departments.other')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">{t('payroll.employeeList.form.position')}</span>}
            name="position"
            rules={[{ required: true, message: t('payroll.employeeList.form.positionRequired') }]}
          >
            <Input 
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" 
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              return (
                <>
                  {type === 'monthly' && (
                    <Form.Item label={<span className="dark:text-gray-200">{t('payroll.employeeList.form.monthlySalary')}</span>} name="monthly">
                      <InputNumber {...numberOnlyInputProps} style={{ width: '100%' }} min={0} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                    </Form.Item>
                  )}
                  {type === 'daily' && (
                    <Form.Item label={<span className="dark:text-gray-200">{t('payroll.employeeList.form.dailyWage')}</span>} name="daily">
                      <InputNumber {...numberOnlyInputProps} style={{ width: '100%' }} min={0} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                    </Form.Item>
                  )}
                  {type === 'hourly' && (
                    <Form.Item label={<span className="dark:text-gray-200">{t('payroll.employeeList.form.hourlyWage')}</span>} name="hourly">
                      <InputNumber {...numberOnlyInputProps} style={{ width: '100%' }} min={0} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                    </Form.Item>
                  )}
                </>
              );
            }}
          </Form.Item>

          <Form.Item 
            label={<span className="dark:text-gray-200">{t('payroll.employeeList.form.overtimeRate')}</span>} 
            name="overtimeHourlyRate"
            tooltip={t('payroll.employeeList.form.overtimeRateTooltip')}
          >
            <InputNumber 
              {...numberOnlyInputProps} style={{ width: '100%' }} 
              min={0} 
              placeholder="0"
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" 
            />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit">
                {t('payroll.employeeList.form.save')}
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>
                {t('payroll.employeeList.form.cancel')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
      </ConfigProvider>
    </div>
  );
};

export default EmployeeList;