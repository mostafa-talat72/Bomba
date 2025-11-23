import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Play, Square, Users, Plus, Table as TableIcon, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api, { Device, Session } from '../services/api';
import { SessionCostDisplay } from '../components/SessionCostDisplay';

const PlayStation: React.FC = () => {
  const location = useLocation();
  const { sessions, createSession, endSession, user, createDevice, createBill, fetchBills, showNotification, tables, fetchTables, fetchTableSections, fetchSessions } = useApp();
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', number: '', controllers: 2, playstationRates: { 1: '', 2: '', 3: '', 4: '' } });
  const [addDeviceError, setAddDeviceError] = useState<string | null>(null);

  // جلسة جديدة
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedControllers, setSelectedControllers] = useState<number | null>(null);

  // ربط بطاولة
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  
  // ربط الجلسة بطاولة بعد بدء الجلسة
  const [showLinkTableModal, setShowLinkTableModal] = useState(false);
  const [selectedSessionForLink, setSelectedSessionForLink] = useState<Session | null>(null);
  const [linkingTable, setLinkingTable] = useState(false);

  // فك ربط الجلسة من الطاولة
  const [showUnlinkTableModal, setShowUnlinkTableModal] = useState(false);
  const [selectedSessionForUnlink, setSelectedSessionForUnlink] = useState<Session | null>(null);
  const [unlinkingTable, setUnlinkingTable] = useState(false);
  const [customerNameForUnlink, setCustomerNameForUnlink] = useState('');

  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [endingSessions, setEndingSessions] = useState<Record<string, boolean>>({});
  const [updatingControllers, setUpdatingControllers] = useState<Record<string, boolean>>({});
  const [isAddingDevice, setIsAddingDevice] = useState(false);

  // نافذة إنهاء الجلسة مع طلب اسم العميل
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [selectedSessionForEnd, setSelectedSessionForEnd] = useState<Session | null>(null);
  const [customerNameForEnd, setCustomerNameForEnd] = useState('');

  // نافذة تأكيد تعديل عدد الأذرع
  const [showControllersConfirm, setShowControllersConfirm] = useState(false);
  const [controllersChangeData, setControllersChangeData] = useState<{sessionId: string, newCount: number, oldCount: number, deviceName: string} | null>(null);

  // Loading states for better UX
  // Start with false if we already have data from context
  const [isInitialLoading, setIsInitialLoading] = useState(sessions.length === 0);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // إضافة أجهزة
  const [devices, setDevices] = useState<Device[]>([]);
  
  // Track if we've loaded data for this page visit
  const hasLoadedRef = useRef(false);
  const lastPathRef = useRef(location.pathname);

  // تحميل الأجهزة - محسّن للسرعة
  const loadDevices = async () => {
    try {
      // تحميل أجهزة البلايستيشن فقط من الـ API
      const response = await api.getDevices({ type: 'playstation', limit: 100 });
      if (response.success && response.data) {
        setDevices(response.data);
      }
    } catch (error) {
      showNotification('خطأ في تحميل الأجهزة', 'error');
    }
  };

  // Reset loaded flag when navigating away
  useEffect(() => {
    if (location.pathname !== '/playstation') {
      hasLoadedRef.current = false;
    }
  }, [location.pathname]);

  // تحميل البيانات بشكل تدريجي لتحسين السرعة
  useEffect(() => {
    let isMounted = true;
    
    const loadAllData = async () => {
      if (!isMounted) return;
      
      // Only load once per page visit
      if (hasLoadedRef.current && lastPathRef.current === location.pathname) {
        return;
      }
      
      // Only run if user exists
      if (!user) {
        setIsInitialLoading(false);
        return;
      }
      
      hasLoadedRef.current = true;
      lastPathRef.current = location.pathname;
      
      try {
        setIsInitialLoading(true);
        setLoadingError(null);

        // تحميل الأجهزة والجلسات أولاً (الأهم)
        await Promise.all([
          loadDevices(),
          fetchSessions(),
        ]);

        // تحميل باقي البيانات قبل إخفاء شاشة التحميل
        await Promise.all([
          fetchBills(),
          fetchTables(),
          fetchTableSections()
        ]).catch(error => {
          // Ignore errors in secondary data loading
        });

        // إخفاء شاشة التحميل بعد تحميل جميع البيانات
        setIsInitialLoading(false);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'حدث خطأ في تحميل البيانات';
        setLoadingError(errorMessage);
        showNotification('فشل في تحميل البيانات. يرجى إعادة تحميل الصفحة.', 'error');
        setIsInitialLoading(false);
      }
    };

    loadAllData();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname]); // Run when user or pathname changes

  // تحديث تكلفة الجلسات النشطة بعد تحميلها
  useEffect(() => {
    const updateActiveSessionsCosts = async () => {
      const activeSessions = sessions.filter(s => s.status === 'active' && s.deviceType === 'playstation');
      if (activeSessions.length > 0) {
        activeSessions.forEach(async (session) => {
          try {
            await api.updateSessionCost(session.id);
          } catch (error) {
            // Ignore errors in background update
          }
        });
      }
    };

    if (sessions.length > 0 && !isInitialLoading) {
      updateActiveSessionsCosts();
    }
  }, [sessions.length, isInitialLoading]); // Run when sessions are loaded

  // إغلاق النافذة بمفتاح Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showNewSession && !loadingSession) {
          setShowNewSession(false);
          setSelectedDevice(null);
          setSelectedControllers(null);
          setSessionError(null);
          setSelectedTable(null);
        }
        if (showLinkTableModal) {
          setShowLinkTableModal(false);
          setSelectedSessionForLink(null);
        }
        if (showEndSessionModal && selectedSessionForEnd && !endingSessions[selectedSessionForEnd.id]) {
          setShowEndSessionModal(false);
          setSelectedSessionForEnd(null);
          setCustomerNameForEnd('');
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showNewSession, loadingSession, showLinkTableModal, showEndSessionModal, selectedSessionForEnd, endingSessions]);

  // إضافة جهاز جديد
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddDeviceError(null);
    if (!newDevice.name || !newDevice.number) return;
    setIsAddingDevice(true);

    // فحص عدم تكرار رقم الجهاز في الواجهة
    const existingDevice = devices.find(d => d.number === Number(newDevice.number));
    if (existingDevice) {
      setAddDeviceError(`رقم الجهاز ${newDevice.number} مستخدم بالفعل`);
      setIsAddingDevice(false);
      return;
    }

    // تجهيز playstationRates كأرقام
    const playstationRates = {
      1: parseFloat(newDevice.playstationRates[1]) || 0,
      2: parseFloat(newDevice.playstationRates[2]) || 0,
      3: parseFloat(newDevice.playstationRates[3]) || 0,
      4: parseFloat(newDevice.playstationRates[4]) || 0
    };

    const deviceData = {
      name: newDevice.name,
      number: Number(newDevice.number),
      type: 'playstation',
      status: 'available',
      controllers: newDevice.controllers,
      playstationRates
    };

    try {
      const device = await createDevice(deviceData);
      if (device) {
        // تحديث قائمة الأجهزة مباشرة في الواجهة
        setDevices(prevDevices => [...prevDevices, device]);
        setShowAddDevice(false);
        setNewDevice({ name: '', number: '', controllers: 2, playstationRates: { 1: '', 2: '', 3: '', 4: '' } });
        showNotification('تمت إضافة الجهاز بنجاح', 'success');
      } else {
        setAddDeviceError('حدث خطأ أثناء إضافة الجهاز.');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      const errorMessage = error?.response?.data?.error || error?.message || 'حدث خطأ غير متوقع';
      setAddDeviceError(errorMessage);
      showNotification(`خطأ في إضافة الجهاز: ${errorMessage}`, 'error');
    } finally {
      setIsAddingDevice(false);
    }
  };

  // بدء جلسة جديدة
  const openSessionModal = (device: Device) => {
    setSelectedDevice(device);
    setSelectedControllers(null);
    setShowNewSession(true);
  };

  // استبدال دالة getPlayStationHourlyRate بدالة تعتمد على بيانات الجهاز
  const getPlayStationHourlyRate = (device: Device | null, controllers: number) => {
    if (!device || !device.playstationRates) return 0;
    return device.playstationRates[controllers] || 0;
  };



  const handleStartSession = async () => {
    try {
      setLoadingSession(true);
      setSessionError(null);
      
      if (!selectedDevice || !selectedControllers) {
        setLoadingSession(false);
        return;
      }

      const hourlyRate = getPlayStationHourlyRate(selectedDevice, selectedControllers);

      let session;
      let apiResponse;

      // إنشاء جلسة جديدة مع فاتورة جديدة
      const sessionData: any = {
        deviceId: selectedDevice._id,
        deviceType: 'playstation',
        deviceNumber: selectedDevice.number,
        deviceName: selectedDevice.name,
        customerName: `عميل (${selectedDevice.name})`,
        controllers: selectedControllers,
        hourlyRate,
      };
      
      // إضافة معرف الطاولة إذا تم اختياره
      if (selectedTable) {
        sessionData.table = selectedTable;
      }
      
      apiResponse = await createSession(sessionData);
      session = apiResponse;

      if (session && (session.id || session._id)) {
        try {
          // تحديث حالة الجهاز
          await api.updateDeviceStatus(selectedDevice.id, { status: 'active' });

          // تحديث البيانات
          await loadDevices();
          await fetchBills();

          // رسالة نجاح
          showNotification(`✅ تم بدء الجلسة بنجاح`, 'success');
          
          // إغلاق النافذة وتنظيف الحالة بعد تأكيد نجاح العملية
          setShowNewSession(false);
          setSelectedDevice(null);
          setSelectedControllers(null);
          setSessionError(null);
          setSelectedTable(null);
        } catch (updateError) {
          showNotification('تم بدء الجلسة ولكن حدث خطأ في تحديث حالة الجهاز', 'warning');
          setShowNewSession(false); // مع ذلك نقوم بإغلاق النافذة
        }
      } else {
        setSessionError('حدث خطأ أثناء بدء الجلسة. لم يتم استلام بيانات الجلسة من الخادم.');
        showNotification('حدث خطأ أثناء بدء الجلسة. لم يتم استلام بيانات الجلسة من الخادم.', 'error');
      }
    } catch (err: unknown) {
      const error = err as { message?: string; response?: { data?: { message?: string, error?: string } } };
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'حدث خطأ غير متوقع';
      
      // رسائل خطأ محسّنة وواضحة
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('in use') || errorMessage.includes('مستخدم')) {
        userFriendlyMessage = '❌ الجهاز مستخدم حالياً. يرجى اختيار جهاز آخر.';
      } else if (errorMessage.includes('not found') || errorMessage.includes('غير موجود')) {
        userFriendlyMessage = '❌ الجهاز غير موجود. يرجى تحديث الصفحة والمحاولة مرة أخرى.';
      } else if (errorMessage.includes('network') || errorMessage.includes('شبكة')) {
        userFriendlyMessage = '❌ خطأ في الاتصال بالخادم. تأكد من اتصالك بالإنترنت.';
      } else {
        userFriendlyMessage = `❌ ${errorMessage}`;
      }
      
      setSessionError(userFriendlyMessage);
      showNotification(userFriendlyMessage, 'error');
      } finally {
      setLoadingSession(false);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    // البحث عن الجلسة
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      showNotification('الجلسة غير موجودة', 'error');
      return;
    }

    // فحص حالة ربط الطاولة
    const bill = typeof session.bill === 'object' ? session.bill : null;
    const isLinkedToTable = bill ? !!(bill as any)?.table : false;

    // إذا لم تكن مرتبطة بطاولة، نطلب اسم العميل
    if (!isLinkedToTable) {
      setSelectedSessionForEnd(session);
      setCustomerNameForEnd('');
      setShowEndSessionModal(true);
      return;
    }

    // إذا كانت مرتبطة بطاولة، ننهي الجلسة مباشرة
    await handleEndSessionWithCustomerName(sessionId, undefined);
  };

  const handleEndSessionWithCustomerName = async (sessionId: string, customerName?: string) => {
    try {
      setEndingSessions(prev => ({ ...prev, [sessionId]: true }));
      
      // إنهاء الجلسة مع اسم العميل إذا كان متوفراً
      const result = await endSession(sessionId, customerName);
      
      // Check if result is valid
      if (!result) {
        throw new Error('فشل في إنهاء الجلسة - لم يتم إرجاع نتيجة');
      }

      // Show success message with bill info if available
      if (result && typeof result === 'object' && 'bill' in result) {
        const billData = result as { bill?: { billNumber?: string } };
        if (billData?.bill?.billNumber) {
          showNotification(`✅ تم إنهاء الجلسة بنجاح وإنشاء الفاتورة: ${billData.bill.billNumber}`, 'success');
        } else {
          showNotification('✅ تم إنهاء الجلسة بنجاح', 'success');
        }
      } else {
        showNotification('✅ تم إنهاء الجلسة بنجاح', 'success');
      }

      // Refresh data after ending session
      await Promise.all([loadDevices(), fetchBills(), fetchSessions()]);
      setEndingSessions(prev => ({ ...prev, [sessionId]: false }));
      
      // إغلاق النافذة وتنظيف الحالة
      setShowEndSessionModal(false);
      setSelectedSessionForEnd(null);
      setCustomerNameForEnd('');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      showNotification(`❌ خطأ في إنهاء الجلسة: ${errorMsg}. يرجى المحاولة مرة أخرى.`, 'error');
      setEndingSessions(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  // تعديل عدد الأذرع مع تأكيد
  const handleUpdateControllersClick = (sessionId: string, newCount: number, oldCount: number, deviceName: string) => {
    setControllersChangeData({ sessionId, newCount, oldCount, deviceName });
    setShowControllersConfirm(true);
  };

  const confirmUpdateControllers = async () => {
    if (!controllersChangeData) return;
    
    const { sessionId, newCount } = controllersChangeData;
    setUpdatingControllers(prev => ({ ...prev, [sessionId]: true }));
    setShowControllersConfirm(false);
    
    try {
      const res = await api.updateSessionControllers(sessionId, newCount);
      if (res.success && res.data) {
        // تحديث الجلسة في الـ state مباشرة
        await fetchSessions();
        showNotification(`✅ تم تحديث عدد الأذرع إلى ${newCount}`, 'success');
      } else {
        showNotification('❌ فشل في تحديث عدد الأذرع. يرجى المحاولة مرة أخرى.', 'error');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      showNotification(`❌ خطأ في تحديث عدد الأذرع: ${errorMsg}`, 'error');
    } finally {
      setUpdatingControllers(prev => ({ ...prev, [sessionId]: false }));
      setControllersChangeData(null);
    }
  };

  // ربط الجلسة بطاولة
  const handleLinkTableToSession = async (session: Session, tableId: string | null) => {
    // التحقق من وجود tableId
    if (!tableId) {
      showNotification('⚠️ يرجى اختيار طاولة', 'warning');
      return;
    }

    try {
      setLinkingTable(true);
      
      // استخدام الـ endpoint الجديد الذي يدمج الفواتير بذكاء
      const result = await api.linkSessionToTable(session._id || session.id, tableId);
      
      if (result && result.success) {
        // Get table number for notification
        const tableDoc = tables.find(t => t._id === tableId);
        const tableNumber = tableDoc?.number;
        
        // عرض رسالة نجاح مع تفاصيل الدمج إذا حدث
        const billData = result.data?.bill;
        let message = `✅ تم ربط الجلسة بالطاولة ${tableNumber} بنجاح`;
        
        if (billData && billData.sessionsCount > 1) {
          message += ` (تم دمج الفواتير - ${billData.sessionsCount} جلسات)`;
        }
        
        showNotification(message, 'success');
        
        // تحديث البيانات
        await Promise.all([fetchBills(), loadDevices(), fetchSessions()]);
        setShowLinkTableModal(false);
        setSelectedSessionForLink(null);
      } else {
        showNotification(result.message || '❌ فشل في ربط الجلسة بالطاولة', 'error');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      showNotification(`❌ خطأ في ربط الجلسة بالطاولة: ${errorMsg}`, 'error');
    } finally {
      setLinkingTable(false);
    }
  };

  // فك ربط الجلسة من الطاولة
  const handleUnlinkTableFromSession = async () => {
    if (!selectedSessionForUnlink) return;

    try {
      setUnlinkingTable(true);

      // استدعاء API لفك الربط
      const response = await api.unlinkTableFromSession(
        selectedSessionForUnlink.id,
        customerNameForUnlink.trim() || undefined
      );

      if (response && response.success) {
        const tableNumber = response.data?.unlinkedFromTable;
        showNotification(
          `✅ تم فك ربط الجلسة من الطاولة ${tableNumber} بنجاح`,
          'success'
        );

        // تحديث البيانات
        await Promise.all([fetchBills(), fetchSessions(), loadDevices()]);

        // إغلاق النافذة
        setShowUnlinkTableModal(false);
        setSelectedSessionForUnlink(null);
        setCustomerNameForUnlink('');
      } else {
        showNotification('❌ فشل في فك ربط الجلسة من الطاولة', 'error');
      }
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        'حدث خطأ غير متوقع';
      showNotification(`❌ خطأ في فك الربط: ${errorMsg}`, 'error');
    } finally {
      setUnlinkingTable(false);
    }
  };

  // Helpers - محسّنة مع ألوان وأيقونات واضحة
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'active': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'maintenance': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'unavailable': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '✓ متاح';
      case 'active': return '● نشط';
      case 'maintenance': return '⚠ صيانة';
      case 'unavailable': return '✕ غير متاح';
      default: return 'غير معروف';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return '🟢';
      case 'active': return '🔵';
      case 'maintenance': return '🔴';
      case 'unavailable': return '⚫';
      default: return '⚪';
    }
  };

  // --- UI ---
  return (
    <div className="space-y-6">
      {/* Header - محسّن للشاشات الصغيرة */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 md:h-7 md:w-7 text-orange-600 dark:text-orange-400" />
            إدارة أجهزة البلايستيشن
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mt-1">
            متابعة وإدارة جلسات البلايستيشن
          </p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowAddDevice(true)}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Plus className="h-5 w-5 ml-2" />
            إضافة جهاز
          </button>
        )}
      </div>

      {/* Loading State */}
      {isInitialLoading && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 dark:border-orange-400"></div>
          </div>
          <p className="text-orange-800 dark:text-orange-200 font-medium">جاري تحميل البيانات...</p>
          <p className="text-orange-600 dark:text-orange-300 text-sm">يرجى الانتظار قليلاً</p>
        </div>
      )}

      {/* Error State */}
      {loadingError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-red-800 dark:text-red-200 font-medium">{loadingError}</p>
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">تأكد من اتصالك بالإنترنت وحاول مرة أخرى</p>
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center"
            >
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              إعادة المحاولة
            </button>
          </div>
      </div>
      )}

      {/* Content - Show only when not loading */}
      {!isInitialLoading && !loadingError && (
        <>


      {/* Devices Grid - محسّن للشاشات الصغيرة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {devices.filter(d => d.type === 'playstation').map((device) => {
          const activeSession = sessions.find(s => s.deviceNumber === device.number && s.status === 'active');
          return (
                <div key={device.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 flex flex-col h-full hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="text-xl">{getStatusIcon(device.status)}</span>
                    {device.name}
                  </h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(device.status)} whitespace-nowrap`}>{getStatusText(device.status)}</span>
              </div>

                  <div className="flex-1">
              {activeSession ? (
                <div className="space-y-3">
                  {/* Real-time cost display */}
                  <SessionCostDisplay session={activeSession} device={device} />
                  
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <Users className="h-4 w-4 ml-1" />
                    {activeSession.controllers ?? 1} دراع
                  </div>
                  
                  {/* عرض حالة ربط الطاولة مع أزرار الربط/فك الربط */}
                  {activeSession.bill && (() => {
                    const bill = typeof activeSession.bill === 'object' ? activeSession.bill : null;
                    const billTable = bill ? (bill as any)?.table : null;
                    
                    // Handle both cases: table as object or as ID string
                    let billTableNumber = null;
                    if (billTable) {
                      if (typeof billTable === 'object') {
                        billTableNumber = billTable.number || billTable.name;
                      } else {
                        // If it's just an ID, try to find the table in the tables array
                        const foundTable = tables.find(t => t._id === billTable || t.id === billTable);
                        billTableNumber = foundTable?.number;
                      }
                    }
                    
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center text-sm">
                          {billTableNumber ? (
                            <div className="flex items-center text-blue-600 dark:text-blue-400">
                              <TableIcon className="h-4 w-4 ml-1" />
                              مرتبطة بطاولة: {billTableNumber}
                            </div>
                          ) : (
                            <div className="flex items-center text-gray-500 dark:text-gray-400">
                              <TableIcon className="h-4 w-4 ml-1" />
                              غير مرتبطة بطاولة
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {billTableNumber ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedSessionForLink(activeSession);
                                  setShowLinkTableModal(true);
                                }}
                                className="flex-1 px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded text-xs hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
                              >
                                تغيير الطاولة
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedSessionForUnlink(activeSession);
                                  setCustomerNameForUnlink(activeSession.customerName || '');
                                  setShowUnlinkTableModal(true);
                                }}
                                className="flex-1 px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs hover:bg-red-200 dark:hover:bg-red-800 transition-colors flex items-center justify-center gap-1"
                              >
                                <X className="h-3 w-3" />
                                فك الربط
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedSessionForLink(activeSession);
                                setShowLinkTableModal(true);
                              }}
                              className="w-full px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                            >
                              ربط بطاولة
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {/* أزرار تعديل عدد الأذرعة */}
                  <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <button
                      className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[36px] font-bold text-gray-700 dark:text-gray-200 transition-all duration-200"
                      disabled={(activeSession.controllers ?? 1) <= 1 || updatingControllers[activeSession.id]}
                      onClick={() => {
                        const oldCount = activeSession.controllers ?? 1;
                        const newCount = oldCount - 1;
                        handleUpdateControllersClick(activeSession.id, newCount, oldCount, device.name);
                      }}
                      title="تقليل عدد الأذرع"
                    >
                      {updatingControllers[activeSession.id] ? (
                        <div className="h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        '-'
                      )}
                    </button>
                    <span className="mx-2 font-bold text-lg text-gray-900 dark:text-gray-100 min-w-[60px] text-center">
                      {activeSession.controllers ?? 1} دراع
                    </span>
                    <button
                      className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[36px] font-bold text-gray-700 dark:text-gray-200 transition-all duration-200"
                      disabled={(activeSession.controllers ?? 1) >= 4 || updatingControllers[activeSession.id]}
                      onClick={() => {
                        const oldCount = activeSession.controllers ?? 1;
                        const newCount = oldCount + 1;
                        handleUpdateControllersClick(activeSession.id, newCount, oldCount, device.name);
                      }}
                      title="زيادة عدد الأذرع"
                    >
                      {updatingControllers[activeSession.id] ? (
                        <div className="h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        '+'
                      )}
                    </button>
                  </div>
                </div>
              ) : device.status === 'maintenance' ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">الجهاز في الصيانة</p>
                </div>
              ) : device.status === 'unavailable' ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">غير متاح</p>
                </div>
              ) : null}
                  </div>

                  {/* الأزرار دائماً في نهاية الكارت */}
                  <div className="mt-4">
                    {activeSession ? (
                  <button
                    onClick={() => handleEndSession(activeSession.id)}
                    disabled={endingSessions[activeSession.id]}
                    className={`w-full ${endingSessions[activeSession.id] ? 'bg-red-700 dark:bg-red-800' : 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'} text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200`}
                  >
                    {endingSessions[activeSession.id] ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        جاري الإنهاء...
                      </>
                    ) : (
                      <>
                        <Square className="h-4 w-4 ml-2" />
                        إنهاء الجلسة
                      </>
                    )}
                  </button>
                    ) : device.status === 'available' ? (
                    <button
                      onClick={() => openSessionModal(device)}
                      className="w-full bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200"
                    >
                      <Play className="h-4 w-4 ml-2" />
                      بدء الجلسة
                    </button>
                  ) : (
                      <div className="w-full py-2 px-4 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-center text-sm">
                        غير متاح
                </div>
              )}
                  </div>
            </div>
          );
        })}
      </div>

      {/* Active Sessions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">الجلسات النشطة</h3>
        </div>
        <div className="p-6">
          {sessions.filter(
            s => s.status === 'active' &&
              s.deviceType === 'playstation' &&
              devices.some(d => d.number === s.deviceNumber)
          ).length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">لا توجد جلسات نشطة حالياً</p>
          ) : (
            <div className="space-y-4">
              {sessions.filter(
                s => s.status === 'active' &&
                  s.deviceType === 'playstation' &&
                  devices.some(d => d.number === s.deviceNumber)
              ).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <Gamepad2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="mr-4 flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{devices.find(d => d.number === session.deviceNumber)?.name || session.deviceName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {session.controllers} دراع • بدأت: {new Date(session.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                          {/* عرض رقم الفاتورة المرتبطة */}
                          {session.bill && (
                            <div className="mt-2 space-y-1">
                              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                                فاتورة: {typeof session.bill === 'object' ? (session.bill as any)?.billNumber : 'غير معروف'}
                              </span>
                              {/* عرض حالة ربط الطاولة */}
                              {(() => {
                                const bill = typeof session.bill === 'object' ? session.bill : null;
                                const billTable = bill ? (bill as any)?.table : null;
                                
                                // Handle both cases: table as object or as ID string
                                let billTableNumber = null;
                                if (billTable) {
                                  if (typeof billTable === 'object') {
                                    billTableNumber = billTable.number || billTable.name;
                                  } else {
                                    // If it's just an ID, try to find the table in the tables array
                                    const foundTable = tables.find(t => t._id === billTable || t.id === billTable);
                                    billTableNumber = foundTable?.number;
                                  }
                                }
                                
                                return billTableNumber ? (
                                  <div className="text-xs text-blue-600 dark:text-blue-400">
                                    🪑 مرتبطة بطاولة: {billTableNumber}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    ⚠️ غير مرتبطة بطاولة
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                    </div>
                    {/* Real-time cost display in compact form */}
                    <div className="ml-4">
                      <SessionCostDisplay session={session} device={devices.find(d => d.number === session.deviceNumber) || null} />
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 flex items-center justify-center min-w-[24px] transition-all duration-200"
                        disabled={(session.controllers ?? 1) <= 1 || updatingControllers[session.id]}
                        onClick={() => {
                          const oldCount = session.controllers ?? 1;
                          const newCount = oldCount - 1;
                          const deviceName = devices.find(d => d.number === session.deviceNumber)?.name || session.deviceName;
                          handleUpdateControllersClick(session.id, newCount, oldCount, deviceName);
                        }}
                        title="تقليل عدد الأذرع"
                      >
                        {updatingControllers[session.id] ? (
                          <div className="h-3 w-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : '-'}
                      </button>
                      <span className="mx-2 font-bold text-gray-900 dark:text-gray-100">{session.controllers ?? 1} دراع</span>
                      <button
                        className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 flex items-center justify-center min-w-[24px] transition-all duration-200"
                        disabled={(session.controllers ?? 1) >= 4 || updatingControllers[session.id]}
                        onClick={() => {
                          const oldCount = session.controllers ?? 1;
                          const newCount = oldCount + 1;
                          const deviceName = devices.find(d => d.number === session.deviceNumber)?.name || session.deviceName;
                          handleUpdateControllersClick(session.id, newCount, oldCount, deviceName);
                        }}
                        title="زيادة عدد الأذرع"
                      >
                        {updatingControllers[session.id] ? (
                          <div className="h-3 w-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : '+'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* زر ربط بطاولة / تغيير الطاولة / فك الربط */}
                      {(() => {
                        const bill = typeof session.bill === 'object' ? session.bill : null;
                        const billTable = bill ? (bill as any)?.table : null;
                        
                        // Handle both cases: table as object or as ID string
                        let billTableNumber = null;
                        if (billTable) {
                          if (typeof billTable === 'object') {
                            billTableNumber = billTable.number || billTable.name;
                          } else {
                            // If it's just an ID, try to find the table in the tables array
                            const foundTable = tables.find(t => t._id === billTable || t.id === billTable);
                            billTableNumber = foundTable?.number;
                          }
                        }
                        
                        const isLinked = !!billTable;
                        
                        return (
                          <>
                            {isLinked ? (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedSessionForLink(session);
                                    setShowLinkTableModal(true);
                                  }}
                                  className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white px-3 py-2 rounded-lg flex items-center transition-colors duration-200 text-sm shadow-sm hover:shadow-md"
                                  title="تغيير الطاولة"
                                >
                                  <TableIcon className="h-4 w-4 ml-1" />
                                  تغيير الطاولة
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedSessionForUnlink(session);
                                    setCustomerNameForUnlink(session.customerName || '');
                                    setShowUnlinkTableModal(true);
                                  }}
                                  className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center transition-colors duration-200 text-sm shadow-sm hover:shadow-md"
                                  title="فك الربط من الطاولة"
                                >
                                  <X className="h-4 w-4 ml-1" />
                                  فك الربط
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedSessionForLink(session);
                                  setShowLinkTableModal(true);
                                }}
                                className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center transition-colors duration-200 text-sm shadow-sm hover:shadow-md"
                                title="ربط الجلسة بطاولة"
                              >
                                <TableIcon className="h-4 w-4 ml-1" />
                                ربط بطاولة
                              </button>
                            )}
                          </>
                        );
                      })()}
                      {/* زر إنهاء الجلسة */}
                      <button
                        onClick={() => handleEndSession(session.id)}
                        disabled={endingSessions[session.id]}
                        className={`${endingSessions[session.id] ? 'bg-red-700 dark:bg-red-800' : 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'} text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 min-w-[80px] justify-center shadow-sm hover:shadow-md`}
                        title="إنهاء الجلسة"
                      >
                        {endingSessions[session.id] ? (
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <>
                            <Square className="h-4 w-4 ml-1" />
                            إنهاء
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* نافذة بدء جلسة جديدة - محسّنة للشاشات الصغيرة */}
      {showNewSession && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
                بدء جلسة جديدة
              </h2>
              <button
                onClick={() => {
                  if (!loadingSession) {
                    setShowNewSession(false);
                    setSelectedDevice(null);
                    setSelectedControllers(null);
                    setSessionError(null);
                    setSelectedTable(null);
                  }
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                disabled={loadingSession}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <span className="font-bold">الجهاز:</span> {selectedDevice.name}
              </p>
            </div>
            {/* ربط بطاولة (اختياري) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ربط بطاولة (اختياري)</label>
              <select
                value={selectedTable || ''}
                onChange={(e) => setSelectedTable(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">بدون طاولة</option>
                {tables.filter((t: any) => t.isActive).sort((a: any, b: any) => {
                  return String(a.number).localeCompare(String(b.number), 'ar', { numeric: true });
                }).map((table: any) => (
                  <option key={table.id || table._id} value={table._id}>
                    طاولة {table.number}
                  </option>
                ))}
              </select>
            </div>
            
            {/* عدد الدراعات */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                عدد الدراعات <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSelectedControllers(num)}
                    disabled={loadingSession}
                    className={`p-3 rounded-lg border text-center transition-all duration-200 ${
                      selectedControllers === num 
                        ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-500 text-orange-700 dark:text-orange-300 ring-2 ring-orange-500' 
                        : 'bg-white dark:bg-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-500 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600'
                    } ${loadingSession ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Users className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-bold">{num}</span>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {selectedDevice.playstationRates && selectedDevice.playstationRates[num] ? `${selectedDevice.playstationRates[num]} ج.م/س` : '-'}
                    </div>
                  </button>
                ))}
              </div>
              {!selectedControllers && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  يرجى اختيار عدد الأذرع لبدء الجلسة
                </p>
              )}
            </div>
            {sessionError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{sessionError}</p>
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
              <button 
                type="button" 
                onClick={() => {
                  if (!loadingSession) {
                    setShowNewSession(false);
                    setSelectedDevice(null);
                    setSelectedControllers(null);
                    setSessionError(null);
                    setSelectedTable(null);
                  }
                }} 
                className="w-full sm:w-auto px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                disabled={loadingSession}
              >
                إلغاء
              </button>
              <button 
                type="button" 
                onClick={handleStartSession} 
                className={`w-full sm:w-auto px-6 py-2 rounded-lg flex items-center justify-center min-w-[140px] transition-all duration-200 ${
                  !selectedControllers || loadingSession
                    ? 'bg-orange-400 dark:bg-orange-700 cursor-not-allowed'
                    : 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600'
                } text-white`}
                disabled={!selectedControllers || loadingSession}
              >
                {loadingSession ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري البدء...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 ml-2" />
                    بدء الجلسة
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة ربط الجلسة بطاولة - محسّنة */}
      {showLinkTableModal && selectedSessionForLink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">ربط الجلسة بطاولة</h2>
              <button
                onClick={() => {
                  setShowLinkTableModal(false);
                  setSelectedSessionForLink(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                الجهاز: {devices.find(d => d.number === selectedSessionForLink.deviceNumber)?.name || selectedSessionForLink.deviceName}
              </p>
              {selectedSessionForLink.bill && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  الفاتورة: {typeof selectedSessionForLink.bill === 'object' ? (selectedSessionForLink.bill as any)?.billNumber : 'غير معروف'}
                </p>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اختر الطاولة</label>
              <select
                value={(() => {
                  if (!selectedSessionForLink.bill) return '';
                  const bill = typeof selectedSessionForLink.bill === 'object' ? selectedSessionForLink.bill : null;
                  const billTable = bill ? (bill as any)?.table : null;
                  return billTable?._id || '';
                })()}
                onChange={async (e) => {
                  const tableId = e.target.value || null;
                  await handleLinkTableToSession(selectedSessionForLink, tableId);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={linkingTable}
              >
                <option value="">بدون طاولة</option>
                {tables.filter((t: any) => t.isActive).sort((a: any, b: any) => {
                  return String(a.number).localeCompare(String(b.number), 'ar', { numeric: true });
                }).map((table: any) => (
                  <option key={table.id || table._id} value={table._id}>
                    طاولة {table.number}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowLinkTableModal(false);
                  setSelectedSessionForLink(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100"
                disabled={linkingTable}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة فك ربط الجلسة من الطاولة */}
      {showUnlinkTableModal && selectedSessionForUnlink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">فك ربط الجلسة من الطاولة</h2>
              <button
                onClick={() => {
                  setShowUnlinkTableModal(false);
                  setSelectedSessionForUnlink(null);
                  setCustomerNameForUnlink('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                disabled={unlinkingTable}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                الجهاز: {devices.find(d => d.number === selectedSessionForUnlink.deviceNumber)?.name || selectedSessionForUnlink.deviceName}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                الطاولة الحالية: {(() => {
                  const bill = typeof selectedSessionForUnlink.bill === 'object' ? selectedSessionForUnlink.bill : null;
                  const billTable = bill ? (bill as any)?.table : null;
                  return billTable?.number || 'غير معروف';
                })()}
              </p>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ سيتم فصل فاتورة الجلسة عن الطاولة ونقلها إلى قسم أجهزة البلايستيشن.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                اسم العميل <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerNameForUnlink}
                onChange={(e) => setCustomerNameForUnlink(e.target.value)}
                placeholder="أدخل اسم العميل"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={unlinkingTable}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                سيتم استخدام هذا الاسم في الفاتورة الجديدة
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                onClick={() => {
                  setShowUnlinkTableModal(false);
                  setSelectedSessionForUnlink(null);
                  setCustomerNameForUnlink('');
                }}
                className="w-full sm:w-auto px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                disabled={unlinkingTable}
              >
                إلغاء
              </button>
              <button
                onClick={handleUnlinkTableFromSession}
                className={`w-full sm:w-auto px-6 py-2 rounded-lg flex items-center justify-center min-w-[120px] transition-all duration-200 ${
                  unlinkingTable || !customerNameForUnlink.trim()
                    ? 'bg-red-400 dark:bg-red-700 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
                } text-white`}
                disabled={unlinkingTable || !customerNameForUnlink.trim()}
              >
                {unlinkingTable ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري فك الربط...
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5 ml-2" />
                    فك الربط
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إنهاء الجلسة مع طلب اسم العميل - محسّنة */}
      {showEndSessionModal && selectedSessionForEnd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">إنهاء الجلسة</h2>
              <button
                onClick={() => {
                  setShowEndSessionModal(false);
                  setSelectedSessionForEnd(null);
                  setCustomerNameForEnd('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                disabled={endingSessions[selectedSessionForEnd.id]}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                الجهاز: {devices.find(d => d.number === selectedSessionForEnd.deviceNumber)?.name || selectedSessionForEnd.deviceName}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                عدد الأذرع: {selectedSessionForEnd.controllers ?? 1}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                بدأت: {new Date(selectedSessionForEnd.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ هذه الجلسة غير مرتبطة بطاولة. يرجى إدخال اسم العميل قبل الإنهاء.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                اسم العميل <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerNameForEnd}
                onChange={(e) => setCustomerNameForEnd(e.target.value)}
                placeholder="أدخل اسم العميل"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={endingSessions[selectedSessionForEnd.id]}
                autoFocus
              />
              {customerNameForEnd.trim() === '' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  اسم العميل مطلوب لإنهاء الجلسة
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                onClick={() => {
                  if (!endingSessions[selectedSessionForEnd.id]) {
                    setShowEndSessionModal(false);
                    setSelectedSessionForEnd(null);
                    setCustomerNameForEnd('');
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                disabled={endingSessions[selectedSessionForEnd.id]}
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  if (customerNameForEnd.trim() === '') {
                    showNotification('⚠️ يرجى إدخال اسم العميل قبل إنهاء الجلسة', 'error');
                    return;
                  }
                  handleEndSessionWithCustomerName(selectedSessionForEnd.id, customerNameForEnd.trim());
                }}
                className={`w-full sm:w-auto px-6 py-2 rounded-lg flex items-center justify-center min-w-[140px] transition-all duration-200 ${
                  customerNameForEnd.trim() === '' || endingSessions[selectedSessionForEnd.id]
                    ? 'bg-red-400 dark:bg-red-700 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'
                } text-white`}
                disabled={customerNameForEnd.trim() === '' || endingSessions[selectedSessionForEnd.id]}
              >
                {endingSessions[selectedSessionForEnd.id] ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري الإنهاء...
                  </>
                ) : (
                  <>
                    <Square className="h-5 w-5 ml-2" />
                    إنهاء الجلسة
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تأكيد تعديل عدد الأذرع */}
      {showControllersConfirm && controllersChangeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">تأكيد تعديل عدد الأذرع</h2>
              <button
                onClick={() => {
                  setShowControllersConfirm(false);
                  setControllersChangeData(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
                <p className="text-blue-800 dark:text-blue-200 font-medium mb-2">
                  📝 تفاصيل التعديل
                </p>
                <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                  <p>• الجهاز: <span className="font-bold">{controllersChangeData.deviceName}</span></p>
                  <p>• العدد الحالي: <span className="font-bold">{controllersChangeData.oldCount} دراع</span></p>
                  <p>• العدد الجديد: <span className="font-bold">{controllersChangeData.newCount} دراع</span></p>
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ سيتم إعادة حساب التكلفة بناءً على العدد الجديد من الأذرع
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowControllersConfirm(false);
                  setControllersChangeData(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors duration-200"
              >
                إلغاء
              </button>
              <button
                onClick={confirmUpdateControllers}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg flex items-center transition-colors duration-200"
              >
                <Users className="h-4 w-4 ml-2" />
                تأكيد التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة جهاز جديد */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddDevice} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100">إضافة جهاز بلايستيشن جديد</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم الجهاز</label>
              <input type="text" value={newDevice.name} onChange={e => setNewDevice({ ...newDevice, name: e.target.value })} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رقم الجهاز</label>
              <input type="number" value={newDevice.number} onChange={e => setNewDevice({ ...newDevice, number: e.target.value })} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="1" />
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 col-span-2">سعر الساعة لكل عدد دراعات</label>
              <div>
                <span className="block text-xs text-gray-600 dark:text-gray-400 mb-1">دراع واحد</span>
                <input type="number" value={newDevice.playstationRates[1]} onChange={e => setNewDevice({ ...newDevice, playstationRates: { ...newDevice.playstationRates, 1: e.target.value } })} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-gray-100" required min="0" step="0.01" />
              </div>
              <div>
                <span className="block text-xs text-gray-600 dark:text-gray-400 mb-1">درعين</span>
                <input type="number" value={newDevice.playstationRates[2]} onChange={e => setNewDevice({ ...newDevice, playstationRates: { ...newDevice.playstationRates, 2: e.target.value } })} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-gray-100" required min="0" step="0.01" />
              </div>
              <div>
                <span className="block text-xs text-gray-600 dark:text-gray-400 mb-1">3 دراعات</span>
                <input type="number" value={newDevice.playstationRates[3]} onChange={e => setNewDevice({ ...newDevice, playstationRates: { ...newDevice.playstationRates, 3: e.target.value } })} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-gray-100" required min="0" step="0.01" />
              </div>
              <div>
                <span className="block text-xs text-gray-600 dark:text-gray-400 mb-1">4 دراعات</span>
                <input type="number" value={newDevice.playstationRates[4]} onChange={e => setNewDevice({ ...newDevice, playstationRates: { ...newDevice.playstationRates, 4: e.target.value } })} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-gray-100" required min="0" step="0.01" />
              </div>
            </div>
            {addDeviceError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{addDeviceError}</p>
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
              <button 
                type="button" 
                onClick={() => {
                  if (!isAddingDevice) {
                    setShowAddDevice(false);
                    setAddDeviceError(null);
                  }
                }} 
                className="w-full sm:w-auto px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                disabled={isAddingDevice}
              >
                إلغاء
              </button>
              <button 
                type="submit" 
                className={`w-full sm:w-auto px-6 py-2 rounded-lg flex items-center justify-center min-w-[120px] transition-all duration-200 ${
                  isAddingDevice
                    ? 'bg-orange-400 dark:bg-orange-700 cursor-not-allowed'
                    : 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600'
                } text-white`}
                disabled={isAddingDevice}
              >
                {isAddingDevice ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري الإضافة...
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 ml-2" />
                    إضافة الجهاز
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PlayStation;
