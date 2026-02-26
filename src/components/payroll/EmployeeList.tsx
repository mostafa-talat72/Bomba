import React, { useState, useEffect } from 'react';
import { Button, Tag, Input, Select, Modal, Form, InputNumber, message, Card, Row, Col, Empty, Spin, DatePicker } from 'antd';
import { Plus, Trash2, Search, User, Phone, Briefcase, DollarSign } from 'lucide-react';
import api from '../../services/api';
import EmployeeProfile from './EmployeeProfile';
import dayjs from 'dayjs';

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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [form] = Form.useForm();

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
      message.error(error.response?.data?.error || 'فشل في تحميل الموظفين');
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
      title: 'ماذا تريد أن تفعل؟',
      content: (
        <div className="space-y-2">
          <p>اختر الإجراء المناسب لهذا الموظف:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>إنهاء الخدمة:</strong> سيتم الاحتفاظ بجميع البيانات والسجلات</li>
            <li><strong>حذف نهائي:</strong> سيتم حذف الموظف وجميع بياناته بشكل دائم</li>
          </ul>
        </div>
      ),
      okText: 'إنهاء الخدمة',
      cancelText: 'إلغاء',
      okButtonProps: { danger: false, type: 'primary' },
      onOk: async () => {
        try {
          await api.put(`/payroll/employees/${id}`, {
            employment: { status: 'terminated' }
          });
          message.success('تم إنهاء خدمة الموظف بنجاح');
          fetchEmployees();
        } catch (error: any) {
          message.error(error.response?.data?.error || 'فشل في إنهاء خدمة الموظف');
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
                title: 'تأكيد الحذف النهائي',
                content: 'هل أنت متأكد من حذف هذا الموظف نهائياً؟ لا يمكن التراجع عن هذا الإجراء!',
                okText: 'حذف نهائي',
                cancelText: 'إلغاء',
                okButtonProps: { danger: true },
                onOk: async () => {
                  try {
                    await api.delete(`/payroll/employees/${id}`);
                    message.success('تم حذف الموظف بنجاح');
                    fetchEmployees();
                  } catch (error: any) {
                    message.error(error.response?.data?.error || 'فشل في حذف الموظف');
                  }
                }
              });
            }}
          >
            حذف نهائي
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
      message.success('تم إضافة الموظف بنجاح');
      setIsModalVisible(false);
      fetchEmployees();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل في حفظ البيانات');
    }
  };

  const getCompensationDisplay = (employee: Employee) => {
    if (employee.employment.type === 'monthly') {
      return `${employee.compensation.monthly} جنيه/شهر`;
    } else if (employee.employment.type === 'daily') {
      return `${employee.compensation.daily} جنيه/يوم`;
    } else {
      return `${employee.compensation.hourly} جنيه/ساعة`;
    }
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
    <div>
      {/* Filters */}
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-wrap gap-4">
          <Input
            placeholder="بحث بالاسم أو الهاتف..."
            prefix={<Search size={16} className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            style={{ width: 300 }}
          />
          <Select
            placeholder="الحالة"
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 150 }}
            allowClear
            className="dark:bg-gray-700"
          >
            <Option value="active">نشط</Option>
            <Option value="suspended">موقوف</Option>
            <Option value="terminated">منتهي</Option>
          </Select>
          <Select
            placeholder="القسم"
            value={filterDepartment}
            onChange={setFilterDepartment}
            style={{ width: 150 }}
            allowClear
            className="dark:bg-gray-700"
          >
            <Option value="kitchen">المطبخ</Option>
            <Option value="cashier">الكاشير</Option>
            <Option value="waiter">الخدمة</Option>
            <Option value="admin">الإدارة</Option>
            <Option value="gaming">الألعاب</Option>
          </Select>
          <Button type="primary" onClick={handleSearch}>
            بحث
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={handleAdd}>
            إضافة موظف
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
          <Empty description="لا يوجد موظفين" />
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
                    حذف
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

                  {/* Compensation */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <DollarSign size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span className="font-bold text-green-600 dark:text-green-400 truncate">
                      {getCompensationDisplay(employee)}
                    </span>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Add Modal */}
      <Modal
        title="إضافة موظف"
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
            label={<span className="dark:text-gray-200">الاسم</span>}
            name="name"
            rules={[{ required: true, message: 'الرجاء إدخال الاسم' }]}
          >
            <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">الهاتف</span>}
            name="phone"
            rules={[{ required: true, message: 'الرجاء إدخال الهاتف' }]}
          >
            <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item label={<span className="dark:text-gray-200">الرقم القومي</span>} name="nationalId">
            <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </Form.Item>

          <Form.Item 
            label={<span className="dark:text-gray-200">تاريخ التوظيف</span>} 
            name="hireDate"
            rules={[{ required: true, message: 'الرجاء اختيار تاريخ التوظيف' }]}
          >
            <DatePicker 
              style={{ width: '100%' }} 
              format="YYYY-MM-DD"
              placeholder="اختر تاريخ التوظيف"
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </Form.Item>

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

          <Form.Item
            label={<span className="dark:text-gray-200">الوظيفة</span>}
            name="position"
            rules={[{ required: true, message: 'الرجاء إدخال الوظيفة' }]}
          >
            <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
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
                    <Form.Item label={<span className="dark:text-gray-200">الراتب الشهري</span>} name="monthly">
                      <InputNumber style={{ width: '100%' }} min={0} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                    </Form.Item>
                  )}
                  {type === 'daily' && (
                    <Form.Item label={<span className="dark:text-gray-200">الأجر اليومي</span>} name="daily">
                      <InputNumber style={{ width: '100%' }} min={0} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                    </Form.Item>
                  )}
                  {type === 'hourly' && (
                    <Form.Item label={<span className="dark:text-gray-200">الأجر بالساعة</span>} name="hourly">
                      <InputNumber style={{ width: '100%' }} min={0} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                    </Form.Item>
                  )}
                </>
              );
            }}
          </Form.Item>

          <Form.Item 
            label={<span className="dark:text-gray-200">سعر الساعة الإضافية (جنيه)</span>} 
            name="overtimeHourlyRate"
            tooltip="المبلغ الذي يحصل عليه الموظف عن كل ساعة إضافية"
          >
            <InputNumber 
              style={{ width: '100%' }} 
              min={0} 
              placeholder="0"
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" 
            />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit">
                حفظ
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>
                إلغاء
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// Helper functions
const getDepartmentName = (dept: string) => {
  const names: any = {
    kitchen: 'المطبخ',
    cashier: 'الكاشير',
    waiter: 'الخدمة',
    admin: 'الإدارة',
    gaming: 'الألعاب',
    other: 'أخرى'
  };
  return names[dept] || dept;
};

const getEmploymentType = (type: string) => {
  const types: any = {
    monthly: 'شهري',
    daily: 'يومي',
    hourly: 'بالساعة'
  };
  return types[type] || type;
};

const getStatusName = (status: string) => {
  const statuses: any = {
    active: 'نشط',
    suspended: 'موقوف',
    terminated: 'منتهي'
  };
  return statuses[status] || status;
};

export default EmployeeList;
