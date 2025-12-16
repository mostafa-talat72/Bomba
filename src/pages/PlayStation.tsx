import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Play, Square, Users, Plus, Table as TableIcon, X, Edit, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api, { Device, Session } from '../services/api';
import { SessionCostDisplay } from '../components/SessionCostDisplay';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import utc from 'dayjs/plugin/utc';

// Configure dayjs
dayjs.locale('ar');
dayjs.extend(utc);

// دالة لتحويل الأرقام الإنجليزية إلى العربية
const toArabicNumbers = (str: string): string => {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[0-9]/g, (digit) => arabicNumbers[parseInt(digit)]);
};

// دالة لتنسيق الوقت بالعربية (يوم/شهر/سنة)
const formatTimeInArabic = (dateTime: dayjs.Dayjs): string => {
  const formatted = dateTime.format('DD/MM/YYYY - hh:mm A');
  return toArabicNumbers(formatted)
    .replace('AM', 'ص')
    .replace('PM', 'م');
};

// دالة لتحويل قيمة datetime-local للعربية للعرض
const formatDateTimeLocalToArabic = (datetimeLocal: string): string => {
  if (!datetimeLocal) return '';
  // تحويل من datetime-local إلى dayjs مع إضافة ساعتين للتوقيت المصري
  const date = dayjs(datetimeLocal);
  return formatTimeInArabic(date);
};

const PlayStation: React.FC = () => {
  const location = useLocation();
  const { sessions, createSession, endSession, user, createDevice, updateDevice, deleteDevice, createBill, fetchBills, showNotification, tables, fetchTables, fetchTableSections, fetchSessions } = useApp();
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', number: '', controllers: 2, playstationRates: { 1: '20', 2: '20', 3: '25', 4: '30' } });
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
  
  // حالات التعديل والحذف
  const [showEditDevice, setShowEditDevice] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<any>(null);
  const [isDeletingDevice, setIsDeletingDevice] = useState(false);

  // نافذة إنهاء الجلسة مع طلب اسم العميل
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [selectedSessionForEnd, setSelectedSessionForEnd] = useState<Session | null>(null);
  const [customerNameForEnd, setCustomerNameForEnd] = useState('');

  // نافذة تعديل وقت بدء الجلسة
  const [showEditStartTimeModal, setShowEditStartTimeModal] = useState(false);
  const [selectedSessionForEditTime, setSelectedSessionForEditTime] = useState<Session | null>(null);
  const [newStartTime, setNewStartTime] = useState('');
  const [isUpdatingStartTime, setIsUpdatingStartTime] = useState(false);

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
      // تحميل أجهزة البلايستيشن فقط من الـ API (بدون حد)
      const response = await api.getDevices({ type: 'playstation' });
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

        // إخفاء شاشة التحميل فوراً بعد تحميل البيانات الأساسية
        setIsInitialLoading(false);

        // تحميل باقي البيانات في الخلفية (غير متزامن)
        Promise.all([
          fetchBills(),
          fetchTables(),
          fetchTableSections()
        ]).catch(error => {
          // Ignore errors in secondary data loading
        });

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

  // دوال التعديل والحذف
  const handleEditDevice = (device: any) => {
    setEditingDevice({
      ...device,
      number: typeof device.number === 'string' ? 
        device.number.replace(/[^0-9]/g, '') : device.number.toString(),
      playstationRates: device.playstationRates || { 1: '20', 2: '20', 3: '25', 4: '30' }
    });
    setShowEditDevice(true);
  };

  const handleDeleteDevice = (device: any) => {
    setDeviceToDelete(device);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteDevice = async () => {
    if (!deviceToDelete) return;
    
    setIsDeletingDevice(true);
    try {
      const success = await deleteDevice(deviceToDelete.id);
      if (success) {
        setShowDeleteConfirm(false);
        setDeviceToDelete(null);
        // تحديث قائمة الأجهزة
        await loadDevices();
      }
    } catch (error) {
      showNotification('حدث خطأ أثناء حذف الجهاز', 'error');
    } finally {
      setIsDeletingDevice(false);
    }
  };

  // إضافة جهاز جديد
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddDeviceError(null);
    if (!newDevice.name || !newDevice.number) {
      setAddDeviceError('اسم الجهاز ورقمه مطلوبان');
      setIsAddingDevice(false);
      return;
    }

    // التحقق من صحة رقم الجهاز
    const deviceNumber = parseInt(newDevice.number);
    if (isNaN(deviceNumber) || deviceNumber <= 0) {
      setAddDeviceError('رقم الجهاز يجب أن يكون رقم صحيح أكبر من 0');
      setIsAddingDevice(false);
      return;
    }

    // فحص عدم تكرار رقم الجهاز في الواجهة
    const existingDevice = devices.find(d => {
      const existingNumber = typeof d.number === 'string' ? 
        parseInt((d.number as string).replace(/[^0-9]/g, '')) : d.number;
      return existingNumber === deviceNumber;
    });
    if (existingDevice) {
      setAddDeviceError(`رقم الجهاز ${toArabicNumbers(String(deviceNumber))} مستخدم بالفعل في منشأتك فقط. يمكن استخدام نفس الرقم في منشآت أخرى، لكن يجب أن يكون فريد داخل منشأتك. جرب رقم آخر.`);
      setIsAddingDevice(false);
      return;
    }

    // تجهيز playstationRates كأرقام والتحقق من صحتها
    const playstationRates: { [key: number]: number } = {};
    for (let i = 1; i <= 4; i++) {
      const rate = parseFloat(newDevice.playstationRates[i as keyof typeof newDevice.playstationRates]);
      if (isNaN(rate) || rate < 0) {
        setAddDeviceError(`سعر الساعة للدراعات (${i}) يجب أن يكون رقم موجب`);
        setIsAddingDevice(false);
        return;
      }
      playstationRates[i] = rate;
    }

    const deviceData = {
      name: newDevice.name,
      number: deviceNumber,
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
        setNewDevice({ name: '', number: '', controllers: 2, playstationRates: { 1: '20', 2: '20', 3: '25', 4: '30' } });
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

  // دالة تعديل وقت بدء الجلسة
  const handleEditStartTime = async () => {
    if (!selectedSessionForEditTime || !newStartTime) {
      showNotification('يرجى تحديد الوقت الجديد', 'error');
      return;
    }

    try {
      setIsUpdatingStartTime(true);
      
      // تحويل الوقت المدخل من datetime-local بشكل صحيح
      // datetime-local يعطي الوقت المحلي، نحتاج لمعاملته كوقت محلي مصري
      const localDateTime = dayjs(newStartTime);
      
      const currentTime = dayjs();
      
      // التحقق من أن الوقت الجديد ليس في المستقبل (مقارنة بالتوقيت المحلي)
      if (localDateTime.isAfter(currentTime)) {
        showNotification('لا يمكن تعديل وقت البدء إلى وقت في المستقبل', 'error');
        return;
      }

      // التحقق من أن الوقت الجديد معقول (ليس أكثر من 24 ساعة في الماضي)
      const twentyFourHoursAgo = currentTime.subtract(24, 'hour');
      if (localDateTime.isBefore(twentyFourHoursAgo)) {
        showNotification('لا يمكن تعديل وقت البدء إلى أكثر من ٢٤ ساعة في الماضي', 'error');
        return;
      }

      // إنشاء Date object من القيم المحلية مباشرة لتجنب تحويل المنطقة الزمنية
      const year = localDateTime.year();
      const month = localDateTime.month(); // dayjs months are 0-indexed
      const day = localDateTime.date();
      const hour = localDateTime.hour();
      const minute = localDateTime.minute();
      
      // إنشاء Date object بالتوقيت المحلي
      const localDate = new Date(year, month, day, hour, minute);
      
      // إرسال طلب تعديل وقت البدء للخادم
      await api.updateSessionStartTime(selectedSessionForEditTime.id, {
        startTime: localDate.toISOString()
      });

      // تحديث البيانات
      await fetchSessions();
      await fetchBills();

      showNotification('✅ تم تعديل وقت بدء الجلسة بنجاح', 'success');
      
      // إغلاق النافذة وتنظيف البيانات
      setShowEditStartTimeModal(false);
      setSelectedSessionForEditTime(null);
      setNewStartTime('');

    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'حدث خطأ أثناء تعديل وقت البدء';
      showNotification(`❌ ${errorMessage}`, 'error');
    } finally {
      setIsUpdatingStartTime(false);
    }
  };

  // دالة فتح نافذة تعديل وقت البدء
  const openEditStartTimeModal = (session: Session) => {
    setSelectedSessionForEditTime(session);
    
    // تحويل وقت بدء الجلسة من UTC إلى التوقيت المحلي للعرض
    // session.startTime مخزن بـ UTC، نحتاج لتحويله للتوقيت المحلي
    const utcStartTime = new Date(session.startTime);
    
    // تحويل إلى التوقيت المحلي وتنسيقه للـ datetime-local input
    const year = utcStartTime.getFullYear();
    const month = String(utcStartTime.getMonth() + 1).padStart(2, '0');
    const day = String(utcStartTime.getDate()).padStart(2, '0');
    const hours = String(utcStartTime.getHours()).padStart(2, '0');
    const minutes = String(utcStartTime.getMinutes()).padStart(2, '0');
    
    const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    setNewStartTime(formattedTime);
    
    setShowEditStartTimeModal(true);
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
        showNotification(`✅ تم تحديث عدد الأذرع إلى ${toArabicNumbers(String(newCount))}`, 'success');
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

  // ربط الجلسة بطاولة أو تغيير طاولة الجلسة
  const handleLinkTableToSession = async (session: Session, tableId: string | null) => {
    // التحقق من وجود tableId
    if (!tableId) {
      showNotification('⚠️ يرجى اختيار طاولة', 'warning');
      return;
    }

    // تحديد ما إذا كانت الجلسة مرتبطة بطاولة حالياً
    const bill = typeof session.bill === 'object' ? session.bill : null;
    const isCurrentlyLinkedToTable = bill ? !!(bill as any)?.table : false;

    try {
      setLinkingTable(true);
      
      let result;
      
      if (isCurrentlyLinkedToTable) {
        // الجلسة مرتبطة بطاولة حالياً - استخدام API تغيير الطاولة
        result = await api.changeSessionTable(session._id || session.id, tableId);
      } else {
        // الجلسة غير مرتبطة بطاولة - استخدام API الربط العادي
        result = await api.linkSessionToTable(session._id || session.id, tableId);
      }
      
      if (result && result.success) {
        // Get table number for notification
        const tableDoc = tables.find(t => t._id === tableId);
        const tableNumber = tableDoc?.number;
        
        let message;
        
        if (isCurrentlyLinkedToTable && result.data && 'oldTable' in result.data && 'newTable' in result.data) {
          // رسالة تغيير الطاولة
          const changeData = result.data as any;
          message = `✅ تم نقل الجلسة من طاولة ${toArabicNumbers(String(changeData.oldTable))} إلى طاولة ${toArabicNumbers(String(changeData.newTable))} بنجاح`;
        } else {
          // رسالة الربط العادي
          const billData = result.data?.bill;
          message = `✅ تم ربط الجلسة بالطاولة ${toArabicNumbers(String(tableNumber))} بنجاح`;
          
          if (billData && billData.sessionsCount > 1) {
            message += ` (تم دمج الفواتير - ${toArabicNumbers(String(billData.sessionsCount))} جلسات)`;
          }
        }
        
        showNotification(message, 'success');
        
        // تحديث البيانات
        await Promise.all([fetchBills(), loadDevices(), fetchSessions()]);
        setShowLinkTableModal(false);
        setSelectedSessionForLink(null);
      } else {
        const errorMessage = result.message || (isCurrentlyLinkedToTable ? '❌ فشل في تغيير طاولة الجلسة' : '❌ فشل في ربط الجلسة بالطاولة');
        showNotification(errorMessage, 'error');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      const actionText = isCurrentlyLinkedToTable ? 'تغيير طاولة الجلسة' : 'ربط الجلسة بالطاولة';
      showNotification(`❌ خطأ في ${actionText}: ${errorMsg}`, 'error');
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
          `✅ تم فك ربط الجلسة من الطاولة ${toArabicNumbers(String(tableNumber))} بنجاح`,
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
      {/* Header - محسّن وأنيق */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 rounded-2xl shadow-xl p-6 border-2 border-blue-200 dark:border-blue-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-lg">
              <Gamepad2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                إدارة أجهزة البلايستيشن
              </h1>
              <p className="text-sm md:text-base text-blue-100 mt-1">
                متابعة وإدارة جلسات البلايستيشن
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowAddDevice(true)}
                className="bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 px-6 py-3 rounded-xl flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-bold"
              >
                <Plus className="h-5 w-5 ml-2" />
                إضافة جهاز
              </button>
            )}
            
            <button
              onClick={async () => {
                try {
                  const result = await api.cleanupDuplicateSessionReferences();
                  if (result.success) {
                    showNotification(`✅ تم تنظيف ${result.data?.cleanedCount || 0} مرجع مكرر`, 'success');
                    // تحديث البيانات بعد التنظيف
                    await Promise.all([fetchSessions(), fetchBills()]);
                  } else {
                    showNotification('❌ فشل في تنظيف البيانات', 'error');
                  }
                } catch (error) {
                  console.error('خطأ في تنظيف البيانات:', error);
                  showNotification('❌ خطأ في تنظيف البيانات', 'error');
                }
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-bold text-sm"
              title="تنظيف البيانات المكررة - إصلاح الجلسات الموجودة في عدة فواتير"
            >
              🧹 تنظيف
            </button>
          </div>
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


      {/* Devices Grid - محسّن وأنيق */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {devices.filter(d => d.type === 'playstation').map((device) => {
          const activeSession = sessions.find(s => s.deviceNumber === device.number && s.status === 'active');
          const isActive = device.status === 'active';
          
          return (
            <div key={device.id} className={`
              rounded-2xl shadow-lg border-2 p-6 flex flex-col h-full transition-all duration-300 transform hover:scale-105 hover:shadow-2xl
              ${isActive 
                ? 'bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-green-900/40 dark:via-emerald-900/30 dark:to-green-800/30 border-green-400 dark:border-green-700 hover:shadow-green-300 dark:hover:shadow-green-900/70' 
                : 'bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 dark:from-gray-800 dark:via-slate-800 dark:to-gray-900 border-gray-300 dark:border-gray-700 hover:shadow-gray-300 dark:hover:shadow-gray-900/70'
              }
            `}>
              {/* Status Badge */}
              <div className="absolute -top-2 -right-2">
                {isActive ? (
                  <span className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full animate-pulse shadow-lg border-4 border-white dark:border-gray-800">
                    نشط
                  </span>
                ) : (
                  <span className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-500 to-slate-500 text-white text-xs font-bold rounded-full shadow-lg border-4 border-white dark:border-gray-800">
                    متاح
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between mb-4 pt-4">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center shadow-md
                    ${isActive 
                      ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
                      : 'bg-gradient-to-br from-gray-400 to-slate-500'
                    }
                  `}>
                    <Gamepad2 className="h-6 w-6 text-white" />
                  </div>
                  {device.name}
                </h3>
              </div>

                  <div className="flex-1">
              {activeSession ? (
                <div className="space-y-4">
                  {/* Real-time cost display */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 p-4 rounded-xl border-2 border-green-300 dark:border-green-700 shadow-sm">
                    <SessionCostDisplay session={activeSession} device={device} />
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-100">{toArabicNumbers(String(activeSession.controllers ?? 1))} دراع</span>
                  </div>
                  
                  {/* عرض حالة ربط الطاولة فقط (بدون أزرار) */}
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
                      <div className="flex items-center text-sm justify-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                        {billTableNumber ? (
                          <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                            <TableIcon className="h-4 w-4 ml-1" />
                            مرتبطة بطاولة: {toArabicNumbers(String(billTableNumber))}
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-500 dark:text-gray-400">
                            <TableIcon className="h-4 w-4 ml-1" />
                            غير مرتبطة بطاولة
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {/* أزرار تعديل عدد الأذرعة */}
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 p-4 rounded-xl border-2 border-orange-300 dark:border-orange-700">
                    <p className="text-xs font-bold text-orange-900 dark:text-orange-100 mb-3 text-center">تعديل عدد الأذرع</p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                        disabled={(activeSession.controllers ?? 1) <= 1 || updatingControllers[activeSession.id]}
                        onClick={() => {
                          const oldCount = activeSession.controllers ?? 1;
                          const newCount = oldCount - 1;
                          handleUpdateControllersClick(activeSession.id, newCount, oldCount, device.name);
                        }}
                        title="تقليل عدد الأذرع"
                      >
                        {updatingControllers[activeSession.id] ? (
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span className="text-xl">-</span>
                        )}
                      </button>
                      <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-sm min-w-[80px]">
                        <span className="font-bold text-xl text-orange-600 dark:text-orange-400 block text-center">
                          {toArabicNumbers(String(activeSession.controllers ?? 1))}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 block text-center">دراع</span>
                      </div>
                      <button
                        className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                        disabled={(activeSession.controllers ?? 1) >= 4 || updatingControllers[activeSession.id]}
                        onClick={() => {
                          const oldCount = activeSession.controllers ?? 1;
                          const newCount = oldCount + 1;
                          handleUpdateControllersClick(activeSession.id, newCount, oldCount, device.name);
                        }}
                        title="زيادة عدد الأذرع"
                      >
                        {updatingControllers[activeSession.id] ? (
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span className="text-xl">+</span>
                        )}
                      </button>
                    </div>
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
                  <div className="mt-4 space-y-2">
                    {activeSession ? (
                      <>
                        {/* أزرار إضافية للجلسة النشطة */}
                        {(() => {
                          const bill = typeof activeSession.bill === 'object' ? activeSession.bill : null;
                          const isLinkedToTable = bill ? !!(bill as any)?.table : false;
                          
                          return isLinkedToTable ? (
                            // إذا كانت مرتبطة بطاولة: زر تعديل الوقت + زر تغيير الطاولة + زر فك الربط
                            <>
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                {/* زر تعديل وقت البدء */}
                                <button
                                  onClick={() => openEditStartTimeModal(activeSession)}
                                  className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-1"
                                >
                                  <Edit className="h-4 w-4" />
                                  تعديل الوقت
                                </button>

                                {/* زر تغيير الطاولة */}
                                <button
                                  onClick={() => {
                                    setSelectedSessionForLink(activeSession);
                                    setShowLinkTableModal(true);
                                  }}
                                  className="px-3 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-1"
                                >
                                  <TableIcon className="h-4 w-4" />
                                  تغيير الطاولة
                                </button>
                              </div>
                              
                              {/* زر فك الربط */}
                              <div className="mb-2">
                                <button
                                  onClick={() => {
                                    setSelectedSessionForUnlink(activeSession);
                                    setCustomerNameForUnlink(activeSession.customerName || '');
                                    setShowUnlinkTableModal(true);
                                  }}
                                  className="w-full px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-1"
                                >
                                  <X className="h-4 w-4" />
                                  فك ربط الطاولة
                                </button>
                              </div>
                            </>
                          ) : (
                            // إذا لم تكن مرتبطة بطاولة: زر تعديل الوقت + زر ربط طاولة
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              {/* زر تعديل وقت البدء */}
                              <button
                                onClick={() => openEditStartTimeModal(activeSession)}
                                className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-1"
                              >
                                <Edit className="h-4 w-4" />
                                تعديل الوقت
                              </button>

                              {/* زر ربط طاولة */}
                              <button
                                onClick={() => {
                                  setSelectedSessionForLink(activeSession);
                                  setShowLinkTableModal(true);
                                }}
                                className="px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-1"
                              >
                                <TableIcon className="h-4 w-4" />
                                ربط طاولة
                              </button>
                            </div>
                          );
                        })()}

                        {/* زر إنهاء الجلسة */}
                        <button
                          onClick={() => handleEndSession(activeSession.id)}
                          disabled={endingSessions[activeSession.id]}
                          className={`w-full ${endingSessions[activeSession.id] ? 'bg-red-700 dark:bg-red-800' : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700'} text-white py-3 px-4 rounded-xl flex items-center justify-center transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105`}
                        >
                          {endingSessions[activeSession.id] ? (
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
                      </>
                    ) : device.status === 'available' ? (
                    <button
                      onClick={() => openSessionModal(device)}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 px-4 rounded-xl flex items-center justify-center transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <Play className="h-5 w-5 ml-2" />
                      بدء الجلسة
                    </button>
                  ) : (
                      <div className="w-full py-3 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-center text-sm font-semibold">
                        غير متاح
                </div>
              )}
                  </div>

              {/* أزرار التعديل والحذف - للمدير فقط */}
              {user?.role === 'admin' && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleEditDevice(device)}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    تعديل
                  </button>
                  <button
                    onClick={() => handleDeleteDevice(device)}
                    disabled={isActive}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-2 ${
                      isActive 
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white'
                    }`}
                    title={isActive ? 'لا يمكن حذف جهاز نشط' : 'حذف الجهاز'}
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>


        </>
      )}

      {/* نافذة بدء جلسة جديدة - محسّنة وأنيقة */}
      {showNewSession && selectedDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border-2 border-green-200 dark:border-green-800 animate-bounce-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Play className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  بدء جلسة جديدة
                </h2>
              </div>
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
                className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-lg transition-all duration-200 flex items-center justify-center text-white hover:scale-110 transform shadow-md"
                disabled={loadingSession}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <Gamepad2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">الجهاز المختار</p>
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{selectedDevice.name}</p>
                </div>
              </div>
            </div>
            {/* ربط بطاولة (اختياري) */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <TableIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                ربط بطاولة (اختياري)
              </label>
              <select
                value={selectedTable || ''}
                onChange={(e) => setSelectedTable(e.target.value || null)}
                className="w-full px-4 py-3 border-2 border-purple-300 dark:border-purple-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100 transition-all shadow-sm hover:shadow-md"
              >
                <option value="">بدون طاولة</option>
                {tables.filter((t: any) => t.isActive).sort((a: any, b: any) => {
                  return String(a.number).localeCompare(String(b.number), 'ar', { numeric: true });
                }).map((table: any) => (
                  <option key={table.id || table._id} value={table._id}>
                    🪑 طاولة {table.number}
                  </option>
                ))}
              </select>
            </div>
            
            {/* عدد الدراعات */}
            <div className="mb-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-xl border-2 border-green-200 dark:border-green-800">
              <label className="block text-sm font-bold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                <Users className="h-5 w-5" />
                عدد الدراعات <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSelectedControllers(num)}
                    disabled={loadingSession}
                    className={`p-4 rounded-xl border-2 text-center transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg ${
                      selectedControllers === num 
                        ? 'bg-gradient-to-br from-green-500 to-emerald-500 border-green-600 text-white ring-4 ring-green-300 dark:ring-green-700 scale-105' 
                        : 'bg-white dark:bg-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-500 text-gray-900 dark:text-gray-100 border-green-300 dark:border-green-600'
                    } ${loadingSession ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Users className={`h-6 w-6 mx-auto mb-2 ${selectedControllers === num ? 'text-white' : 'text-green-600 dark:text-green-400'}`} />
                    <span className="text-lg font-bold block">{toArabicNumbers(String(num))}</span>
                    <div className={`text-xs mt-1 font-semibold ${selectedControllers === num ? 'text-green-100' : 'text-gray-600 dark:text-gray-400'}`}>
                      {selectedDevice.playstationRates && selectedDevice.playstationRates[num] ? `${toArabicNumbers(String(selectedDevice.playstationRates[num]))} ج.م/س` : '-'}
                    </div>
                  </button>
                ))}
              </div>
              {!selectedControllers && (
                <p className="text-xs text-green-700 dark:text-green-300 mt-3 text-center font-semibold">
                  ⬆️ يرجى اختيار عدد الأذرع لبدء الجلسة
                </p>
              )}
            </div>
            {sessionError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{sessionError}</p>
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
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
                className="w-full sm:w-auto px-6 py-3 bg-gray-200 dark:bg-gray-600 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-all duration-200 font-bold shadow-md hover:shadow-lg transform hover:scale-105"
                disabled={loadingSession}
              >
                إلغاء
              </button>
              <button 
                type="button" 
                onClick={handleStartSession} 
                className={`w-full sm:w-auto px-8 py-3 rounded-xl flex items-center justify-center min-w-[160px] transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  !selectedControllers || loadingSession
                    ? 'bg-green-400 dark:bg-green-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
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

      {/* نافذة ربط الجلسة بطاولة - محسّنة وأنيقة */}
      {showLinkTableModal && selectedSessionForLink && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border-2 border-purple-200 dark:border-purple-800 animate-bounce-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <TableIcon className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {(() => {
                    const bill = typeof selectedSessionForLink.bill === 'object' ? selectedSessionForLink.bill : null;
                    const isCurrentlyLinkedToTable = bill ? !!(bill as any)?.table : false;
                    return isCurrentlyLinkedToTable ? 'تغيير طاولة الجلسة' : 'ربط الجلسة بطاولة';
                  })()}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowLinkTableModal(false);
                  setSelectedSessionForLink(null);
                }}
                className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-lg transition-all duration-200 flex items-center justify-center text-white hover:scale-110 transform shadow-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4 space-y-3">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">الجهاز</p>
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
                      {devices.find(d => d.number === selectedSessionForLink.deviceNumber)?.name || selectedSessionForLink.deviceName}
                    </p>
                  </div>
                </div>
              </div>
              
              {selectedSessionForLink.bill && (
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-700 rounded-xl">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="text-xs text-green-600 dark:text-green-400 font-semibold">الفاتورة</p>
                      <p className="text-sm font-bold text-green-900 dark:text-green-100">
                        #{typeof selectedSessionForLink.bill === 'object' ? (selectedSessionForLink.bill as any)?.billNumber : 'غير معروف'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-bold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                <TableIcon className="h-5 w-5" />
                اختر الطاولة
              </label>
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
                className="w-full px-4 py-3 border-2 border-purple-300 dark:border-purple-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100 transition-all shadow-sm hover:shadow-md font-medium"
                disabled={linkingTable}
              >
                <option value="">بدون طاولة</option>
                {tables.filter((t: any) => t.isActive).sort((a: any, b: any) => {
                  return String(a.number).localeCompare(String(b.number), 'ar', { numeric: true });
                }).map((table: any) => (
                  <option key={table.id || table._id} value={table._id}>
                    🪑 طاولة {table.number}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowLinkTableModal(false);
                  setSelectedSessionForLink(null);
                }}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-600 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-all duration-200 font-bold shadow-md hover:shadow-lg transform hover:scale-105"
                disabled={linkingTable}
              >
                إغلاق
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
                عدد الأذرع: {toArabicNumbers(String(selectedSessionForEnd.controllers ?? 1))}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                بدأت: {toArabicNumbers(dayjs(selectedSessionForEnd.startTime).utc().add(2, 'hour').format('hh:mm A')).replace('AM', 'ص').replace('PM', 'م')}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border-2 border-orange-200 dark:border-orange-800 animate-bounce-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">تأكيد تعديل عدد الأذرع</h2>
              </div>
              <button
                onClick={() => {
                  setShowControllersConfirm(false);
                  setControllersChangeData(null);
                }}
                className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-lg transition-all duration-200 flex items-center justify-center text-white hover:scale-110 transform shadow-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6 space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-5 shadow-sm">
                <p className="text-blue-900 dark:text-blue-100 font-bold mb-3 flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  تفاصيل التعديل
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400">الجهاز</span>
                    <span className="font-bold text-blue-900 dark:text-blue-100">{controllersChangeData.deviceName}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400">العدد الحالي</span>
                    <span className="font-bold text-red-600 dark:text-red-400">{toArabicNumbers(String(controllersChangeData.oldCount))} دراع</span>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400">العدد الجديد</span>
                    <span className="font-bold text-green-600 dark:text-green-400">{toArabicNumbers(String(controllersChangeData.newCount))} دراع</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-4 shadow-sm">
                <p className="text-sm text-yellow-900 dark:text-yellow-100 font-semibold flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  سيتم إعادة حساب التكلفة بناءً على العدد الجديد من الأذرع
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowControllersConfirm(false);
                  setControllersChangeData(null);
                }}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-600 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-all duration-200 font-bold shadow-md hover:shadow-lg transform hover:scale-105"
              >
                إلغاء
              </button>
              <button
                onClick={confirmUpdateControllers}
                className="px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl flex items-center transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Users className="h-5 w-5 ml-2" />
                تأكيد التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة جهاز جديد */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <form onSubmit={handleAddDevice} className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border-2 border-blue-200 dark:border-blue-800 animate-bounce-in">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                <Gamepad2 className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">إضافة جهاز بلايستيشن جديد</h2>
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">اسم الجهاز</label>
              <input type="text" value={newDevice.name} onChange={e => setNewDevice({ ...newDevice, name: e.target.value })} className="w-full border-2 border-blue-300 dark:border-blue-700 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" required placeholder="مثال: بلايستيشن 1" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">رقم الجهاز</label>
              <input type="number" value={newDevice.number} onChange={e => setNewDevice({ ...newDevice, number: e.target.value })} className="w-full border-2 border-blue-300 dark:border-blue-700 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" required min="1" placeholder="1" />
            </div>
            <div className="mb-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800">
              <label className="block text-sm font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                <Users className="h-5 w-5" />
                سعر الساعة لكل عدد دراعات
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">دراع واحد</span>
                  <input type="number" value={newDevice.playstationRates[1]} onChange={e => setNewDevice({ ...newDevice, playstationRates: { ...newDevice.playstationRates, 1: e.target.value } })} className="w-full border-2 border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-all" required min="0" step="0.01" />
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">درعين</span>
                  <input type="number" value={newDevice.playstationRates[2]} onChange={e => setNewDevice({ ...newDevice, playstationRates: { ...newDevice.playstationRates, 2: e.target.value } })} className="w-full border-2 border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-all" required min="0" step="0.01" />
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">٣ دراعات</span>
                  <input type="number" value={newDevice.playstationRates[3]} onChange={e => setNewDevice({ ...newDevice, playstationRates: { ...newDevice.playstationRates, 3: e.target.value } })} className="w-full border-2 border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-all" required min="0" step="0.01" />
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">٤ دراعات</span>
                  <input type="number" value={newDevice.playstationRates[4]} onChange={e => setNewDevice({ ...newDevice, playstationRates: { ...newDevice.playstationRates, 4: e.target.value } })} className="w-full border-2 border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-all" required min="0" step="0.01" />
                </div>
              </div>
            </div>
            {addDeviceError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{addDeviceError}</p>
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
              <button 
                type="button" 
                onClick={() => {
                  if (!isAddingDevice) {
                    setShowAddDevice(false);
                    setAddDeviceError(null);
                  }
                }} 
                className="w-full sm:w-auto px-6 py-3 bg-gray-200 dark:bg-gray-600 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-all duration-200 font-bold shadow-md hover:shadow-lg transform hover:scale-105"
                disabled={isAddingDevice}
              >
                إلغاء
              </button>
              <button 
                type="submit" 
                className={`w-full sm:w-auto px-8 py-3 rounded-xl flex items-center justify-center min-w-[140px] transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  isAddingDevice
                    ? 'bg-blue-400 dark:bg-blue-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
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

      {/* نافذة تعديل الجهاز */}
      {showEditDevice && editingDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!editingDevice) return;
            
            try {
              // التحقق من صحة البيانات
              const deviceNumber = parseInt(editingDevice.number);
              if (isNaN(deviceNumber) || deviceNumber <= 0) {
                showNotification('رقم الجهاز يجب أن يكون رقم صحيح أكبر من 0', 'error');
                return;
              }

              // تجهيز playstationRates كأرقام والتحقق من صحتها
              const playstationRates: { [key: number]: number } = {};
              for (let i = 1; i <= 4; i++) {
                const rate = parseFloat(editingDevice.playstationRates[i as keyof typeof editingDevice.playstationRates]);
                if (isNaN(rate) || rate < 0) {
                  showNotification(`سعر الساعة للدراعات (${i}) يجب أن يكون رقم موجب`, 'error');
                  return;
                }
                playstationRates[i] = rate;
              }

              const updateData = {
                name: editingDevice.name,
                number: deviceNumber,
                type: 'playstation',
                controllers: editingDevice.controllers || 2,
                playstationRates
              };

              const updatedDevice = await updateDevice(editingDevice.id, updateData);
              if (updatedDevice) {
                setShowEditDevice(false);
                setEditingDevice(null);
                // تحديث قائمة الأجهزة
                await loadDevices();
              }
            } catch (error) {
              showNotification('حدث خطأ أثناء تعديل الجهاز', 'error');
            }
          }} className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border-2 border-orange-200 dark:border-orange-800 animate-bounce-in">
            
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                <Edit className="h-8 w-8 text-white" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-gray-100">تعديل الجهاز</h2>
            
            {/* نفس حقول إضافة الجهاز ولكن مع القيم الحالية */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">اسم الجهاز</label>
              <input 
                type="text" 
                value={editingDevice.name} 
                onChange={e => setEditingDevice({ ...editingDevice, name: e.target.value })} 
                className="w-full border-2 border-orange-300 dark:border-orange-700 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all" 
                required 
                placeholder="مثال: بلايستيشن 1" 
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">رقم الجهاز</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={editingDevice.number} 
                  onChange={e => setEditingDevice({ ...editingDevice, number: e.target.value })} 
                  className="flex-1 border-2 border-orange-300 dark:border-orange-700 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all" 
                  required 
                  min="1" 
                  placeholder="1" 
                />
              </div>
            </div>

            <div className="mb-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-4 rounded-xl border-2 border-orange-200 dark:border-orange-800">
              <h3 className="text-lg font-bold text-center mb-4 text-orange-900 dark:text-orange-100">أسعار الساعة (جنيه مصري)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">دراع واحد</span>
                  <input 
                    type="number" 
                    value={editingDevice.playstationRates[1]} 
                    onChange={e => setEditingDevice({ ...editingDevice, playstationRates: { ...editingDevice.playstationRates, 1: e.target.value } })} 
                    className="w-full border-2 border-orange-300 dark:border-orange-700 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 transition-all" 
                    required 
                    min="0" 
                    step="0.01" 
                  />
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">درعين</span>
                  <input 
                    type="number" 
                    value={editingDevice.playstationRates[2]} 
                    onChange={e => setEditingDevice({ ...editingDevice, playstationRates: { ...editingDevice.playstationRates, 2: e.target.value } })} 
                    className="w-full border-2 border-orange-300 dark:border-orange-700 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 transition-all" 
                    required 
                    min="0" 
                    step="0.01" 
                  />
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">٣ دراعات</span>
                  <input 
                    type="number" 
                    value={editingDevice.playstationRates[3]} 
                    onChange={e => setEditingDevice({ ...editingDevice, playstationRates: { ...editingDevice.playstationRates, 3: e.target.value } })} 
                    className="w-full border-2 border-orange-300 dark:border-orange-700 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 transition-all" 
                    required 
                    min="0" 
                    step="0.01" 
                  />
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">٤ دراعات</span>
                  <input 
                    type="number" 
                    value={editingDevice.playstationRates[4]} 
                    onChange={e => setEditingDevice({ ...editingDevice, playstationRates: { ...editingDevice.playstationRates, 4: e.target.value } })} 
                    className="w-full border-2 border-orange-300 dark:border-orange-700 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 transition-all" 
                    required 
                    min="0" 
                    step="0.01" 
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                type="button" 
                onClick={() => {
                  setShowEditDevice(false);
                  setEditingDevice(null);
                }}
                className="w-full sm:w-auto px-6 py-3 bg-gray-200 dark:bg-gray-600 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors duration-200 font-bold"
              >
                إلغاء
              </button>
              <button 
                type="submit" 
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Edit className="h-5 w-5 ml-2 inline" />
                حفظ التعديلات
              </button>
            </div>
          </form>
        </div>
      )}

      {/* نافذة تأكيد الحذف */}
      {showDeleteConfirm && deviceToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border-2 border-red-200 dark:border-red-800 animate-bounce-in">
            
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                <Trash2 className="h-8 w-8 text-white" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-center mb-4 text-gray-900 dark:text-gray-100">تأكيد حذف الجهاز</h2>
            
            <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-xl border border-red-200 dark:border-red-700 mb-6">
              <p className="text-center text-gray-700 dark:text-gray-300 mb-2">
                هل أنت متأكد من حذف الجهاز؟
              </p>
              <p className="text-center font-bold text-red-600 dark:text-red-400">
                {deviceToDelete.name} - رقم {typeof deviceToDelete.number === 'string' ? deviceToDelete.number.replace(/[^0-9]/g, '') : deviceToDelete.number}
              </p>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                <strong>تحذير:</strong> هذا الإجراء لا يمكن التراجع عنه
              </p>
              <p className="text-center text-xs text-blue-600 dark:text-blue-400 mt-2 bg-blue-50 dark:bg-blue-900/30 p-2 rounded">
                ملاحظة: يمكن استخدام نفس الرقم في منشآت أخرى
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                type="button" 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeviceToDelete(null);
                }}
                disabled={isDeletingDevice}
                className="w-full sm:w-auto px-6 py-3 bg-gray-200 dark:bg-gray-600 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors duration-200 font-bold disabled:opacity-50"
              >
                إلغاء
              </button>
              <button 
                type="button" 
                onClick={confirmDeleteDevice}
                disabled={isDeletingDevice}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center justify-center"
              >
                {isDeletingDevice ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-5 w-5 ml-2" />
                    تأكيد الحذف
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل وقت بدء الجلسة */}
      {showEditStartTimeModal && selectedSessionForEditTime && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <Edit className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  تعديل وقت بدء الجلسة
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowEditStartTimeModal(false);
                  setSelectedSessionForEditTime(null);
                  setNewStartTime('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors duration-200"
                disabled={isUpdatingStartTime}
              >
                <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* معلومات الجلسة */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">معلومات الجلسة:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">الجهاز:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{selectedSessionForEditTime.deviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">الوقت الحالي:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatTimeInArabic(dayjs(selectedSessionForEditTime.startTime).utc().add(2, 'hour'))}
                  </span>
                </div>
              </div>
            </div>

            {/* حقل تعديل الوقت */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                الوقت الجديد لبدء الجلسة:
              </label>
              <input
                type="datetime-local"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all duration-200"
                disabled={isUpdatingStartTime}
              />
              {/* عرض الوقت بالعربية */}
              {newStartTime && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                    📅 الوقت المحدد: {formatDateTimeLocalToArabic(newStartTime)}
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                ⚠️ لا يمكن تعديل الوقت إلى المستقبل أو أكثر من ٢٤ ساعة في الماضي
              </p>
            </div>

            {/* الأزرار */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditStartTimeModal(false);
                  setSelectedSessionForEditTime(null);
                  setNewStartTime('');
                }}
                className="w-full sm:w-auto px-6 py-3 bg-gray-200 dark:bg-gray-600 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-all duration-200 font-medium"
                disabled={isUpdatingStartTime}
              >
                إلغاء
              </button>
              <button
                onClick={handleEditStartTime}
                className={`w-full sm:w-auto px-8 py-3 rounded-xl flex items-center justify-center min-w-[160px] transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  !newStartTime || isUpdatingStartTime
                    ? 'bg-blue-400 dark:bg-blue-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                } text-white`}
                disabled={!newStartTime || isUpdatingStartTime}
              >
                {isUpdatingStartTime ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري التحديث...
                  </>
                ) : (
                  <>
                    <Edit className="h-5 w-5 ml-2" />
                    تحديث الوقت
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayStation;
