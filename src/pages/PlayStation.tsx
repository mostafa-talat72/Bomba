import React, { useState, useEffect } from 'react';
import { Gamepad2, Play, Square, Users, Clock, DollarSign, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import api, { Device, Bill, Session } from '../services/api';

const PlayStation: React.FC = () => {
  const { sessions, createSession, endSession, user, createDevice, fetchBills, showNotification } = useApp();
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', number: '', controllers: 2, playstationRates: { 1: '', 2: '', 3: '', 4: '' } });
  const [addDeviceError, setAddDeviceError] = useState<string | null>(null);

  // جلسة جديدة
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedControllers, setSelectedControllers] = useState<number | null>(null);

  // خيارات ربط الفاتورة
  const [billOption, setBillOption] = useState<'new' | 'existing'>('new');
  const [selectedBillId, setSelectedBillId] = useState<string>('');

  // جلب الفواتير المتاحة للربط بجلسة بلايستيشن
  const [availableBills, setAvailableBills] = useState<Bill[]>([]);
  const fetchAvailableBills = async () => {
    try {
      const response = await api.getAvailableBillsForSession('playstation');
      if (response.success && response.data) {
        setAvailableBills(response.data);
      } else {
        setAvailableBills([]);
      }
    } catch {
      setAvailableBills([]);
    }
  };

  // تصفية الفواتير المتاحة لربط الجلسة
  const filteredAvailableBills = availableBills.filter((bill: Bill) => {
    // استبعاد الفواتير المدفوعة بالكامل أو الملغية
    if (bill.status === 'paid' || bill.status === 'cancelled') return false;
    // استبعاد الفواتير التي تحتوي على جلسة نشطة لأي جهاز
    if (bill.sessions && bill.sessions.some((session: Session) => session.status === 'active')) return false;
    return true;
  });

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

  // إضافة أجهزة
  const [devices, setDevices] = useState<Device[]>([]);
  const [searchBill, setSearchBill] = useState('');

  // تحميل الأجهزة
  const loadDevices = async () => {
    try {
      const response = await api.getDevices();
      if (response.success && response.data) {
        const playstationDevices = response.data.filter((device: Device) => device.type === 'playstation');
        setDevices(playstationDevices);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
      showNotification('خطأ في تحميل الأجهزة', 'error');
    }
  };

  // تحميل البيانات بشكل متوازي عند بدء الصفحة
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsInitialLoading(true);
        setLoadingError(null);

        // تحميل البيانات بشكل متوازي لتحسين السرعة
        await Promise.all([
          loadDevices(),
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
        setSelectedBillId('');
        setSearchBill('');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
    setAddDeviceError(null);
      const response = await createDevice({
      name: newDevice.name,
        number: parseInt(newDevice.number),
      type: 'playstation',
      status: 'available',
      controllers: newDevice.controllers,
        playstationRates: newDevice.playstationRates
      });

      if (response) {
        setShowAddDevice(false);
        setNewDevice({ name: '', number: '', controllers: 2, playstationRates: { 1: '', 2: '', 3: '', 4: '' } });
        await loadDevices();
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setAddDeviceError(error?.response?.data?.error || error?.message || 'حدث خطأ غير متوقع.');
      console.error('addDevice error:', err);
    }
  };

  const openSessionModal = (device: Device) => {
    setSelectedDevice(device);
    setShowNewSession(true);
    setBillOption('new');
    setSelectedBillId('');
    setSearchBill('');
  };

  const getPlayStationHourlyRate = (device: Device | null, controllers: number) => {
    if (!device || !device.playstationRates) return 0;
    return device.playstationRates[controllers as keyof typeof device.playstationRates] || 0;
  };

  const handleBillSelection = (bill: { _id?: string; id?: string }) => {
    setSelectedBillId(bill._id || bill.id || '');
  };

  const handleBillOptionChange = (option: 'new' | 'existing') => {
    setBillOption(option);
    setSelectedBillId('');
  };

  const handleStartSession = async () => {
    try {
      setLoadingSession(true);
      setSessionError(null);
      if (!selectedDevice || !selectedControllers) return;

      let session;
      let apiResponse;

      if (billOption === 'existing' && selectedBillId) {
        // إنشاء جلسة مرتبطة بفاتورة موجودة
        apiResponse = await api.createSessionWithExistingBill({
          deviceType: 'playstation',
          deviceNumber: selectedDevice.number,
          deviceName: selectedDevice.name,
          customerName: `عميل بلايستيشن (${selectedDevice.name})`,
          controllers: selectedControllers,
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
          deviceType: 'playstation',
          deviceNumber: selectedDevice.number,
          deviceName: selectedDevice.name,
          customerName: `عميل بلايستيشن (${selectedDevice.name})`,
          controllers: selectedControllers,
          hourlyRate: getPlayStationHourlyRate(selectedDevice, selectedControllers)
        });
        session = apiResponse;
      }

      if (session && (session.id || session._id)) {
        // تحديث حالة الجهاز
        await api.updateDeviceStatus(selectedDevice.id, { status: 'active' });

        // تحديث البيانات
        await loadDevices();

        // إغلاق النافذة وتنظيف الحالة
        setShowNewSession(false);
        setSelectedDevice(null);
        setSelectedControllers(null);
        setBillOption('new');
        setSelectedBillId('');
        setSearchBill('');
        setSessionError(null);

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
          // يمكن إضافة رسالة نجاح للمستخدم هنا
        }
      }

      // Refresh data after ending session
      await loadDevices();
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  // Helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300';
      case 'active': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'maintenance': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
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

  return (
    <div className="space-y-6 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center">
          <Gamepad2 className="h-8 w-8 text-purple-600 dark:text-purple-400 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة أجهزة البلايستيشن</h1>
            <p className="text-gray-600 dark:text-gray-400">متابعة وإدارة جلسات البلايستيشن</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAddDevice(true)}
              className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 font-medium"
            >
              <Plus className="h-5 w-5 ml-2" />
              إضافة جهاز
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isInitialLoading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
          <p className="text-blue-800 dark:text-blue-300 font-medium">جاري تحميل البيانات...</p>
          <p className="text-blue-600 dark:text-blue-400 text-sm">يرجى الانتظار قليلاً</p>
        </div>
      )}

      {/* Error State */}
      {loadingError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800 dark:text-red-300 font-medium">{loadingError}</p>
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
                <div key={device.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col h-full hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{device.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(device.status)}`}>
                      {getStatusText(device.status)}
                    </span>
              </div>

                  <div className="flex-1">
              {activeSession ? (
                <div className="space-y-3">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4 ml-1" />
                    بدأت: {new Date(activeSession.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Users className="h-4 w-4 ml-1" />
                          {activeSession.controllers} لاعب
                  </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <DollarSign className="h-4 w-4 ml-1" />
                          {device.playstationRates && device.playstationRates[activeSession.controllers as keyof typeof device.playstationRates] ?
                            `${device.playstationRates[activeSession.controllers as keyof typeof device.playstationRates]} ج.م/ساعة` : '-'}
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
                        className="w-full bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200 font-medium"
                  >
                    <Square className="h-4 w-4 ml-2" />
                    إنهاء الجلسة
                  </button>
                    ) : device.status === 'available' ? (
                    <button
                      onClick={() => openSessionModal(device)}
                        className="w-full bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200 font-medium"
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
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">الجلسات النشطة</h3>
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
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                          <Gamepad2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="mr-4">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {devices.find(d => d.number === session.deviceNumber)?.name || session.deviceName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            بدأت: {new Date(session.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                            {session.controllers} لاعب
                      </p>
                          {/* عرض رقم الفاتورة المرتبطة */}
                          {session.bill && (
                            <div className="mt-2">
                              <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                                فاتورة: {session.bill.billNumber}
                              </span>
                            </div>
                          )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 space-x-reverse">
                        <div className="text-left">
                          <p className="font-bold text-orange-600 dark:text-orange-400">
                            {(() => {
                              const device = devices.find(d => d.number === session.deviceNumber);
                              if (device?.playstationRates && device.playstationRates[session.controllers as keyof typeof device.playstationRates]) {
                                return `${device.playstationRates[session.controllers as keyof typeof device.playstationRates]} ج.م/ساعة`;
                              }
                              return '-';
                            })()}
                          </p>
                    </div>
                    <button
                      onClick={() => handleEndSession(session.id)}
                          className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 font-medium"
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

      {/* نافذة بدء جلسة جديدة */}
      {showNewSession && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-900 dark:text-white">
              بدء جلسة جديدة لجهاز {selectedDevice.name}
            </h2>

            {/* خيارات ربط الفاتورة */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ربط الجلسة بفاتورة</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setBillOption('new')}
                  className={`p-3 rounded-lg border text-center transition-colors duration-200 ${
                    billOption === 'new'
                      ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-500 dark:border-orange-400 text-orange-700 dark:text-orange-300'
                      : 'bg-white dark:bg-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-500 dark:hover:border-orange-400 text-gray-900 dark:text-white'
                  }`}
                >
                  <div className="text-lg mb-1">🆕</div>
                  <div className="text-sm font-medium">فاتورة جديدة</div>
                </button>
                <button
                  type="button"
                  onClick={() => setBillOption('existing')}
                  className={`p-3 rounded-lg border text-center transition-colors duration-200 ${
                    billOption === 'existing'
                      ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-500 dark:border-orange-400 text-orange-700 dark:text-orange-300'
                      : 'bg-white dark:bg-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-500 dark:hover:border-orange-400 text-gray-900 dark:text-white'
                  }`}
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {filteredAvailableBills.filter(bill =>
                    bill.billNumber?.toLowerCase().includes(searchBill.toLowerCase()) ||
                    bill.customerName?.toLowerCase().includes(searchBill.toLowerCase())
                  ).length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                      {filteredAvailableBills.filter(bill =>
                        bill.billNumber?.toLowerCase().includes(searchBill.toLowerCase()) ||
                        bill.customerName?.toLowerCase().includes(searchBill.toLowerCase())
                      ).map((bill) => (
                        <button
                          key={bill._id}
                          type="button"
                          onClick={() => setSelectedBillId(bill._id)}
                          className={`w-full p-2 text-right text-sm hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${
                            selectedBillId === bill._id
                              ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
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
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 border border-orange-200 dark:border-orange-800 rounded">
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

            {/* اختيار عدد اللاعبين */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">عدد اللاعبين</label>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((controllers) => (
                  <button
                    key={controllers}
                    type="button"
                    onClick={() => setSelectedControllers(controllers)}
                    className={`p-3 rounded-lg border text-center transition-colors duration-200 ${
                      selectedControllers === controllers
                        ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-500 dark:border-orange-400 text-orange-700 dark:text-orange-300'
                        : 'bg-white dark:bg-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-500 dark:hover:border-orange-400 text-gray-900 dark:text-white'
                    }`}
                  >
                    <Users className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm">{controllers} لاعب</span>
                  </button>
                ))}
              </div>
            </div>

            {/* عرض سعر الساعة */}
            {selectedControllers && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">سعر الساعة</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    className="p-3 rounded-lg border text-center transition-colors duration-200 bg-orange-100 dark:bg-orange-900/30 border-orange-500 dark:border-orange-400 text-orange-700 dark:text-orange-300"
                    disabled
                  >
                    <DollarSign className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm">{getPlayStationHourlyRate(selectedDevice, selectedControllers) ? `${getPlayStationHourlyRate(selectedDevice, selectedControllers)} ج.م/س` : '-'}</span>
                  </button>
                </div>
              </div>
            )}

            {sessionError && <div className="text-red-600 dark:text-red-400 mb-2 text-sm">{sessionError}</div>}
            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={() => setShowNewSession(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded font-medium transition-colors duration-200"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleStartSession}
                className="px-4 py-2 bg-orange-600 dark:bg-orange-500 text-white rounded hover:bg-orange-700 dark:hover:bg-orange-600 font-medium transition-colors duration-200"
                disabled={loadingSession || !selectedControllers || (billOption === 'existing' && !selectedBillId)}
              >
                بدء الجلسة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <form onSubmit={handleAddDevice} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-900 dark:text-white">إضافة جهاز بلايستيشن جديد</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم الجهاز</label>
              <input
                type="text"
                value={newDevice.name}
                onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رقم الجهاز</label>
              <input
                type="number"
                value={newDevice.number}
                onChange={e => setNewDevice({ ...newDevice, number: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400"
                required
                min="1"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">عدد أجهزة التحكم</label>
              <input
                type="number"
                value={newDevice.controllers}
                onChange={e => setNewDevice({ ...newDevice, controllers: parseInt(e.target.value) })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400"
                required
                min="1"
                max="4"
              />
              </div>

            {/* أسعار الساعة لكل عدد لاعبين */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">أسعار الساعة</label>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((controllers) => (
                  <div key={controllers}>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{controllers} لاعب</label>
                    <input
                      type="number"
                      value={newDevice.playstationRates[controllers as keyof typeof newDevice.playstationRates]}
                      onChange={e => setNewDevice({
                        ...newDevice,
                        playstationRates: {
                          ...newDevice.playstationRates,
                          [controllers]: e.target.value
                        }
                      })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
              </div>
                ))}
              </div>
            </div>

            {addDeviceError && <div className="text-red-600 dark:text-red-400 mb-2 text-sm">{addDeviceError}</div>}
            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={() => setShowAddDevice(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded font-medium transition-colors duration-200"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 dark:bg-orange-500 text-white rounded hover:bg-orange-700 dark:hover:bg-orange-600 font-medium transition-colors duration-200"
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
