import React, { useState, useEffect } from 'react';
import { Tabs, Badge } from 'antd';
import { Users, FileText, Clock } from 'lucide-react';
import EmployeeList from '../components/payroll/EmployeeList';
import PayrollSummary from '../components/payroll/PayrollSummary';
import PendingAdvances from '../components/payroll/PendingAdvances';
import api from '../services/api';

const Payroll: React.FC = () => {
  const [activeTab, setActiveTab] = useState('employees');
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingAdvancesCount, setPendingAdvancesCount] = useState(0);

  useEffect(() => {
    fetchPendingAdvancesCount();
  }, [refreshKey]);

  const fetchPendingAdvancesCount = async () => {
    try {
      const response = await api.get('/payroll/advances', {
        params: { status: 'pending' }
      });
      
      if (response.success) {
        setPendingAdvancesCount(response.data.length);
      }
    } catch (error) {
      console.error('فشل في تحميل عدد طلبات السلف:', error);
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
          الموظفين
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
            طلبات السلف
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
          كشف المصروفات
        </span>
      ),
      children: <PayrollSummary key={`summary-${refreshKey}`} />
    }
  ];

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">نظام المرتبات</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">إدارة الموظفين والحضور والرواتب والخصومات</p>
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
