import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Input, message, Spin } from 'antd';
import { CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import api from '../../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useOrganization } from '../../context/OrganizationContext';
import { replaceAMPM } from '../../utils/formatters';

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
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const { getCurrencySymbol } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  // Update dayjs locale when language changes
  useEffect(() => {
    const currentLang = i18n.language;
    dayjs.locale(currentLang);
  }, [i18n.language]);

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
      console.error(t('payroll.pendingAdvances.messages.loadError'), error);
      message.error(t('payroll.pendingAdvances.messages.loadError'));
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
        message.success(actionType === 'approve' ? t('payroll.pendingAdvances.messages.approveSuccess') : t('payroll.pendingAdvances.messages.rejectSuccess'));
        setActionModalVisible(false);
        fetchPendingAdvances();

        if (onUpdate) {
          onUpdate();
        }
      }
    } catch (error: any) {
      console.error(t('payroll.pendingAdvances.messages.updateError'), error);
      message.error(t('payroll.pendingAdvances.messages.updateError'));
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
          {replaceAMPM(d.format('hh:mm A'))} • {d.fromNow()}
        </span>
      </div>
    );
  };

  const columns = [
    {
      title: t('payroll.pendingAdvances.table.requestId'),
      dataIndex: 'advanceId',
      key: 'advanceId',
      render: (id: string) => (
        <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
          {id}
        </span>
      )
    },
    {
      title: t('payroll.pendingAdvances.table.employee'),
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
      title: t('payroll.pendingAdvances.table.amount'),
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => (
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-green-600" />
          <span className="font-bold text-green-600 dark:text-green-400">
            {amount.toFixed(2)} {currency()}
          </span>
        </div>
      )
    },
    {
      title: t('payroll.pendingAdvances.table.reason'),
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => (
        <span className="text-gray-700 dark:text-gray-300">{reason}</span>
      )
    },
    {
      title: t('payroll.pendingAdvances.table.requestDate'),
      dataIndex: 'requestDate',
      key: 'requestDate',
      render: (date: string) => formatDateTime(date)
    },
    {
      title: t('payroll.pendingAdvances.table.repaymentMethod'),
      dataIndex: 'repayment',
      key: 'repayment',
      render: (repayment: any) => (
        <div className="text-sm">
          <div className="text-gray-700 dark:text-gray-300">
            {repayment.method === 'installments' ? t('payroll.pendingAdvances.repayment.installments') : t('payroll.pendingAdvances.repayment.full')}
          </div>
          {repayment.method === 'installments' && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {repayment.installments} {t('payroll.pendingAdvances.repayment.installmentsDetail', { amount: repayment.amountPerMonth.toFixed(2) })}
            </div>
          )}
        </div>
      )
    },
    {
      title: t('payroll.pendingAdvances.table.status'),
      dataIndex: 'status',
      key: 'status',
      render: () => (
        <Tag color="warning" icon={<Clock size={14} />}>
          {t('payroll.pendingAdvances.status.pending')}
        </Tag>
      )
    },
    {
      title: t('payroll.pendingAdvances.table.actions'),
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
            {t('payroll.pendingAdvances.actions.approve')}
          </Button>
          <Button
            danger
            size="small"
            icon={<XCircle size={16} />}
            onClick={() => handleAction(record, 'reject')}
          >
            {t('payroll.pendingAdvances.actions.reject')}
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
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Clock size={28} className="text-orange-600" />
              {t('payroll.pendingAdvances.title')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {advances.length} {t('payroll.pendingAdvances.subtitle')}
            </p>
          </div>
          <Button
            type="default"
            onClick={fetchPendingAdvances}
            loading={loading}
          >
            {t('payroll.pendingAdvances.refresh')}
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={advances}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{
            emptyText: t('payroll.pendingAdvances.empty')
          }}
        />
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2">
            {actionType === 'approve' ? (
              <>
                <CheckCircle className="text-green-600" />
                <span>{t('payroll.pendingAdvances.approveModal.title')}</span>
              </>
            ) : (
              <>
                <XCircle className="text-red-600" />
                <span>{t('payroll.pendingAdvances.rejectModal.title')}</span>
              </>
            )}
          </div>
        }
        open={actionModalVisible}
        onOk={confirmAction}
        onCancel={() => setActionModalVisible(false)}
        okText={actionType === 'approve' ? t('payroll.pendingAdvances.approveModal.okText') : t('payroll.pendingAdvances.rejectModal.okText')}
        cancelText={actionType === 'approve' ? t('payroll.pendingAdvances.approveModal.cancelText') : t('payroll.pendingAdvances.rejectModal.cancelText')}
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
                  <span className="text-gray-600 dark:text-gray-400">{t('payroll.pendingAdvances.approveModal.employee')}</span>
                  <div className="font-medium text-gray-800 dark:text-gray-200">
                    {selectedAdvance.employeeId.personalInfo.name}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t('payroll.pendingAdvances.approveModal.amount')}</span>
                  <div className="font-bold text-green-600">
                    {selectedAdvance.amount.toFixed(2)} {currency()}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600 dark:text-gray-400">{t('payroll.pendingAdvances.approveModal.reason')}</span>
                  <div className="font-medium text-gray-800 dark:text-gray-200">
                    {selectedAdvance.reason}
                  </div>
                </div>
              </div>
            </div>

            {actionType === 'reject' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('payroll.pendingAdvances.rejectModal.rejectionReason')} <span className="text-red-500">*</span>
                </label>
                <Input.TextArea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={t('payroll.pendingAdvances.rejectModal.rejectionReasonPlaceholder')}
                  rows={4}
                  required
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>
            )}

            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {actionType === 'approve'
                ? t('payroll.pendingAdvances.approveModal.confirm')
                : t('payroll.pendingAdvances.rejectModal.confirm')}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PendingAdvances;
