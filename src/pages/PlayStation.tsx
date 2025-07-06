import React, { useState, useEffect } from 'react';
import { Gamepad2, Play, Square, Users, Clock, DollarSign, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import api, { Device } from '../services/api';

const PlayStation: React.FC = () => {
  const { sessions, createSession, endSession, user, fetchSessions, devices, fetchDevices, createDevice } = useApp();
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', number: '', controllers: 2 });
  const [addDeviceError, setAddDeviceError] = useState<string | null>(null);

  // جلسة جديدة
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedControllers, setSelectedControllers] = useState<number | null>(null);

  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    console.log('PlayStation useEffect - loading data...');
    loadDevices();
    fetchSessions();
  }, []);

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
    setLoadingDevices(true);
    await fetchDevices();
    setLoadingDevices(false);
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
    console.log('بيانات الجهاز المرسلة:', deviceData);

    try {
      const device = await createDevice(deviceData);
      if (device) {
        setShowAddDevice(false);
        setNewDevice({ name: '', number: '', controllers: 2 });
      } else {
        setAddDeviceError('حدث خطأ أثناء إضافة الجهاز.');
      }
    } catch (err: any) {
      setAddDeviceError(err?.response?.data?.error || err?.message || 'حدث خطأ غير متوقع.');
      console.error('addDevice error:', err);
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

  const handleStartSession = async () => {
    try {
      setLoadingSession(true);
      setSessionError(null);
      if (!selectedDevice || !selectedControllers) return;

      const hourlyRate = getPlayStationHourlyRate(selectedControllers);

      const session = await createSession({
        deviceType: 'playstation',
        deviceNumber: selectedDevice.number,
        deviceName: selectedDevice.name,
        customerName: `عميل بلايستيشن(${selectedDevice.number})`,
        controllers: selectedControllers,
        hourlyRate,
      });

      if (session && session.id) {
        // تحديث حالة الجهاز
        await api.updateDevice(selectedDevice.id, { status: 'active' });

        // تحديث البيانات
        await loadDevices();
        await fetchSessions();

        // إغلاق النافذة وتنظيف الحالة
        setShowNewSession(false);
        setSelectedDevice(null);
        setSelectedControllers(null);
        setSessionError(null);

        // رسالة نجاح
        console.log('✅ تم بدء الجلسة بنجاح');
      } else {
        setSessionError('حدث خطأ أثناء بدء الجلسة.');
      }
    } catch (err: any) {
      setSessionError(err?.message || err?.response?.data?.message || 'حدث خطأ غير متوقع.');
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
        const billData = (result as any).bill;
        if (billData?.billNumber) {
          console.log(`✅ تم إنهاء الجلسة وإنشاء الفاتورة: ${billData.billNumber}`);
          // يمكن إضافة رسالة نجاح للمستخدم هنا
        }
      }

      // Refresh data after ending session
      await loadDevices();
      await fetchSessions();
    } catch (error) {
      console.error('Error ending session:', error);
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

      {/* Debug Info */}
      <div className="bg-yellow-100 p-4 rounded-lg">
        <h3 className="font-bold">Debug Info:</h3>
        <p>Devices count: {devices.length}</p>
        <p>Sessions count: {sessions.length}</p>
        <p>Active sessions: {sessions.filter(s => s.status === 'active').length}</p>
        <p>PlayStation sessions: {sessions.filter(s => s.deviceType === 'playstation' && s.status === 'active').length}</p>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {devices.filter(d => d.type === 'playstation').map((device) => {
          const activeSession = sessions.find(s => s.deviceNumber === device.number && s.status === 'active');
          console.log(`Device ${device.name} (${device.number}): activeSession =`, activeSession);
          return (
            <div key={device.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{device.name}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(device.status)}`}>{getStatusText(device.status)}</span>
              </div>
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
                          fetchSessions();
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
                          fetchSessions();
                        }
                      }}
                    >+</button>
                  </div>
                  <button
                    onClick={() => handleEndSession(activeSession.id)}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200"
                  >
                    <Square className="h-4 w-4 ml-2" />
                    إنهاء الجلسة
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  {device.status === 'available' ? (
                    <button
                      onClick={() => openSessionModal(device)}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200"
                    >
                      <Play className="h-4 w-4 ml-2" />
                      بدء الجلسة
                    </button>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      {device.status === 'maintenance' ? 'الجهاز في الصيانة' : 'غير متاح'}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
          <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">بدء جلسة جديدة</h3>
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
            <button
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg mt-4"
              disabled={!selectedControllers || loadingSession}
              onClick={handleStartSession}
            >
              {loadingSession ? 'جاري البدء...' : 'بدء الجلسة'}
            </button>
            <div className="flex justify-end space-x-3 space-x-reverse mt-6">
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
      )}

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
                            fetchSessions();
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
                            fetchSessions();
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
