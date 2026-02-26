import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Input, message, Spin } from 'antd';
import { CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.locale('ar');
dayjs.extend(relativeTime);

interface Advance {
  _id: string;
  advanceId: string;
  employeeId: {
    _id: string;
    personalInfo: {
      name: string;
    };
    employment: {
      department: string;
      position: string;
    };
  };
  amount: number;
  reason: string;
  status: string;
  requestDate: string;
  approvalDate?: string;
  rejectionDate?: string;
  rejectionReason?: string;
  repayment: {
    method: string;
    installments: number;
    amountPerMonth: number;
    startMonth: string;
  };
}

interface PendingAdvancesProps {
  onUpdate?: () => void;
}

const PendingAdvances: React.FC<PendingAdvancesProps> = ({ onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchPendingAdvances();
  }, []);

  const fetchPendingAdvances = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payroll/advances', {
        params: { status: 'pending' }
      });
      
      if (response.success) {
        setAdvances(response.data);
      }
    } catch (error: any) {
      console.error('فشل في تحميل طلبات السلف:', error);
      message.error('فشل في تحميل طلبات السلف');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (advance: Advance, type: 'approve' | 'reject') => {
    setSelectedAdvance(advance);
    setActionType(type);
    setActionModalVisible(true);
    setRejectionReason('');
  };

  const confirmAction = async () => {
    if (!selectedAdvance) return;

    try {
      setLoading(true);
      
      const response = await api.put(`/payroll/advances/${selectedAdvance._id}/status`, {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        rejectionReason: actionType === 'reject' ? rejectionReason : undefined
      });

      if (response.success) {
        message.success(actionType === 'approve' ? 'تم اعتماد السلفة بنجاح' : 'تم رفض السلفة');
        setActionModalVisible(false);
        fetchPendingAdvances();
        
        // تحديث الصفحة الرئيسية
        if (onUpdate) {
          onUpdate();
        }
      }
    } catch (error: any) {
      console.error('فشل في تحديث حالة السلفة:', error);
      message.error('فشل في تحديث حالة السلفة');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: string) => {
    const d = dayjs(date);
    return (
      <div className="flex flex-col">
        <span className="font-medium text-gray-800 dark:text-gray-200">
          {d.format('DD/MM/YYYY')}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {d.format('hh:mm A')} • {d.fromNow()}
        </span>
      </div>
    );
  };

  const columns = [
    {
      title: 'رقم الطلب',
      dataIndex: 'advanceId',
      key: 'advanceId',
      render: (id: string) => (
        <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
          {id}
        </span>
      )
    },
    {
      title: 'الموظف',
      dataIndex: 'employeeId',
      key: 'employee',
      render: (employee: any) => (
        <div>
          <div className="font-medium text-gray-800 dark:text-gray-200">
            {employee.personalInfo.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {employee.employment.department} - {employee.employment.position}
          </div>
        </div>
      )
    },
    {
      title: 'المبلغ',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => (
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-green-600" />
          <span className="font-bold text-green-600 dark:text-green-400">
            {amount.toFixed(2)} جنيه
          </span>
        </div>
      )
    },
    {
      title: 'السبب',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => (
        <span className="text-gray-700 dark:text-gray-300">{reason}</span>
      )
    },
    {
      title: 'تاريخ الطلب',
      dataIndex: 'requestDate',
      key: 'requestDate',
      render: (date: string) => formatDateTime(date)
    },
    {
      title: 'طريقة السداد',
      dataIndex: 'repayment',
      key: 'repayment',
      render: (repayment: any) => (
        <div className="text-sm">
          <div className="text-gray-700 dark:text-gray-300">
            {repayment.method === 'installments' ? 'أقساط' : 'دفعة واحدة'}
          </div>
          {repayment.method === 'installments' && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {repayment.installments} قسط × {repayment.amountPerMonth.toFixed(2)} جنيه
            </div>
          )}
        </div>
      )
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: () => (
        <Tag color="warning" icon={<Clock size={14} />}>
          قيد الانتظار
        </Tag>
      )
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      render: (_: any, record: Advance) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckCircle size={16} />}
            onClick={() => handleAction(record, 'approve')}
            className="bg-green-600 hover:bg-green-700"
          >
            اعتماد
          </Button>
          <Button
            danger
            size="small"
            icon={<XCircle size={16} />}
            onClick={() => handleAction(record, 'reject')}
          >
            رفض
          </Button>
        </Space>
      )
    }
  ];

  if (loading && advances.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Clock size={28} className="text-orange-600" />
              طلبات السلف المعلقة
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {advances.length} طلب في انتظار الموافقة
            </p>
          </div>
          <Button
            type="default"
            onClick={fetchPendingAdvances}
            loading={loading}
          >
            تحديث
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={advances}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{
            emptyText: 'لا توجد طلبات سلف معلقة'
          }}
        />
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2">
            {actionType === 'approve' ? (
              <>
                <CheckCircle className="text-green-600" />
                <span>اعتماد السلفة</span>
              </>
            ) : (
              <>
                <XCircle className="text-red-600" />
                <span>رفض السلفة</span>
              </>
            )}
          </div>
        }
        open={actionModalVisible}
        onOk={confirmAction}
        onCancel={() => setActionModalVisible(false)}
        okText={actionType === 'approve' ? 'اعتماد' : 'رفض'}
        cancelText="إلغاء"
        confirmLoading={loading}
        okButtonProps={{
          danger: actionType === 'reject',
          className: actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''
        }}
      >
        {selectedAdvance && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">الموظف:</span>
                  <div className="font-medium text-gray-800 dark:text-gray-200">
                    {selectedAdvance.employeeId.personalInfo.name}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">المبلغ:</span>
                  <div className="font-bold text-green-600">
                    {selectedAdvance.amount.toFixed(2)} جنيه
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600 dark:text-gray-400">السبب:</span>
                  <div className="font-medium text-gray-800 dark:text-gray-200">
                    {selectedAdvance.reason}
                  </div>
                </div>
              </div>
            </div>

            {actionType === 'reject' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  سبب الرفض <span className="text-red-500">*</span>
                </label>
                <Input.TextArea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="اكتب سبب رفض السلفة..."
                  rows={4}
                  required
                />
              </div>
            )}

            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {actionType === 'approve'
                ? 'هل أنت متأكد من اعتماد هذه السلفة؟'
                : 'هل أنت متأكد من رفض هذه السلفة؟'}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PendingAdvances;
