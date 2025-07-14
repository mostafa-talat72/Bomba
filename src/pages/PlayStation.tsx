import React, { useState, useEffect } from 'react';
import { Gamepad2, Play, Square, Users, Clock, DollarSign, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import api, { Device } from '../services/api';

const PlayStation: React.FC = () => {
  const { sessions, createSession, endSession, user, fetchDevices, createDevice, bills, fetchBills, showNotification } = useApp();
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', number: '', controllers: 2 });
  const [addDeviceError, setAddDeviceError] = useState<string | null>(null);

  // جلسة جديدة
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedControllers, setSelectedControllers] = useState<number | null>(null);

  // خيارات ربط الفاتورة
  const [billOption, setBillOption] = useState<'new' | 'existing'>('new');
  const [selectedBillId, setSelectedBillId] = useState<string>('');
  const [searchBill, setSearchBill] = useState('');

  // جلب الفواتير المتاحة للربط بجلسة بلايستيشن
  const [availableBills, setAvailableBills] = useState<any[]>([]);
  const fetchAvailableBills = async () => {
    try {
      const response = await api.getAvailableBillsForSession('playstation');
      if (response.success && response.data) {
        setAvailableBills(response.data);
      } else {
        setAvailableBills([]);
      }
    } catch (error) {
      setAvailableBills([]);
    }
  };

  // عند فتح نافذة الجلسة الجديدة أو اختيار 'فاتورة موجودة'
  useEffect(() => {
    if (showNewSession && billOption === 'existing') {
      fetchAvailableBills();
    }
  }, [showNewSession, billOption]);

  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Loading states for better UX
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // تحميل البيانات بشكل متوازي عند بدء الصفحة
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsInitialLoading(true);
        setLoadingError(null);

        // تحميل البيانات بشكل متوازي لتحسين السرعة
        await Promise.all([
          fetchDevices(),
          fetchBills()
        ]);

      } catch (error) {
        console.error('Error loading initial data:', error);
        setLoadingError('حدث خطأ في تحميل البيانات');
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadAllData();
  }, []); // Remove dependencies to prevent infinite loop

  // إغلاق النافذة بمفتاح Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showNewSession && !loadingSession) {
        setShowNewSession(false);
        setSelectedDevice(null);
        setSelectedControllers(null);
        setSessionError(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showNewSession, loadingSession]);

  const loadDevices = async () => {
    try {
    await fetchDevices();
    } catch (error) {
      console.error('Error loading devices:', error);
      showNotification('خطأ في تحميل الأجهزة', 'error');
    }
  };

  // إضافة جهاز جديد (بدون تغيير)
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddDeviceError(null);
    if (!newDevice.name || !newDevice.number) return;

    // فحص عدم تكرار رقم الجهاز في الواجهة
    const existingDevice = devices.find(d => d.number === Number(newDevice.number));
    if (existingDevice) {
      setAddDeviceError(`رقم الجهاز ${newDevice.number} مستخدم بالفعل`);
      return;
    }

    // اطبع البيانات المرسلة
    const deviceData = {
      name: newDevice.name,
      number: Number(newDevice.number),
      type: 'playstation',
      status: 'available',
      controllers: newDevice.controllers
    };

    try {
      const device = await createDevice(deviceData);
      if (device) {
        setShowAddDevice(false);
        setNewDevice({ name: '', number: '', controllers: 2 });
      } else {
        setAddDeviceError('حدث خطأ أثناء إضافة الجهاز.');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setAddDeviceError(error?.response?.data?.error || error?.message || 'حدث خطأ غير متوقع.');
      showNotification('addDevice error:', 'error');
    }
  };

  // بدء جلسة جديدة
  const openSessionModal = (device: Device) => {
    setSelectedDevice(device);
    setSelectedControllers(null);
    setShowNewSession(true);
  };

  // دالة لحساب السعر حسب عدد الدراعات
  const getPlayStationHourlyRate = (controllers: number) => {
    if (controllers === 1 || controllers === 2) return 20;
    if (controllers === 3) return 25;
    if (controllers === 4) return 30;
    return 20;
  };

  // دالة لفلترة الفواتير المفتوحة
  const getOpenBills = () => {
    return bills.filter(bill => {
      // التحقق من حالة الفاتورة
      if (bill.status === 'paid' || bill.status === 'cancelled') {
        return false;
      }

      // التحقق من نوع الفاتورة
      if (bill.billType !== 'playstation' && bill.billType !== 'cafe') {
        return false;
      }

      // تصفية الفواتير التي تحتوي على جلسات نشطة
      if (bill.sessions && bill.sessions.length > 0) {
        const hasActiveSessions = bill.sessions.some((session: { status: string; deviceType: string }) =>
          session.status === 'active' &&
          (session.deviceType === 'playstation' || session.deviceType === 'computer')
        );
        return !hasActiveSessions;
      }

      return true; // إذا لم تكن هناك جلسات، احتفظ بالفاتورة
    });
  };

  // دالة لفلترة الفواتير حسب البحث
  const getFilteredBills = () => {
    if (!searchBill.trim()) return availableBills;
    return availableBills.filter(bill =>
      bill.billNumber?.toLowerCase().includes(searchBill.toLowerCase()) ||
      bill.customerName?.toLowerCase().includes(searchBill.toLowerCase())
    );
  };

  // دالة لاختيار فاتورة
  const handleBillSelection = (bill: { _id?: string; id?: string }) => {
    setSelectedBillId(bill._id || bill.id || '');
    setSearchBill('');
  };

  // دالة لتغيير خيار الفاتورة
  const handleBillOptionChange = (option: 'new' | 'existing') => {
    setBillOption(option);
    setSelectedBillId('');
    setSearchBill('');
  };

  const handleStartSession = async () => {
    try {
      setLoadingSession(true);
      setSessionError(null);
      if (!selectedDevice || !selectedControllers) return;

      const hourlyRate = getPlayStationHourlyRate(selectedControllers);

      let session;
      let apiResponse;

      if (billOption === 'new') {
        // إنشاء جلسة جديدة مع فاتورة جديدة (كما كان سابقاً)
        apiResponse = await createSession({
          deviceType: 'playstation',
          deviceNumber: selectedDevice.number,
          deviceName: selectedDevice.name,
          customerName: `عميل بلايستيشن(${selectedDevice.number})`,
          controllers: selectedControllers,
          hourlyRate,
        });
        session = apiResponse;
      } else if (billOption === 'existing' && selectedBillId) {
        // إنشاء جلسة جديدة وربطها بفاتورة موجودة
        const sessionData = {
          deviceType: 'playstation',
          deviceNumber: selectedDevice.number,
          deviceName: selectedDevice.name,
          customerName: `عميل بلايستيشن(${selectedDevice.number})`,
          controllers: selectedControllers,
          hourlyRate,
          billId: selectedBillId // إضافة معرف الفاتورة
        };

        // استدعاء API لإنشاء جلسة وربطها بفاتورة موجودة
        apiResponse = await api.createSessionWithExistingBill(sessionData);
        if (apiResponse.success && apiResponse.data) {
          session = apiResponse.data.session;
        } else {
          setSessionError(apiResponse.message || 'فشل في إنشاء الجلسة');
          showNotification(apiResponse.message || 'فشل في إنشاء الجلسة', 'error');
          return;
        }
      } else {
        setSessionError('يرجى اختيار فاتورة موجودة');
        showNotification('يرجى اختيار فاتورة موجودة', 'error');
        return;
      }

      if (session && (session.id || session._id)) {
        // تحديث حالة الجهاز
        await api.updateDeviceStatus(selectedDevice.id, { status: 'active' });

        // تحديث البيانات
        await loadDevices();
        await fetchBills();

        // إغلاق النافذة وتنظيف الحالة
        setShowNewSession(false);
        setSelectedDevice(null);
        setSelectedControllers(null);
        setSessionError(null);
        setBillOption('new');
        setSelectedBillId('');
        setSearchBill('');

        // رسالة نجاح
        const billInfo = billOption === 'existing' ? ' وربطها بفاتورة موجودة' : '';
        showNotification(`✅ تم بدء الجلسة بنجاح${billInfo}`, 'success');
      } else {
        setSessionError('حدث خطأ أثناء بدء الجلسة. لم يتم استلام بيانات الجلسة من الخادم.');
        showNotification('حدث خطأ أثناء بدء الجلسة. لم يتم استلام بيانات الجلسة من الخادم.', 'error');
      }
    } catch (err: unknown) {
      const error = err as { message?: string; response?: { data?: { message?: string } } };
      setSessionError(error?.message || error?.response?.data?.message || 'حدث خطأ غير متوقع.');
      showNotification(error?.message || error?.response?.data?.message || 'حدث خطأ غير متوقع.', 'error');
      console.error('createSession error:', err);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      const result = await endSession(sessionId);

      // Show success message with bill info if available
      if (result && typeof result === 'object' && 'bill' in result) {
        const billData = result as { bill?: { billNumber?: string } };
        if (billData?.bill?.billNumber) {
          showNotification(`✅ تم إنهاء الجلسة وإنشاء الفاتورة: ${billData.bill.billNumber}`);
          // يمكن إضافة رسالة نجاح للمستخدم هنا
        }
      }

      // Refresh data after ending session
      await loadDevices();
      await fetchBills();
    } catch {
      showNotification('Error ending session:', 'error');
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
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Gamepad2 className="h-8 w-8 text-primary-600 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إدارة البلايستيشن</h1>
            <p className="text-gray-600">متابعة وإدارة جلسات البلايستيشن</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAddDevice(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
            >
              <Plus className="h-5 w-5 ml-2" />
              إضافة جهاز
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isInitialLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-blue-800 font-medium">جاري تحميل البيانات...</p>
          <p className="text-blue-600 text-sm">يرجى الانتظار قليلاً</p>
        </div>
      )}

      {/* Error State */}
      {loadingError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800 font-medium">{loadingError}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
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
        {devices.filter(d => d.type === 'playstation').map((device) => {
          const activeSession = sessions.find(s => s.deviceNumber === device.number && s.status === 'active');
          return (
                <div key={device.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{device.name}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(device.status)}`}>{getStatusText(device.status)}</span>
              </div>

                  <div className="flex-1">
              {activeSession ? (
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 ml-1" />
                    بدأت: {new Date(activeSession.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 ml-1" />
                    {activeSession.controllers} دراع
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <DollarSign className="h-4 w-4 ml-1" />
                    {getPlayStationHourlyRate(activeSession.controllers!)} ج.م/ساعة
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 bg-gray-200 rounded"
                      disabled={(activeSession.controllers ?? 1) <= 1}
                      onClick={async () => {
                        const newCount = (activeSession.controllers ?? 1) - 1;
                        const res = await api.updateSessionControllers(activeSession.id, newCount);
                        if (res.success && res.data) {
                          // No need to fetchSessions here, as sessions are managed by useApp
                        }
                      }}
                    >-</button>
                    <span className="mx-2 font-bold">{activeSession.controllers ?? 1} دراع</span>
                    <button
                      className="px-2 py-1 bg-gray-200 rounded"
                      disabled={(activeSession.controllers ?? 1) >= 4}
                      onClick={async () => {
                        const newCount = (activeSession.controllers ?? 1) + 1;
                        const res = await api.updateSessionControllers(activeSession.id, newCount);
                        if (res.success && res.data) {
                          // No need to fetchSessions here, as sessions are managed by useApp
                        }
                      }}
                    >+</button>
                  </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        {device.status === 'maintenance' && (
                          <p className="text-gray-500 text-sm">الجهاز في الصيانة</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* الأزرار دائماً في نهاية الكارت */}
                  <div className="mt-4">
                    {activeSession ? (
                  <button
                    onClick={() => handleEndSession(activeSession.id)}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200"
                  >
                    <Square className="h-4 w-4 ml-2" />
                    إنهاء الجلسة
                  </button>
                    ) : device.status === 'available' ? (
                    <button
                      onClick={() => openSessionModal(device)}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200"
                    >
                      <Play className="h-4 w-4 ml-2" />
                      بدء الجلسة
                    </button>
                  ) : (
                      <div className="w-full py-2 px-4 rounded-lg bg-gray-100 text-gray-500 text-center text-sm">
                        غير متاح
                </div>
              )}
                  </div>
            </div>
          );
        })}
      </div>

      {/* Active Sessions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">الجلسات النشطة</h3>
        </div>
        <div className="p-6">
          {sessions.filter(
            s => s.status === 'active' &&
              s.deviceType === 'playstation' &&
              devices.some(d => d.number === s.deviceNumber)
          ).length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد جلسات نشطة حالياً</p>
          ) : (
            <div className="space-y-4">
              {sessions.filter(
                s => s.status === 'active' &&
                  s.deviceType === 'playstation' &&
                  devices.some(d => d.number === s.deviceNumber)
              ).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Gamepad2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="mr-4">
                      <p className="font-medium text-gray-900">{devices.find(d => d.number === session.deviceNumber)?.name || session.deviceName}</p>
                      <p className="text-sm text-gray-500">
                        {session.controllers} دراع • بدأت: {new Date(session.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                          {/* عرض رقم الفاتورة المرتبطة */}
                          {session.bill && (
                            <div className="mt-2">
                              <span className="text-sm text-green-600 font-medium">
                                فاتورة: {session.bill.billNumber}
                              </span>
                            </div>
                          )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 bg-gray-200 rounded"
                        disabled={(session.controllers ?? 1) <= 1}
                        onClick={async () => {
                          const newCount = (session.controllers ?? 1) - 1;
                          const res = await api.updateSessionControllers(session.id, newCount);
                          if (res.success && res.data) {
                            // No need to fetchSessions here, as sessions are managed by useApp
                          }
                        }}
                      >-</button>
                      <span className="mx-2 font-bold">{session.controllers ?? 1} دراع</span>
                      <button
                        className="px-2 py-1 bg-gray-200 rounded"
                        disabled={(session.controllers ?? 1) >= 4}
                        onClick={async () => {
                          const newCount = (session.controllers ?? 1) + 1;
                          const res = await api.updateSessionControllers(session.id, newCount);
                          if (res.success && res.data) {
                            // No need to fetchSessions here, as sessions are managed by useApp
                          }
                        }}
                      >+</button>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-green-600">{getPlayStationHourlyRate(session.controllers ?? 1)} ج.م/ساعة</p>
                      <p className="text-xs text-gray-500">السعر الحالي</p>
                    </div>
                    <button
                      onClick={() => handleEndSession(session.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
                    >
                      <Square className="h-4 w-4 ml-1" />
                      إنهاء
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

      {/* New Session Modal */}
      {showNewSession && selectedDevice && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !loadingSession) {
              setShowNewSession(false);
              setSelectedDevice(null);
              setSelectedControllers(null);
              setSessionError(null);
            }
          }}
        >
          <div className="bg-white rounded-lg w-full max-w-md relative max-h-[90vh] flex flex-col">
            {/* Header - ثابت */}
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!loadingSession) {
                    setShowNewSession(false);
                    setSelectedDevice(null);
                    setSelectedControllers(null);
                    setSessionError(null);
                  }
                }}
                className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                disabled={loadingSession}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h3 className="text-lg font-semibold text-gray-900 text-center">بدء جلسة جديدة</h3>
            </div>

            {/* Content - قابل للتمرير */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* خيارات الفاتورة - مطابق للبلايستيشن */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">ربط الفاتورة</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleBillOptionChange('new')}
                    className={`p-3 rounded-lg border text-center transition-colors duration-200 ${billOption === 'new' ? 'bg-primary-100 border-primary-500 text-primary-700' : 'bg-white hover:bg-primary-50 hover:border-primary-500 text-gray-900'}`}
                  >
                    <div className="text-lg mb-1">🆕</div>
                    <div className="text-sm font-medium">فاتورة جديدة</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBillOptionChange('existing')}
                    className={`p-3 rounded-lg border text-center transition-colors duration-200 ${billOption === 'existing' ? 'bg-primary-100 border-primary-500 text-primary-700' : 'bg-white hover:bg-primary-50 hover:border-primary-500 text-gray-900'}`}
                  >
                    <div className="text-lg mb-1">🔗</div>
                    <div className="text-sm font-medium">فاتورة موجودة</div>
                  </button>
                </div>
              </div>

              {/* اختيار فاتورة موجودة */}
              {billOption === 'existing' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">اختر الفاتورة</label>
                  <input
                    type="text"
                    placeholder="ابحث عن فاتورة..."
                    value={searchBill}
                    onChange={(e) => setSearchBill(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />

                  {/* عرض الفاتورة المختارة */}
                  {selectedBillId && (
                    <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-green-800">
                            {getFilteredBills().find(bill => (bill._id || bill.id) === selectedBillId)?.billNumber}
                          </p>
                          <p className="text-sm text-green-600">
                            {getFilteredBills().find(bill => (bill._id || bill.id) === selectedBillId)?.customerName || 'بدون اسم'}
                          </p>
                          <p className="text-sm text-green-600">
                            المجموع: {getFilteredBills().find(bill => (bill._id || bill.id) === selectedBillId)?.total} ج.م
                          </p>
                        </div>
                        <div className="text-green-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}

                  {getFilteredBills().length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                      {getFilteredBills().map((bill) => (
                        <button
                          key={bill._id || bill.id}
                          type="button"
                          onClick={() => handleBillSelection(bill)}
                          className={`w-full p-2 text-right text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${selectedBillId === (bill._id || bill.id) ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}`}
                        >
                          <div className="font-medium">#{bill.billNumber}</div>
                          <div className="text-xs text-gray-500">{bill.customerName || 'بدون اسم'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchBill && getFilteredBills().length === 0 && (
                    <div className="mt-2 text-sm text-gray-500 text-center">لا توجد فواتير مطابقة</div>
                  )}
                </div>
              )}

              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">الجهاز</label>
                <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                  {selectedDevice.name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">عدد الدراعات</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSelectedControllers(num)}
                      className={`p-3 rounded-lg border text-center transition-colors duration-200 ${selectedControllers === num ? 'bg-primary-100 border-primary-500 text-primary-700' : 'bg-white hover:bg-primary-50 hover:border-primary-500 text-gray-900'}`}
                    >
                      <Users className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-sm">{num}</span>
                      <div className="text-xs text-gray-500">{getPlayStationHourlyRate(num)} ج.م/س</div>
                    </button>
                  ))}
                </div>
              </div>
              {sessionError && <div className="text-red-600 text-sm mb-2">{sessionError}</div>}
            </div>

            {/* Footer - ثابت */}
            <div className="p-6 border-t border-gray-200 flex-shrink-0">
              <button
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg mb-3"
                disabled={!selectedControllers || loadingSession}
                onClick={handleStartSession}
              >
                {loadingSession ? 'جاري البدء...' : 'بدء الجلسة'}
              </button>
              <div className="flex justify-end space-x-3 space-x-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewSession(false);
                    setSelectedDevice(null);
                    setSelectedControllers(null);
                    setSessionError(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                  disabled={loadingSession}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Device Modal (بدون تغيير) */}
      {showAddDevice && user?.role === 'admin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddDevice} className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">إضافة جهاز بلايستيشن جديد</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم الجهاز</label>
                <input
                  type="text"
                  value={newDevice.name}
                  onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">رقم الجهاز</label>
                <input
                  type="number"
                  value={newDevice.number}
                  onChange={e => setNewDevice({ ...newDevice, number: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">عدد الدراعات الافتراضي</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={newDevice.controllers}
                  onChange={e => setNewDevice({ ...newDevice, controllers: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
            </div>
            {addDeviceError && <div className="text-red-600 text-sm mb-2">{addDeviceError}</div>}
            <div className="flex justify-end space-x-3 space-x-reverse mt-6">
              <button
                type="button"
                onClick={() => setShowAddDevice(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
              >
                إضافة
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PlayStation;
