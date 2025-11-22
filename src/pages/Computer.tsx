import React, { useState, useEffect } from 'react';
import { Monitor, Play, Square, Clock, DollarSign, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

interface Device {
  id: string;
  name: string;
  number: number;
  status: string;
  type: string;
  hourlyRate?: number;
}

interface Bill {
  _id: string;
  billNumber: string;
  customerName?: string;
  total: number;
  status: string;
  createdAt: Date;
  sessions?: Array<{
    status: string;
    deviceType: string;
  }>;
  orders?: unknown[];
}

const Computer: React.FC = () => {
  const { user, sessions, createSession, endSession, fetchSessions, showNotification } = useApp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [showNewSession, setShowNewSession] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [addDeviceError, setAddDeviceError] = useState<string | null>(null);
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [endingSessions, setEndingSessions] = useState<Record<string, boolean>>({});
  const [newDevice, setNewDevice] = useState({ name: '', number: '', hourlyRate: '' });

  // Bill linking state - matching PlayStation style
  const [billOption, setBillOption] = useState<'new' | 'existing'>('new');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [searchBill, setSearchBill] = useState('');

  // جلب الفواتير المتاحة للربط بجلسة كمبيوتر
  const [availableBills, setAvailableBills] = useState<Bill[]>([]);
  const fetchAvailableBills = async () => {
    try {
      const response = await api.getAvailableBillsForSession('computer');
      if (response.success && response.data) {
        setAvailableBills(response.data);
      } else {
        setAvailableBills([]);
      }
    } catch {
      setAvailableBills([]);
    }
  };

  // عند فتح نافذة الجلسة الجديدة أو اختيار 'فاتورة موجودة'
  useEffect(() => {
    if (showNewSession && billOption === 'existing') {
      fetchAvailableBills();
    }
  }, [showNewSession, billOption]);

  // تصفية الفواتير المتاحة لربط الجلسة
  const filteredAvailableBills = availableBills.filter((bill: Bill) => {
    if (bill.status === 'paid' || bill.status === 'cancelled') return false;
    if (bill.sessions && bill.sessions.some((session: { status: string }) => session.status === 'active')) return false;
    return true;
  });

  // Loading states for better UX
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // إغلاق النافذة عند الضغط على Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewSession(false);
        setShowAddDevice(false);
        setSelectedDevice(null);
        setSessionError(null);
        setAddDeviceError(null);
        setBillOption('new');
        setSelectedBillId(null);
        setSearchBill('');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // تحميل البيانات بشكل متوازي عند بدء الصفحة
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsInitialLoading(true);
        setLoadingError(null);

        // تحميل البيانات بشكل متوازي لتحسين السرعة
        await Promise.all([
          loadDevices(),
          fetchSessions(),
          loadOpenBills()
        ]);

      } catch (error) {
        setLoadingError('حدث خطأ في تحميل البيانات');
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadAllData();
  }, []); // Remove dependencies to prevent infinite loop

  // تحميل الفواتير المفتوحة مع تصفية الفواتير التي تحتوي على جلسات نشطة
  const loadOpenBills = async () => {
    try {
      const response = await api.getBills({ status: 'draft' });
      if (response.success && response.data) {
        // تصفية الفواتير التي تحتوي على جلسات نشطة
        response.data.filter((bill: Bill) => {
          // إذا كان للفاتورة جلسات، تحقق من عدم وجود جلسات نشطة
          if (bill.sessions && bill.sessions.length > 0) {
            const hasActiveSessions = bill.sessions.some((session) =>
              session.status === 'active' &&
              (session.deviceType === 'playstation' || session.deviceType === 'computer')
            );
            return !hasActiveSessions;
          }
          return true; // إذا لم تكن هناك جلسات، احتفظ بالفاتورة
        });
      }
    } catch (error) {
      }
  };

  // تحميل الأجهزة
  const loadDevices = async () => {
    try {
      const response = await api.getDevices();
      if (response.success && response.data) {
        const computerDevices = response.data.filter((device: Device) => device.type === 'computer');
        setDevices(computerDevices);
      }
    } catch (error) {
      }
  };

  // إضافة جهاز جديد
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsAddingDevice(true);
      setAddDeviceError(null);
      const response = await api.createDevice({
        name: newDevice.name,
        number: parseInt(newDevice.number),
        type: 'computer',
        status: 'available',
        hourlyRate: parseFloat(newDevice.hourlyRate)
      });

      if (response.success) {
        setShowAddDevice(false);
        setNewDevice({ name: '', number: '', hourlyRate: '' });
        await loadDevices();
        showNotification('تمت إضافة الجهاز بنجاح', 'success');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      const errorMessage = error?.response?.data?.error || error?.message || 'حدث خطأ غير متوقع.';
      setAddDeviceError(errorMessage);
      showNotification(errorMessage, 'error');
      } finally {
      setIsAddingDevice(false);
    }
  };

  // بدء جلسة جديدة
  const openSessionModal = (device: Device) => {
    setSelectedDevice(device);
    setShowNewSession(true);
    setBillOption('new');
    setSelectedBillId(null);
    setSearchBill('');
    loadOpenBills();
  };

  // اختيار فاتورة
  // const handleBillSelection = (bill: Bill) => {
  //   setSelectedBillId(bill._id);
  // };

  // تغيير خيار الفاتورة
  // const handleBillOptionChange = (option: 'new' | 'existing') => {
  //   setBillOption(option);
  //   setSelectedBillId(null);
  // };

  const handleStartSession = async () => {
    try {
      setLoadingSession(true);
      setSessionError(null);
      
      if (!selectedDevice) {
        setLoadingSession(false);
        return;
      }

      let session;
      let apiResponse;

      if (billOption === 'existing' && selectedBillId) {
        // إنشاء جلسة مرتبطة بفاتورة موجودة
        apiResponse = await api.createSessionWithExistingBill({
          deviceId: selectedDevice._id, // أضف هذا السطر
          deviceType: 'computer',
          deviceNumber: selectedDevice.number,
          deviceName: selectedDevice.name,
          customerName: `عميل كمبيوتر (${selectedDevice.name})`,
          controllers: 1, // دائماً 1 للكمبيوتر
          billId: selectedBillId
        });
        if (apiResponse.success && apiResponse.data) {
          session = apiResponse.data.session;
        } else {
          setSessionError(apiResponse.message || 'فشل في بدء الجلسة');
          showNotification(apiResponse.message || 'فشل في بدء الجلسة', 'error');
          return;
        }
      } else {
        // إنشاء جلسة جديدة مع فاتورة جديدة
        apiResponse = await createSession({
          deviceId: selectedDevice._id, // أضف هذا السطر
          deviceType: 'computer',
          deviceNumber: selectedDevice.number,
          deviceName: selectedDevice.name,
          customerName: `عميل كمبيوتر (${selectedDevice.name})`,
          controllers: 1, // دائماً 1 للكمبيوتر
          hourlyRate: selectedDevice.hourlyRate, // Use hourlyRate from selectedDevice
        });
        session = apiResponse;
      }

      if (session && (session.id || session._id)) {
        try {
          // تحديث حالة الجهاز
          await api.updateDeviceStatus(selectedDevice.id, { status: 'active' });

          // تحديث البيانات
          await loadDevices();
          await fetchSessions();

          // رسالة نجاح
          const billInfo = billOption === 'existing' ? ' وربطها بفاتورة موجودة' : '';
          showNotification(`✅ تم بدء الجلسة بنجاح${billInfo}`, 'success');
          
          // إغلاق النافذة وتنظيف الحالة بعد تأكيد نجاح العملية
          setShowNewSession(false);
          setSelectedDevice(null);
          setBillOption('new');
          setSelectedBillId(null);
          setSearchBill('');
          setSessionError(null);
        } catch (updateError) {
          showNotification('تم بدء الجلسة ولكن حدث خطأ في تحديث حالة الجهاز', 'warning');
          setShowNewSession(false); // مع ذلك نقوم بإغلاق النافذة
        }
      } else {
        setSessionError('حدث خطأ أثناء بدء الجلسة. لم يتم استلام بيانات الجلسة من الخادم.');
        showNotification('حدث خطأ أثناء بدء الجلسة. لم يتم استلام بيانات الجلسة من الخادم.', 'error');
      }
    } catch (err: unknown) {
      const error = err as { message?: string; response?: { data?: { message?: string } } };
      setSessionError(error?.message || error?.response?.data?.message || 'حدث خطأ غير متوقع.');
      showNotification(error?.message || error?.response?.data?.message || 'حدث خطأ غير متوقع.', 'error');
      } finally {
      setLoadingSession(false);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      setEndingSessions(prev => ({ ...prev, [sessionId]: true }));
      const result = await endSession(sessionId);

      // Show success message with bill info if available
      if (result && typeof result === 'object' && 'bill' in result) {
        const billData = result as { bill?: { billNumber?: string } };
        if (billData?.bill?.billNumber) {
          // يمكن إضافة رسالة نجاح للمستخدم هنا
        }
      }

      // Refresh data after ending session
      await loadDevices();
      await fetchSessions();
    } catch (error) {
      showNotification('حدث خطأ أثناء إنهاء الجلسة', 'error');
    } finally {
      setEndingSessions(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  // Helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'متاح';
      case 'active': return 'نشط';
      case 'maintenance': return 'صيانة';
      default: return 'غير معروف';
    }
  };

  // --- UI ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap xs:flex-col xs:items-start xs:gap-2 xs:space-y-2 xs:w-full">
        <div className="flex items-center xs:w-full xs:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center xs:text-base xs:w-full xs:text-center">
            <Monitor className="h-6 w-6 text-orange-600 dark:text-orange-400 ml-2" />
            إدارة أجهزة الكمبيوتر
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mr-4 xs:mr-0 xs:w-full xs:text-center">متابعة وإدارة جلسات الكمبيوتر</p>
        </div>
        <div className="flex items-center gap-2 xs:w-full xs:justify-center xs:mt-2">
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAddDevice(true)}
              className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
            >
              <Plus className="h-5 w-5 ml-2" />
              إضافة جهاز
            </button>
          )}
        </div>
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
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800 dark:text-red-200 font-medium">{loadingError}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm underline"
          >
            إعادة المحاولة
          </button>
      </div>
      )}

      {/* Content - Show only when not loading */}
      {!isInitialLoading && !loadingError && (
        <>


      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {devices.map((device) => {
          const activeSession = sessions.find(s => s.deviceNumber === device.number && s.status === 'active');
          return (
                <div key={device.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{device.name}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(device.status)}`}>{getStatusText(device.status)}</span>
              </div>

                  <div className="flex-1">
              {activeSession ? (
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <Clock className="h-4 w-4 ml-1" />
                    بدأت: {new Date(activeSession.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <DollarSign className="h-4 w-4 ml-1" />
                    {device.hourlyRate ? `${device.hourlyRate} ج.م/ساعة` : '-'}
                  </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        {device.status === 'maintenance' && (
                          <p className="text-gray-500 dark:text-gray-400 text-sm">الجهاز في الصيانة</p>
                        )}
                      </div>
                    )}
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
                      disabled={loadingSession}
                      className={`w-full bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200`}
                    >
                      {loadingSession ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          جاري البدء...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 ml-2" />
                          بدء الجلسة
                        </>
                      )}
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
              s.deviceType === 'computer' &&
              devices.some(d => d.number === s.deviceNumber)
          ).length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">لا توجد جلسات نشطة حالياً</p>
          ) : (
            <div className="space-y-4">
              {sessions.filter(
                s => s.status === 'active' &&
                  s.deviceType === 'computer' &&
                  devices.some(d => d.number === s.deviceNumber)
              ).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <Monitor className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="mr-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{devices.find(d => d.number === session.deviceNumber)?.name || session.deviceName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        بدأت: {new Date(session.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                          {/* عرض رقم الفاتورة المرتبطة */}
                          {session.bill && (
                            <div className="mt-2">
                              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                                فاتورة: {session.bill.billNumber}
                              </span>
                            </div>
                          )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="text-left">
                      <p className="font-bold text-green-600 dark:text-green-400">{devices.find(d => d.number === session.deviceNumber)?.hourlyRate ? `${devices.find(d => d.number === session.deviceNumber)?.hourlyRate} ج.م/ساعة` : '-'}</p>
                    </div>
                    <button
                      onClick={() => handleEndSession(session.id)}
                      disabled={endingSessions[session.id]}
                      className={`w-full ${endingSessions[session.id] ? 'bg-red-700 dark:bg-red-800' : 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'} text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200`}
                    >
                      {endingSessions[session.id] ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          جاري الإنهاء
                        </>
                      ) : (
                        <>
                          <Square className="h-4 w-4 ml-2" />
                          إنهاء الجلسة
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* نافذة بدء جلسة جديدة */}
      {showNewSession && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100">بدء جلسة جديدة لجهاز {selectedDevice.name}</h2>
            {/* خيارات ربط الفاتورة */}
              <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ربط الجلسة بفاتورة</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                  onClick={() => setBillOption('new')}
                    className={`p-3 rounded-lg border text-center transition-colors duration-200 ${billOption === 'new' ? 'bg-orange-100 dark:bg-orange-900/20 border-orange-500 text-orange-700 dark:text-orange-300' : 'bg-white dark:bg-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-500 text-gray-900 dark:text-gray-100'}`}
                  >
                    <div className="text-lg mb-1">🆕</div>
                    <div className="text-sm font-medium">فاتورة جديدة</div>
                  </button>
                  <button
                    type="button"
                  onClick={() => setBillOption('existing')}
                    className={`p-3 rounded-lg border text-center transition-colors duration-200 ${billOption === 'existing' ? 'bg-orange-100 dark:bg-orange-900/20 border-orange-500 text-orange-700 dark:text-orange-300' : 'bg-white dark:bg-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-500 text-gray-900 dark:text-gray-100'}`}
                  >
                    <div className="text-lg mb-1">🔗</div>
                    <div className="text-sm font-medium">فاتورة موجودة</div>
                  </button>
                </div>
              {billOption === 'existing' && (
                <div className="mb-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">اختر الفاتورة</label>
                  <input
                    type="text"
                    placeholder="ابحث عن فاتورة..."
                    value={searchBill}
                    onChange={e => setSearchBill(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                  {filteredAvailableBills.filter(bill =>
                    bill.billNumber?.toLowerCase().includes(searchBill.toLowerCase()) ||
                    bill.customerName?.toLowerCase().includes(searchBill.toLowerCase())
                  ).length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                      {filteredAvailableBills.filter(bill =>
                        bill.billNumber?.toLowerCase().includes(searchBill.toLowerCase()) ||
                        bill.customerName?.toLowerCase().includes(searchBill.toLowerCase())
                      ).map((bill) => (
                        <button
                          key={bill._id}
                          type="button"
                          onClick={() => setSelectedBillId(bill._id)}
                          className={`w-full p-2 text-right text-sm hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${selectedBillId === bill._id ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                          <div className="font-medium">#{bill.billNumber}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{bill.customerName || 'بدون اسم'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchBill && filteredAvailableBills.filter(bill =>
                    bill.billNumber?.toLowerCase().includes(searchBill.toLowerCase()) ||
                    bill.customerName?.toLowerCase().includes(searchBill.toLowerCase())
                  ).length === 0 && (
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">لا توجد فواتير مطابقة</div>
                  )}
                  {selectedBillId && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 border border-orange-200 dark:border-orange-600 rounded">
                      {(() => {
                        const bill = availableBills.find(b => b._id === selectedBillId);
                        if (!bill) return null;
                        return (
                          <div>
                            <div className="font-bold text-orange-700 dark:text-orange-300">فاتورة #{bill.billNumber}</div>
                            <div className="text-sm text-gray-700 dark:text-gray-300">العميل: {bill.customerName || 'بدون اسم'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">الإجمالي: {bill.total} ج.م</div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* عرض سعر الساعة */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">سعر الساعة</label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  className={`p-3 rounded-lg border text-center transition-colors duration-200 bg-orange-100 dark:bg-orange-900/20 border-orange-500 text-orange-700 dark:text-orange-300`}
                  disabled
                >
                  <Monitor className="h-5 w-5 mx-auto mb-1" />
                  <span className="text-sm">{selectedDevice.hourlyRate ? `${selectedDevice.hourlyRate} ج.م/س` : '-'}</span>
                </button>
              </div>
            </div>
            {sessionError && <div className="text-red-600 dark:text-red-400 mb-2 text-sm">{sessionError}</div>}
            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => setShowNewSession(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100">إلغاء</button>
              <button 
                type="button" 
                onClick={handleStartSession} 
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white rounded flex items-center justify-center min-w-32"
                disabled={loadingSession || (billOption === 'existing' && !selectedBillId)}
              >
                {loadingSession ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري التأكيد...
                  </>
                ) : 'بدء الجلسة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <form onSubmit={handleAddDevice} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100">إضافة جهاز كمبيوتر جديد</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم الجهاز</label>
              <input type="text" value={newDevice.name} onChange={e => setNewDevice({ ...newDevice, name: e.target.value })} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required />
              </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رقم الجهاز</label>
              <input type="number" value={newDevice.number} onChange={e => setNewDevice({ ...newDevice, number: e.target.value })} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="1" />
              </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">سعر الساعة (ج.م)</label>
              <input type="number" value={newDevice.hourlyRate} onChange={e => setNewDevice({ ...newDevice, hourlyRate: e.target.value })} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" step="0.01" />
            </div>
            {addDeviceError && <div className="text-red-600 dark:text-red-400 mb-2 text-sm">{addDeviceError}</div>}
            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => setShowAddDevice(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100">إلغاء</button>
              <button 
                type="submit" 
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white rounded flex items-center justify-center min-w-20"
                disabled={isAddingDevice}
              >
                {isAddingDevice ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري الحفظ...
                  </>
                ) : 'إضافة'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Computer;
