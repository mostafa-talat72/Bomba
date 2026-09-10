import React, { useState, useEffect, useRef } from 'react';
import { Tabs, Badge } from 'antd';
import { Users, FileText, Clock } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';
import EmployeeList from '../components/payroll/EmployeeList';
import PayrollSummary from '../components/payroll/PayrollSummary';
import PendingAdvances from '../components/payroll/PendingAdvances';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

const PAYROLL_SYNC_COLLECTIONS = new Set([
  'employees', 'advances', 'attendances', 'payments', 'payrolls', 'bonuses', 'deductions',
]);

const Payroll: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState('employees');
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingAdvancesCount, setPendingAdvancesCount] = useState(0);

  useEffect(() => {
    fetchPendingAdvancesCount();
  }, [refreshKey]);

  // Instant cross-device refresh: any HR write on another device bumps the
  // refresh key (debounced), remounting tabs with fresh data. No polling.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');
      socket = io(socketUrl, {
        path: '/socket.io/',
        auth: { token: localStorage.getItem('token') || undefined },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      const schedule = () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          setRefreshKey((prev) => prev + 1);
        }, 500);
      };
      const onRemote = (evt: any) => {
        if (evt?.collection && PAYROLL_SYNC_COLLECTIONS.has(evt.collection)) schedule();
      };
      socket.on('lan:remote-change', onRemote);
      return () => {
        try {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          socket?.off('lan:remote-change', onRemote);
          socket?.disconnect();
        } catch {}
      };
    } catch {
      return;
    }
  }, []);

  const fetchPendingAdvancesCount = async () => {
    try {
      const response = await api.get('/payroll/advances', {
        params: { status: 'pending' }
      });
      
      if (response.success) {
        setPendingAdvancesCount(response.data.length);
      }
    } catch (error) {
      console.error(t('payroll.notifications.loadAdvancesError'), error);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    // Refresh data when switching tabs
    setRefreshKey(prev => prev + 1);
  };

  const handleAdvancesUpdate = () => {
    setRefreshKey(prev => prev + 1);
    fetchPendingAdvancesCount();
  };

  const items = [
    {
      key: 'employees',
      label: (
        <span className="flex items-center gap-2 dark:text-gray-200">
          <Users size={18} />
          {t('payroll.tabs.employees')}
        </span>
      ),
      children: <EmployeeList key={`employees-${refreshKey}`} onAdvanceAdded={handleAdvancesUpdate} />
    },
    {
      key: 'pending-advances',
      label: (
        <Badge 
          count={pendingAdvancesCount} 
          offset={[-10, 0]}
          style={{ 
            marginTop: '0px',
            right: '-10px',
            backgroundColor: 'rgb(255, 77, 79)',
            fontSize: '14px',
            fontWeight: 'bold',
            minWidth: '22px',
            height: '24px',
            lineHeight: '24px',
            borderRadius: '12px',
            width: 'fit-content'
          }}
          showZero={false}
        >
          <span className="flex items-center gap-2 dark:text-gray-200">
            <Clock size={18} />
            {t('payroll.tabs.pendingAdvances')}
          </span>
        </Badge>
      ),
      children: <PendingAdvances key={`advances-${refreshKey}`} onUpdate={handleAdvancesUpdate} />
    },
    {
      key: 'summary',
      label: (
        <span className="flex items-center gap-2 dark:text-gray-200">
          <FileText size={18} />
          {t('payroll.tabs.summary')}
        </span>
      ),
      children: <PayrollSummary key={`summary-${refreshKey}`} />
    }
  ];

  return (
    <div className="p-2 sm:p-6 min-h-screen bg-gray-50 dark:bg-gray-900" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">{t('payroll.title')}</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">{t('payroll.subtitle')}</p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        type="card"
        size="large"
        items={items}
        className="dark-tabs"
      />
    </div>
  );
};

export default Payroll;
