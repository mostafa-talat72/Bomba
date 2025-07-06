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
}

const Computer: React.FC = () => {
  const { user, sessions, createSession, endSession, fetchSessions } = useApp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [showNewSession, setShowNewSession] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [addDeviceError, setAddDeviceError] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState({ name: '', number: '' });

  // إغلاق النافذة عند الضغط على Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewSession(false);
        setShowAddDevice(false);
        setSelectedDevice(null);
        setSessionError(null);
        setAddDeviceError(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // تحميل الأجهزة
  const loadDevices = async () => {
    try {
      const response = await api.getDevices();
      if (response.success && response.data) {
        const computerDevices = response.data.filter((device: Device) => device.type === 'computer');
        setDevices(computerDevices);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  // إضافة جهاز جديد
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAddDeviceError(null);
      const response = await api.createDevice({
        name: newDevice.name,
        number: parseInt(newDevice.number),
        type: 'computer',
        status: 'available'
      });

      if (response.success) {
        setShowAddDevice(false);
        setNewDevice({ name: '', number: '' });
        await loadDevices();
      }
    } catch (err: any) {
      setAddDeviceError(err?.response?.data?.error || err?.message || 'حدث خطأ غير متوقع.');
      console.error('addDevice error:', err);
    }
  };

  // بدء جلسة جديدة
  const openSessionModal = (device: Device) => {
    setSelectedDevice(device);
    setShowNewSession(true);
  };

  const handleStartSession = async () => {
    try {
      setLoadingSession(true);
      setSessionError(null);
      if (!selectedDevice) return;

      const hourlyRate = 15; // سعر ثابت 15 ج.م/ساعة للكمبيوتر

      const session = await createSession({
        deviceType: 'computer',
        deviceNumber: selectedDevice.number,
        deviceName: selectedDevice.name,
        customerName: `عميل كمبيوتر(${selectedDevice.number})`,
        controllers: 1, // دائماً 1 للكمبيوتر
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

  // تحميل البيانات عند بدء الصفحة
  useEffect(() => {
    loadDevices();
    fetchSessions();
  }, []);

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
          <Monitor className="h-8 w-8 text-primary-600 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إدارة أجهزة الكمبيوتر</h1>
            <p className="text-gray-600">متابعة وإدارة جلسات الكمبيوتر</p>
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
        <p>Computer sessions: {sessions.filter(s => s.deviceType === 'computer' && s.status === 'active').length}</p>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {devices.map((device) => {
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
                    <DollarSign className="h-4 w-4 ml-1" />
                    15 ج.م/ساعة
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
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">الجهاز</label>
              <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                {selectedDevice.name}
              </div>
            </div>
            <div className="mb-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>السعر:</strong> 15 جنيه للساعة الواحدة
                </p>
              </div>
            </div>
            {sessionError && <div className="text-red-600 text-sm mb-4">{sessionError}</div>}
            <button
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
              disabled={loadingSession}
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
              s.deviceType === 'computer' &&
              devices.some(d => d.number === s.deviceNumber)
          ).length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد جلسات نشطة حالياً</p>
          ) : (
            <div className="space-y-4">
              {sessions.filter(
                s => s.status === 'active' &&
                  s.deviceType === 'computer' &&
                  devices.some(d => d.number === s.deviceNumber)
              ).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Monitor className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="mr-4">
                      <p className="font-medium text-gray-900">{devices.find(d => d.number === session.deviceNumber)?.name || session.deviceName}</p>
                      <p className="text-sm text-gray-500">
                        بدأت: {new Date(session.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="text-left">
                      <p className="font-bold text-green-600">15 ج.م/ساعة</p>
                      <p className="text-xs text-gray-500">السعر الثابت</p>
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

      {/* Add Device Modal */}
      {showAddDevice && user?.role === 'admin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddDevice} className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">إضافة جهاز كمبيوتر جديد</h3>
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
              {addDeviceError && (
                <div className="text-red-600 text-sm">{addDeviceError}</div>
              )}
            </div>
            <div className="flex justify-end space-x-3 space-x-reverse mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowAddDevice(false);
                  setNewDevice({ name: '', number: '' });
                  setAddDeviceError(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors duration-200"
              >
                إضافة الجهاز
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Computer;
