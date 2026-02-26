import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, InputNumber, Input, Select, Tag, message, Card, Row, Col, Empty, Spin } from 'antd';
import { Plus, Check, X, DollarSign, User, Calendar, FileText } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface AdvanceManagementProps {
  preSelectedEmployeeId?: string;
  autoOpenModal?: boolean;
}

const AdvanceManagement: React.FC<AdvanceManagementProps> = ({ preSelectedEmployeeId, autoOpenModal = false }) => {
  const [advances, setAdvances] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(autoOpenModal);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAdvances();
    fetchEmployees();
    // إذا كان هناك موظف محدد مسبقاً، اختره في الفورم
    if (preSelectedEmployeeId) {
      form.setFieldsValue({ employeeId: preSelectedEmployeeId });
    }
    // فتح المودال تلقائياً إذا كان autoOpenModal = true
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
      message.error('فشل في تحميل السلف');
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
      message.error('فشل في تحميل الموظفين');
      setEmployees([]);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      await api.post('/payroll/advances', values);
      message.success('تم تقديم طلب السلفة بنجاح');
      setIsModalVisible(false);
      form.resetFields();
      fetchAdvances();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'فشل في تقديم الطلب');
    }
  };

  const handleApprove = async (id: string) => {
    Modal.confirm({
      title: 'تأكيد الموافقة',
      content: 'هل أنت متأكد من الموافقة على هذه السلفة؟',
      okText: 'موافقة',
      cancelText: 'إلغاء',
      onOk: async () => {
        try {
          await api.put(`/payroll/advances/${id}/status`, { status: 'approved' });
          message.success('تمت الموافقة على السلفة');
          fetchAdvances();
        } catch (error: any) {
          message.error(error.response?.data?.error || 'فشل في الموافقة');
        }
      }
    });
  };

  const handleReject = async (id: string) => {
    Modal.confirm({
      title: 'تأكيد الرفض',
      content: 'هل أنت متأكد من رفض هذه السلفة؟',
      okText: 'رفض',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.put(`/payroll/advances/${id}/status`, { status: 'rejected' });
          message.success('تم رفض السلفة');
          fetchAdvances();
        } catch (error: any) {
          message.error(error.response?.data?.error || 'فشل في الرفض');
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
    const names: any = {
      pending: 'قيد الانتظار',
      approved: 'موافق عليها',
      rejected: 'مرفوضة',
      paid: 'مدفوعة',
      completed: 'مكتملة'
    };
    return names[status] || status;
  };

  return (
    <div>
      {/* Header */}
      <Card className="mb-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold dark:text-gray-100">إدارة السلف</h3>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsModalVisible(true)}
          >
            طلب سلفة جديدة
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
          <Empty description="لا توجد سلف" />
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
                          موافقة
                        </Button>,
                        <Button
                          type="link"
                          danger
                          icon={<X size={16} />}
                          onClick={() => handleReject(advance._id)}
                          className="dark:text-red-400"
                        >
                          رفض
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
                        {advance.employeeId?.personalInfo?.name || 'موظف'}
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
                      <span className="text-sm text-gray-600 dark:text-gray-300">المبلغ</span>
                    </div>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {advance.amount} جنيه
                    </span>
                  </div>

                  {/* Request Date */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Calendar size={16} className="flex-shrink-0" />
                    <span>تاريخ الطلب: {dayjs(advance.requestDate).format('DD/MM/YYYY')}</span>
                  </div>

                  {/* Reason */}
                  <div className="flex items-start gap-2 text-sm">
                    <FileText size={16} className="flex-shrink-0 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">السبب:</div>
                      <div className="text-gray-700 dark:text-gray-200 line-clamp-2">
                        {advance.reason}
                      </div>
                    </div>
                  </div>

                  {/* Repayment Info */}
                  {advance.repayment && (
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1 text-xs">
                      <div className="flex justify-between text-gray-600 dark:text-gray-300">
                        <span>طريقة السداد:</span>
                        <span className="font-medium">
                          {advance.repayment.method === 'full' ? 'دفعة واحدة' : `${advance.repayment.installments} أقساط`}
                        </span>
                      </div>
                      {advance.repayment.method === 'installments' && (
                        <>
                          <div className="flex justify-between text-gray-600 dark:text-gray-300">
                            <span>القسط الشهري:</span>
                            <span className="font-medium">{advance.repayment.amountPerMonth} جنيه</span>
                          </div>
                          <div className="flex justify-between text-gray-600 dark:text-gray-300">
                            <span>المتبقي:</span>
                            <span className="font-medium text-orange-600 dark:text-orange-400">
                              {advance.repayment.remainingAmount} جنيه
                            </span>
                          </div>
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
        title="طلب سلفة جديدة"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
        className="dark:bg-gray-800"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label={<span className="dark:text-gray-200">الموظف</span>}
            name="employeeId"
            rules={[{ required: true, message: 'الرجاء اختيار الموظف' }]}
          >
            <Select
              placeholder="اختر موظف"
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
            label={<span className="dark:text-gray-200">المبلغ</span>}
            name="amount"
            rules={[{ required: true, message: 'الرجاء إدخال المبلغ' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              placeholder="المبلغ بالجنيه"
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">السبب</span>}
            name="reason"
            rules={[{ required: true, message: 'الرجاء إدخال السبب' }]}
          >
            <TextArea
              rows={3}
              placeholder="سبب طلب السلفة..."
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </Form.Item>

          <Form.Item
            label={<span className="dark:text-gray-200">طريقة السداد</span>}
            name={['repayment', 'method']}
            initialValue="installments"
          >
            <Select className="dark:bg-gray-700">
              <Option value="full">دفعة واحدة</Option>
              <Option value="installments">أقساط شهرية</Option>
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
                    label={<span className="dark:text-gray-200">عدد الأقساط</span>}
                    name={['repayment', 'installments']}
                    rules={[{ required: true, message: 'الرجاء إدخال عدد الأقساط' }]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      placeholder="عدد الأقساط الشهرية"
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
                تقديم الطلب
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

export default AdvanceManagement;
