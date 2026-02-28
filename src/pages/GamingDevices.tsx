import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Monitor, Play, Square, Users, Plus, Table as TableIcon, X, Edit, Trash2, Clock } from 'lucide-react';
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

interface GamingDevicesProps {
  deviceType: 'playstation' | 'computer';
}

const GamingDevices: React.FC<GamingDevicesProps> = ({ deviceType }) => {
  const location = useLocation();
  const { sessions, createSession, endSession, user, createDevice, updateDevice, deleteDevice, fetchBills, showNotification, tables, fetchTables, fetchTableSections, fetchSessions } = useApp();
  
  // Configuration based on device type
  const config = {
    playstation: {
      icon: Gamepad2,
      title: 'إدارة أجهزة البلايستيشن',
      subtitle: 'متابعة وإدارة جلسات البلايستيشن',
      colors: {
        primary: 'from-blue-600 to-indigo-600',
        primaryDark: 'from-blue-700 to-indigo-700',
        card: 'from-blue-50 via-indigo-50 to-blue-100',
        cardDark: 'from-blue-900/40 via-indigo-900/30 to-blue-800/30',
        border: 'border-blue-400 dark:border-blue-700',
        headerBorder: 'border-blue-200 dark:border-blue-800',
      },
      defaultRate: { 1: '20', 2: '20', 3: '25', 4: '30' },
      hasControllers: true,
    },
    computer: {
      icon: Monitor,
      title: 'إدارة أجهزة الكمبيوتر',
      subtitle: 'متابعة وإدارة جلسات الكمبيوتر',
      colors: {
        primary: 'from-orange-600 to-red-600',
        primaryDark: 'from-orange-700 to-red-700',
        card: 'from-orange-50 via-red-50 to-orange-100',
        cardDark: 'from-orange-900/40 via-red-900/30 to-orange-800/30',
        border: 'border-orange-400 dark:border-orange-700',
        headerBorder: 'border-orange-200 dark:border-orange-800',
      },
      defaultRate: 15,
      hasControllers: false,
    },
  }[deviceType];

  const Icon = config.icon;

  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDevice, setNewDevice] = useState<any>(
    deviceType === 'playstation'
      ? { name: '', number: '', controllers: 2, playstationRates: config.defaultRate }
      : { name: '', number: '', hourlyRate: String(config.defaultRate) }
  );
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

  // نافذة تعديل وقت بدء الجلسة
  const [showEditStartTimeModal, setShowEditStartTimeModal] = useState(false);
  const [selectedSessionForEditTime, setSelectedSessionForEditTime] = useState<Session | null>(null);
  const [newStartTime, setNewStartTime] = useState('');
  const [isUpdatingStartTime, setIsUpdatingStartTime] = useState(false);

  // نافذة تعديل وقت فترة الدراعات
  const [showEditPeriodTimeModal, setShowEditPeriodTimeModal] = useState(false);
  const [selectedSessionForPeriodEdit, setSelectedSessionForPeriodEdit] = useState<Session | null>(null);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number>(0);
  const [newPeriodStartTime, setNewPeriodStartTime] = useState('');
  const [newPeriodEndTime, setNewPeriodEndTime] = useState('');
  const [isUpdatingPeriodTime, setIsUpdatingPeriodTime] = useState(false);

  // نافذة تأكيد تعديل عدد الأذرع
  const [showControllersConfirm, setShowControllersConfirm] = useState(false);
  const [controllersChangeData, setControllersChangeData] = useState<{sessionId: string, newCount: number, oldCount: number, deviceName: string} | null>(null);

  // Loading states
  const [isInitialLoading, setIsInitialLoading] = useState(sessions.length === 0);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // إضافة أجهزة
  const [devices, setDevices] = useState<Device[]>([]);
  
  // Track if we've loaded data for this page visit
  const hasLoadedRef = useRef(false);
  const lastPathRef = useRef(location.pathname);

  // تحميل الأجهزة
  const loadDevices = async () => {
    try {
      const response = await api.getDevices({ type: deviceType });
      if (response.success && response.data) {
        setDevices(response.data);
      }
    } catch {
      showNotification('خطأ في تحميل الأجهزة', 'error');
    }
  };

  // Reset loaded flag when navigating away
  useEffect(() => {
    const currentPath = deviceType === 'playstation' ? '/playstation' : '/computer';
    if (location.pathname !== currentPath) {
      hasLoadedRef.current = false;
    }
  }, [location.pathname, deviceType]);

  // تحميل البيانات بشكل تدريجي
  useEffect(() => {
    let isMounted = true;
    
    const loadAllData = async () => {
      if (!isMounted) return;
      
      if (hasLoadedRef.current && lastPathRef.current === location.pathname) {
        return;
      }
      
      if (!user) {
        setIsInitialLoading(false);
        return;
      }
      
      hasLoadedRef.current = true;
      lastPathRef.current = location.pathname;
      
      try {
        setIsInitialLoading(true);
        setLoadingError(null);

        await Promise.all([
          loadDevices(),
          fetchSessions(),
        ]);

        setIsInitialLoading(false);

        Promise.all([
          fetchBills(),
          fetchTables(),
          fetchTableSections()
        ]).catch(() => {});

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'حدث خطأ في تحميل البيانات';
        setLoadingError(errorMessage);
        showNotification('فشل في تحميل البيانات. يرجى إعادة تحميل الصفحة.', 'error');
        setIsInitialLoading(false);
      }
    };

    loadAllData();
    
    return () => {
      isMounted = false;
    };
  }, [user, location.pathname, deviceType]);

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
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showNewSession, loadingSession, showLinkTableModal]);

  // دوال التعديل والحذف
  const handleEditDevice = (device: any) => {
    const activeSession = sessions.find(session => 
      session.deviceId === device._id && session.status === 'active'
    );
    
    if (activeSession) {
      showNotification('لا يمكن تعديل الجهاز أثناء وجود جلسة نشطة عليه', 'error');
      return;
    }
    
    if (deviceType === 'playstation') {
      setEditingDevice({
        ...device,
        number: typeof device.number === 'string' ? 
          device.number.replace(/[^0-9]/g, '') : device.number.toString(),
        playstationRates: device.playstationRates || config.defaultRate
      });
    } else {
      setEditingDevice({
        ...device,
        number: typeof device.number === 'string' ? 
          device.number.replace(/[^0-9]/g, '') : device.number.toString(),
        hourlyRate: device.hourlyRate || config.defaultRate
      });
    }
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

    const deviceNumber = parseInt(newDevice.number);
    if (isNaN(deviceNumber) || deviceNumber <= 0) {
      setAddDeviceError('رقم الجهاز يجب أن يكون رقم صحيح أكبر من 0');
      setIsAddingDevice(false);
      return;
    }

    const existingDevice = devices.find(d => {
      const existingNumber = typeof d.number === 'string' ? 
        parseInt((d.number as string).replace(/[^0-9]/g, '')) : d.number;
      return existingNumber === deviceNumber;
    });
    if (existingDevice) {
      setAddDeviceError(`رقم الجهاز ${toArabicNumbers(String(deviceNumber))} مستخدم بالفعل`);
      setIsAddingDevice(false);
      return;
    }

    let deviceData: any = {
      name: newDevice.name,
      number: deviceNumber,
      type: deviceType,
      status: 'available',
    };

    if (deviceType === 'playstation') {
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
      deviceData.controllers = newDevice.controllers;
      deviceData.playstationRates = playstationRates;
    } else {
      const hourlyRate = parseFloat(newDevice.hourlyRate);
      if (isNaN(hourlyRate) || hourlyRate < 0) {
        setAddDeviceError('سعر الساعة يجب أن يكون رقم موجب');
        setIsAddingDevice(false);
        return;
      }
      deviceData.hourlyRate = hourlyRate;
    }

    try {
      const device = await createDevice(deviceData);
      if (device) {
        setDevices(prevDevices => [...prevDevices, device]);
        setShowAddDevice(false);
        setNewDevice(
          deviceType === 'playstation'
            ? { name: '', number: '', controllers: 2, playstationRates: config.defaultRate }
            : { name: '', number: '', hourlyRate: String(config.defaultRate) }
        );
        showNotification('تمت إضافة الجهاز بنجاح', 'success');
      } else {
        setAddDeviceError('حدث خطأ أثناء إضافة الجهاز.');
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } }; message?: string };
      const errorMessage = apiError?.response?.data?.error || apiError?.message || 'حدث خطأ غير متوقع';
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

  const getPlayStationHourlyRate = (device: Device | null, controllers: number) => {
    if (!device || !device.playstationRates) return 0;
    return device.playstationRates[controllers] || 0;
  };

  const handleStartSession = async () => {
    try {
      setLoadingSession(true);
      setSessionError(null);
      
      if (!selectedDevice) {
        setLoadingSession(false);
        return;
      }

      if (deviceType === 'playstation' && !selectedControllers) {
        setLoadingSession(false);
        return;
      }

      const sessionData: any = {
        deviceId: selectedDevice._id,
        deviceType,
        deviceNumber: selectedDevice.number,
        deviceName: selectedDevice.name,
        customerName: `عميل (${selectedDevice.name})`,
      };

      if (deviceType === 'playstation') {
        sessionData.controllers = selectedControllers;
        sessionData.hourlyRate = getPlayStationHourlyRate(selectedDevice, selectedControllers!);
      } else {
        sessionData.hourlyRate = selectedDevice.hourlyRate || 15;
      }
      
      if (selectedTable) {
        sessionData.table = selectedTable;
      }
      
      const session = await createSession(sessionData);

      if (session && (session.id || session._id)) {
        try {
          // تحديث حالة الجهاز
          await api.updateDeviceStatus(selectedDevice.id, { status: 'active' });
          
          // تحديث جميع البيانات بالترتيب الصحيح
          await Promise.all([
            loadDevices(),
            fetchSessions(), // مهم جداً: تحديث الجلسات لإظهار الطاولة المرتبطة
            fetchBills(),
            fetchTables() // تحديث حالة الطاولات
          ]);
          
          showNotification(`✅ تم بدء الجلسة بنجاح`, 'success');
          
          setShowNewSession(false);
          setSelectedDevice(null);
          setSelectedControllers(null);
          setSessionError(null);
          setSelectedTable(null);
        } catch (updateError) {
          showNotification('تم بدء الجلسة ولكن حدث خطأ في تحديث حالة الجهاز', 'warning');
          setShowNewSession(false);
        }
      } else {
        setSessionError('حدث خطأ أثناء بدء الجلسة.');
        showNotification('حدث خطأ أثناء بدء الجلسة.', 'error');
      }
    } catch (err: unknown) {
      const apiError = err as { message?: string; response?: { data?: { message?: string, error?: string } } };
      const errorMessage = apiError?.response?.data?.error || apiError?.response?.data?.message || apiError?.message || 'حدث خطأ غير متوقع';
      
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('in use') || errorMessage.includes('مستخدم')) {
        userFriendlyMessage = '❌ الجهاز مستخدم حالياً. يرجى اختيار جهاز آخر.';
      } else if (errorMessage.includes('not found') || errorMessage.includes('غير موجود')) {
        userFriendlyMessage = '❌ الجهاز غير موجود. يرجى تحديث الصفحة والمحاولة مرة أخرى.';
      } else {
        userFriendlyMessage = `❌ ${errorMessage}`;
      }
      
      setSessionError(userFriendlyMessage);
      showNotification(userFriendlyMessage, 'error');
    } finally {
      setLoadingSession(false);
    }
  };

  // تعديل وقت بدء الجلسة
  const handleEditStartTime = async () => {
    if (!selectedSessionForEditTime || !newStartTime) {
      showNotification('يرجى تحديد الوقت الجديد', 'error');
      return;
    }

    try {
      setIsUpdatingStartTime(true);
      
      const localDateTime = dayjs(newStartTime);
      const currentTime = dayjs();
      
      if (localDateTime.isAfter(currentTime)) {
        showNotification('لا يمكن تعديل وقت البدء إلى وقت في المستقبل', 'error');
        return;
      }

      const twentyFourHoursAgo = currentTime.subtract(24, 'hour');
      if (localDateTime.isBefore(twentyFourHoursAgo)) {
        showNotification('لا يمكن تعديل وقت البدء إلى أكثر من ٢٤ ساعة في الماضي', 'error');
        return;
      }

      const year = localDateTime.year();
      const month = localDateTime.month();
      const day = localDateTime.date();
      const hour = localDateTime.hour();
      const minute = localDateTime.minute();
      
      const localDate = new Date(year, month, day, hour, minute);
      
      await api.updateSessionStartTime(selectedSessionForEditTime.id, {
        startTime: localDate.toISOString()
      });

      await fetchSessions();
      await fetchBills();

      showNotification('✅ تم تعديل وقت بدء الجلسة بنجاح', 'success');
      
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

  const openEditStartTimeModal = (session: Session) => {
    setSelectedSessionForEditTime(session);
    
    const utcStartTime = new Date(session.startTime);
    const year = utcStartTime.getFullYear();
    const month = String(utcStartTime.getMonth() + 1).padStart(2, '0');
    const day = String(utcStartTime.getDate()).padStart(2, '0');
    const hours = String(utcStartTime.getHours()).padStart(2, '0');
    const minutes = String(utcStartTime.getMinutes()).padStart(2, '0');
    
    const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    setNewStartTime(formattedTime);
    
    setShowEditStartTimeModal(true);
  };

  // إنهاء الجلسة
  const handleEndSession = async (sessionId: string) => {
    try {
      setEndingSessions(prev => ({ ...prev, [sessionId]: true }));
      await endSession(sessionId);
      await loadDevices();
      await fetchSessions();
    } catch (error) {
      showNotification('حدث خطأ أثناء إنهاء الجلسة', 'error');
    } finally {
      setEndingSessions(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  // فتح نافذة تأكيد تعديل عدد الأذرع (فتح نافذة التأكيد مباشرة)
  const openControllersEditor = (session: Session) => {
    const currentCount = session.controllers ?? 1;
    setControllersChangeData({
      sessionId: session.id,
      newCount: currentCount,
      oldCount: currentCount,
      deviceName: session.deviceName
    });
    setShowControllersConfirm(true);
  };

  // تغيير العدد داخل نافذة التأكيد
  const changeControllersInModal = (newCount: number) => {
    if (!controllersChangeData) return;
    setControllersChangeData({
      ...controllersChangeData,
      newCount: newCount
    });
  };

  // تأكيد تعديل عدد الأذرع
  const confirmUpdateControllers = async () => {
    if (!controllersChangeData) return;

    const { sessionId, newCount } = controllersChangeData;

    try {
      setUpdatingControllers(prev => ({ ...prev, [sessionId]: true }));
      
      await api.updateSessionControllers(sessionId, newCount);
      await fetchSessions();
      await fetchBills();
      
      showNotification(`✅ تم تعديل عدد الأذرع إلى ${toArabicNumbers(String(newCount))} بنجاح`, 'success');
      
      setShowControllersConfirm(false);
      setControllersChangeData(null);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'حدث خطأ أثناء تعديل عدد الأذرع';
      showNotification(`❌ ${errorMessage}`, 'error');
    } finally {
      setUpdatingControllers(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  // دالة فتح نافذة تعديل وقت فترة الدراعات
  const openEditPeriodTimeModal = (session: Session, periodIndex: number) => {
    setSelectedSessionForPeriodEdit(session);
    setSelectedPeriodIndex(periodIndex);

    // الحصول على الفترة المحددة
    const period = session.controllersHistory?.[periodIndex];
    if (!period) {
      showNotification('الفترة غير موجودة', 'error');
      return;
    }

    // تحويل وقت بداية الفترة من UTC إلى التوقيت المحلي للعرض
    const utcStartTime = new Date(period.from);
    const year = utcStartTime.getFullYear();
    const month = String(utcStartTime.getMonth() + 1).padStart(2, '0');
    const day = String(utcStartTime.getDate()).padStart(2, '0');
    const hours = String(utcStartTime.getHours()).padStart(2, '0');
    const minutes = String(utcStartTime.getMinutes()).padStart(2, '0');
    const formattedStartTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    setNewPeriodStartTime(formattedStartTime);

    // تحويل وقت نهاية الفترة إذا كانت موجودة
    if (period.to) {
      const utcEndTime = new Date(period.to);
      const endYear = utcEndTime.getFullYear();
      const endMonth = String(utcEndTime.getMonth() + 1).padStart(2, '0');
      const endDay = String(utcEndTime.getDate()).padStart(2, '0');
      const endHours = String(utcEndTime.getHours()).padStart(2, '0');
      const endMinutes = String(utcEndTime.getMinutes()).padStart(2, '0');
      const formattedEndTime = `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`;
      setNewPeriodEndTime(formattedEndTime);
    } else {
      // الفترة النشطة - لا يوجد وقت نهاية
      setNewPeriodEndTime('');
    }

    setShowEditPeriodTimeModal(true);
  };

  // دالة تعديل وقت فترة الدراعات
  const handleEditPeriodTime = async () => {
    if (!selectedSessionForPeriodEdit || !newPeriodStartTime) {
      showNotification('يرجى تحديد وقت البداية', 'error');
      return;
    }

    // التحقق من الفترة المحددة
    const period = selectedSessionForPeriodEdit.controllersHistory?.[selectedPeriodIndex];
    if (!period) {
      showNotification('الفترة غير موجودة', 'error');
      return;
    }

    const isActivePeriod = !period.to; // الفترة النشطة ليس لها وقت نهاية

    // للفترات المنتهية، التحقق من وجود وقت النهاية
    if (!isActivePeriod && !newPeriodEndTime) {
      showNotification('يرجى تحديد وقت النهاية للفترة المنتهية', 'error');
      return;
    }

    try {
      setIsUpdatingPeriodTime(true);

      const localStartDateTime = dayjs(newPeriodStartTime);
      const localEndDateTime = newPeriodEndTime ? dayjs(newPeriodEndTime) : null;

      // التحقق من أن وقت البداية ليس قبل بداية الجلسة
      const sessionStartTime = dayjs(selectedSessionForPeriodEdit.startTime);
      if (localStartDateTime.isBefore(sessionStartTime)) {
        showNotification('❌ لا يمكن تعديل وقت البداية إلى ما قبل بداية الجلسة', 'error');
        return;
      }

      // التحقق من أن وقت النهاية بعد وقت البداية
      if (localEndDateTime && localEndDateTime.isBefore(localStartDateTime)) {
        showNotification('❌ وقت النهاية يجب أن يكون بعد وقت البداية', 'error');
        return;
      }

      // إعداد البيانات للإرسال - سيتم تعديل الفترات المجاورة تلقائياً في الباكند
      await api.updateControllersPeriodTime(
        selectedSessionForPeriodEdit.id,
        selectedPeriodIndex,
        localStartDateTime.toISOString(),
        localEndDateTime ? localEndDateTime.toISOString() : undefined
      );

      showNotification('✅ تم تحديث أوقات فترة الدراعات والفترات المجاورة بنجاح', 'success');

      // إعادة تحميل الجلسات لتحديث البيانات
      await fetchSessions();
      await fetchBills();
      
      // إغلاق النافذة وتنظيف البيانات
      setShowEditPeriodTimeModal(false);
      setSelectedSessionForPeriodEdit(null);
      setSelectedPeriodIndex(0);
      setNewPeriodStartTime('');
      setNewPeriodEndTime('');

    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'حدث خطأ أثناء التحقق من البيانات';
      showNotification(`❌ ${errorMessage}`, 'error');
    } finally {
      setIsUpdatingPeriodTime(false);
    }
  };

  // ربط الجلسة بطاولة
  const handleLinkTableToSession = async (session: Session, tableId: string | null) => {
    if (!tableId) {
      showNotification('⚠️ يرجى اختيار طاولة', 'warning');
      return;
    }

    const bill = typeof session.bill === 'object' ? session.bill : null;
    const isCurrentlyLinkedToTable = bill ? !!(bill as any)?.table : false;

    try {
      setLinkingTable(true);
      
      let result;
      
      if (isCurrentlyLinkedToTable) {
        result = await api.changeSessionTable(session._id || session.id, tableId);
      } else {
        result = await api.linkSessionToTable(session._id || session.id, tableId);
      }
      
      if (result && result.success) {
        const tableDoc = tables.find(t => t._id === tableId);
        const tableNumber = tableDoc?.number;
        
        let message;
        
        if (isCurrentlyLinkedToTable && result.data && 'oldTable' in result.data && 'newTable' in result.data) {
          const changeData = result.data as any;
          message = `✅ تم نقل الجلسة من طاولة ${toArabicNumbers(String(changeData.oldTable))} إلى طاولة ${toArabicNumbers(String(changeData.newTable))} بنجاح`;
        } else {
          const billData = result.data?.bill;
          message = `✅ تم ربط الجلسة بالطاولة ${toArabicNumbers(String(tableNumber))} بنجاح`;
          
          if (billData && billData.sessionsCount > 1) {
            message += ` (تم دمج الفواتير - ${toArabicNumbers(String(billData.sessionsCount))} جلسات)`;
          }
        }
        
        showNotification(message, 'success');
        
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

        await Promise.all([fetchBills(), fetchSessions(), loadDevices()]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`bg-gradient-to-r ${config.colors.primary} dark:${config.colors.primaryDark} rounded-2xl shadow-xl p-6 border-2 ${config.colors.headerBorder}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-lg">
              <Icon className="h-8 w-8 text-current" style={{ color: deviceType === 'playstation' ? '#2563eb' : '#ea580c' }} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                {config.title}
              </h1>
              <p className="text-sm md:text-base text-white/90 mt-1">
                {config.subtitle}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowAddDevice(true)}
                className="bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 px-6 py-3 rounded-xl flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-bold"
                style={{ color: deviceType === 'playstation' ? '#2563eb' : '#ea580c' }}
              >
                <Plus className="h-5 w-5 ml-2" />
                إضافة جهاز
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isInitialLoading && (
        <div className={`bg-opacity-10 border rounded-lg p-6 text-center`} style={{ 
          backgroundColor: deviceType === 'playstation' ? '#eff6ff' : '#fff7ed',
          borderColor: deviceType === 'playstation' ? '#93c5fd' : '#fed7aa'
        }}>
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ 
              borderColor: deviceType === 'playstation' ? '#2563eb' : '#ea580c'
            }}></div>
          </div>
          <p className="font-medium" style={{ color: deviceType === 'playstation' ? '#1e40af' : '#c2410c' }}>
            جاري تحميل البيانات...
          </p>
          <p className="text-sm mt-1" style={{ color: deviceType === 'playstation' ? '#2563eb' : '#ea580c' }}>
            يرجى الانتظار قليلاً
          </p>
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

      {/* Content */}
      {!isInitialLoading && !loadingError && (
        <>
          {/* Devices Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {devices.filter(d => d.type === deviceType).map((device) => {
              const activeSession = sessions.find(s => s.deviceNumber === device.number && s.status === 'active');
              const isActive = device.status === 'active';

              return (
                <div key={device.id} className={`
                  rounded-2xl shadow-lg border-2 p-6 flex flex-col h-full transition-all duration-300 transform hover:scale-105 hover:shadow-2xl
                  ${isActive
                    ? `bg-gradient-to-br ${config.colors.card} dark:${config.colors.cardDark} ${config.colors.border} hover:shadow-green-300 dark:hover:shadow-green-900/70`
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
                        <Icon className="h-6 w-6 text-white" />
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

                        {deviceType === 'playstation' && (
                          <>
                            <div className="flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-bold text-blue-900 dark:text-blue-100">{toArabicNumbers(String(activeSession.controllers ?? 1))} دراع</span>
                            </div>

                            {/* تاريخ الدراعات */}
                            {activeSession.controllersHistory && activeSession.controllersHistory.length > 0 && (
                              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 p-4 rounded-xl border-2 border-purple-300 dark:border-purple-700 shadow-sm">
                                <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  تاريخ تغيير الدراعات
                                </h4>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                  {activeSession.controllersHistory.map((period, index) => {
                                    const isCurrentPeriod = !period.to;
                                    const startTime = dayjs(period.from).utc().add(2, 'hour');
                                    const endTime = period.to ? dayjs(period.to).utc().add(2, 'hour') : null;
                                    return (
                                      <div key={index} className={`flex items-center justify-between p-2 rounded-lg border ${
                                        isCurrentPeriod
                                          ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                                      }`}>
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                              isCurrentPeriod
                                                ? 'bg-green-500 text-white'
                                                : 'bg-purple-500 text-white'
                                            }`}>
                                              {toArabicNumbers(String(period.controllers))} دراع
                                            </span>
                                            {isCurrentPeriod && (
                                              <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full animate-pulse">
                                                نشط
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                            من: {formatTimeInArabic(startTime)}
                                            {endTime && (
                                              <span> - إلى: {formatTimeInArabic(endTime)}</span>
                                            )}
                                          </div>
                                        </div>

                                        {/* زر تعديل وقت الفترة */}
                                        <button
                                          onClick={() => openEditPeriodTimeModal(activeSession, index)}
                                          className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 flex items-center justify-center"
                                          title="تعديل وقت بداية هذه الفترة"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* أزرار تعديل عدد الأذرع */}
                            <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 p-4 rounded-xl border-2 border-orange-300 dark:border-orange-700">
                              <p className="text-xs font-bold text-orange-900 dark:text-orange-100 mb-3 text-center">تعديل عدد الأذرع</p>
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                                  disabled={(activeSession.controllers ?? 1) <= 1 || updatingControllers[activeSession.id]}
                                  onClick={() => openControllersEditor(activeSession)}
                                  title="تقليل عدد الأذرع"
                                >
                                  {updatingControllers[activeSession.id] ? (
                                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <span className="text-xl">-</span>
                                  )}
                                </button>
                                <button
                                  className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-sm min-w-[80px] hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                  onClick={() => openControllersEditor(activeSession)}
                                  disabled={updatingControllers[activeSession.id]}
                                  title="تعديل عدد الأذرع"
                                >
                                  <span className="font-bold text-xl text-orange-600 dark:text-orange-400 block text-center">
                                    {toArabicNumbers(String(activeSession.controllers ?? 1))}
                                  </span>
                                  <span className="text-xs text-gray-600 dark:text-gray-400 block text-center">دراع</span>
                                </button>
                                <button
                                  className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                                  disabled={(activeSession.controllers ?? 1) >= 4 || updatingControllers[activeSession.id]}
                                  onClick={() => openControllersEditor(activeSession)}
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
                          </>
                        )}

                        {/* عرض حالة ربط الطاولة فقط (بدون أزرار) */}
                        {activeSession.bill && (() => {
                          const bill = typeof activeSession.bill === 'object' ? activeSession.bill : null;
                          const billTable = bill ? (bill as any)?.table : null;

                          let billTableNumber = null;
                          if (billTable) {
                            if (typeof billTable === 'object') {
                              billTableNumber = billTable.number || billTable.name;
                            } else {
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
                            <>
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <button
                                  onClick={() => openEditStartTimeModal(activeSession)}
                                  className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-1"
                                >
                                  <Edit className="h-4 w-4" />
                                  تعديل الوقت
                                </button>

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
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <button
                                onClick={() => openEditStartTimeModal(activeSession)}
                                className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-1"
                              >
                                <Edit className="h-4 w-4" />
                                تعديل الوقت
                              </button>

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
                        disabled={isActive}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-2 ${
                          isActive
                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white'
                        }`}
                        title={isActive ? 'لا يمكن تعديل جهاز نشط' : 'تعديل الجهاز'}
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

      {/* نافذة إضافة جهاز جديد */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border-2 ${config.colors.headerBorder}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">إضافة جهاز جديد</h2>
              <button
                onClick={() => {
                  setShowAddDevice(false);
                  setNewDevice(
                    deviceType === 'playstation'
                      ? { name: '', number: '', controllers: 2, playstationRates: config.defaultRate }
                      : { name: '', number: '', hourlyRate: String(config.defaultRate) }
                  );
                  setAddDeviceError(null);
                }}
                className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-lg transition-all duration-200 flex items-center justify-center text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddDevice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  اسم الجهاز <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="مثال: جهاز 1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  رقم الجهاز <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={newDevice.number}
                  onChange={(e) => setNewDevice({ ...newDevice, number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="1"
                  required
                  min="1"
                />
              </div>

              {deviceType === 'playstation' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      عدد الدراعات الافتراضي
                    </label>
                    <select
                      value={newDevice.controllers}
                      onChange={(e) => setNewDevice({ ...newDevice, controllers: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      {[1, 2, 3, 4].map(num => (
                        <option key={num} value={num}>{toArabicNumbers(String(num))} دراع</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      أسعار الساعة حسب عدد الدراعات
                    </label>
                    {[1, 2, 3, 4].map(num => (
                      <div key={num} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
                          {toArabicNumbers(String(num))} دراع:
                        </span>
                        <input
                          type="number"
                          value={newDevice.playstationRates[num]}
                          onChange={(e) => setNewDevice({
                            ...newDevice,
                            playstationRates: { ...newDevice.playstationRates, [num]: e.target.value }
                          })}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                          placeholder="20"
                          required
                          min="0"
                          step="0.01"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">ج.م</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    سعر الساعة <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={newDevice.hourlyRate}
                      onChange={(e) => setNewDevice({ ...newDevice, hourlyRate: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="15"
                      required
                      min="0"
                      step="0.01"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">ج.م</span>
                  </div>
                </div>
              )}

              {addDeviceError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{addDeviceError}</p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDevice(false);
                    setNewDevice(
                      deviceType === 'playstation'
                        ? { name: '', number: '', controllers: 2, playstationRates: config.defaultRate }
                        : { name: '', number: '', hourlyRate: String(config.defaultRate) }
                    );
                    setAddDeviceError(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAddingDevice}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors duration-200 ${
                    isAddingDevice
                      ? 'bg-green-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isAddingDevice ? 'جاري الإضافة...' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تعديل جهاز */}
      {showEditDevice && editingDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border-2 ${config.colors.headerBorder}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">تعديل الجهاز</h2>
              <button
                onClick={() => {
                  setShowEditDevice(false);
                  setEditingDevice(null);
                }}
                className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-lg transition-all duration-200 flex items-center justify-center text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                let deviceData: any = {
                  name: editingDevice.name,
                  number: parseInt(editingDevice.number),
                };

                if (deviceType === 'playstation') {
                  const playstationRates: { [key: number]: number } = {};
                  for (let i = 1; i <= 4; i++) {
                    playstationRates[i] = parseFloat(editingDevice.playstationRates[i]);
                  }
                  deviceData.playstationRates = playstationRates;
                } else {
                  deviceData.hourlyRate = parseFloat(editingDevice.hourlyRate);
                }

                await updateDevice(editingDevice._id || editingDevice.id, deviceData);
                await loadDevices();
                setShowEditDevice(false);
                setEditingDevice(null);
                showNotification('تم تعديل الجهاز بنجاح', 'success');
              } catch (error) {
                showNotification('حدث خطأ أثناء تعديل الجهاز', 'error');
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  اسم الجهاز <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingDevice.name}
                  onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  رقم الجهاز <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={editingDevice.number}
                  onChange={(e) => setEditingDevice({ ...editingDevice, number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  required
                  min="1"
                />
              </div>

              {deviceType === 'playstation' ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    أسعار الساعة حسب عدد الدراعات
                  </label>
                  {[1, 2, 3, 4].map(num => (
                    <div key={num} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
                        {toArabicNumbers(String(num))} دراع:
                      </span>
                      <input
                        type="number"
                        value={editingDevice.playstationRates[num]}
                        onChange={(e) => setEditingDevice({
                          ...editingDevice,
                          playstationRates: { ...editingDevice.playstationRates, [num]: e.target.value }
                        })}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        required
                        min="0"
                        step="0.01"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">ج.م</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    سعر الساعة <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editingDevice.hourlyRate}
                      onChange={(e) => setEditingDevice({ ...editingDevice, hourlyRate: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      required
                      min="0"
                      step="0.01"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">ج.م</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDevice(false);
                    setEditingDevice(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors duration-200"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تأكيد حذف الجهاز */}
      {showDeleteConfirm && deviceToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">تأكيد الحذف</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              هل أنت متأكد من حذف الجهاز "{deviceToDelete.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeviceToDelete(null);
                }}
                disabled={isDeletingDevice}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors duration-200"
              >
                إلغاء
              </button>
              <button
                onClick={confirmDeleteDevice}
                disabled={isDeletingDevice}
                className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors duration-200 ${
                  isDeletingDevice
                    ? 'bg-red-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isDeletingDevice ? 'جاري الحذف...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة بدء جلسة جديدة */}
      {showNewSession && selectedDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className={`bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border-2 ${config.colors.headerBorder} animate-bounce-in`}>
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
                <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
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

            {/* عدد الدراعات - للبلايستيشن فقط */}
            {deviceType === 'playstation' && (
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
                    ⚠️ يرجى اختيار عدد الأذرع لبدء الجلسة
                  </p>
                )}
              </div>
            )}

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
                  (deviceType === 'playstation' && !selectedControllers) || loadingSession
                    ? 'bg-green-400 dark:bg-green-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                } text-white`}
                disabled={(deviceType === 'playstation' && !selectedControllers) || loadingSession}
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

      {/* نافذة ربط الجلسة بطاولة */}
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
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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

      {/* نافذة تعديل وقت بدء الجلسة */}
      {showEditStartTimeModal && selectedSessionForEditTime && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">تعديل وقت بدء الجلسة</h2>
              <button
                onClick={() => {
                  setShowEditStartTimeModal(false);
                  setSelectedSessionForEditTime(null);
                  setNewStartTime('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                disabled={isUpdatingStartTime}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                الجهاز: {devices.find(d => d.number === selectedSessionForEditTime.deviceNumber)?.name || selectedSessionForEditTime.deviceName}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                وقت البدء الجديد <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={isUpdatingStartTime}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                لا يمكن تعديل الوقت إلى المستقبل أو أكثر من ٢٤ ساعة في الماضي
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                onClick={() => {
                  setShowEditStartTimeModal(false);
                  setSelectedSessionForEditTime(null);
                  setNewStartTime('');
                }}
                className="w-full sm:w-auto px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                disabled={isUpdatingStartTime}
              >
                إلغاء
              </button>
              <button
                onClick={handleEditStartTime}
                className={`w-full sm:w-auto px-6 py-2 rounded-lg flex items-center justify-center min-w-[120px] transition-all duration-200 ${
                  isUpdatingStartTime || !newStartTime
                    ? 'bg-blue-400 dark:bg-blue-700 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                } text-white`}
                disabled={isUpdatingStartTime || !newStartTime}
              >
                {isUpdatingStartTime ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري التعديل...
                  </>
                ) : (
                  <>
                    <Edit className="h-5 w-5 ml-2" />
                    حفظ التعديل
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
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">تعديل عدد الأذرع</h2>
              </div>
              <button
                onClick={() => {
                  setShowControllersConfirm(false);
                  setControllersChangeData(null);
                }}
                className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-lg transition-all duration-200 flex items-center justify-center text-white hover:scale-110 transform shadow-md"
                disabled={updatingControllers[controllersChangeData.sessionId]}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 space-y-4">
              {/* معلومات الجهاز */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4 shadow-sm">
                <p className="text-blue-900 dark:text-blue-100 font-bold mb-2 flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  جلسة {controllersChangeData.deviceName}
                </p>
                <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">العدد الحالي:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{toArabicNumbers(String(controllersChangeData.oldCount))} دراع</span>
                </div>
              </div>

              {/* اختيار عدد الأذرع */}
              <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-4 shadow-sm">
                <p className="text-orange-900 dark:text-orange-100 font-bold mb-3 text-center">اختر العدد الجديد</p>
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((count) => {
                    const isSelected = count === controllersChangeData.newCount;
                    const isOriginal = count === controllersChangeData.oldCount;
                    return (
                      <button
                        key={count}
                        onClick={() => changeControllersInModal(count)}
                        className={`
                          p-3 rounded-lg font-bold text-lg transition-all duration-200 transform hover:scale-105 border-2
                          ${isSelected
                            ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg border-orange-600'
                            : isOriginal
                            ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600'
                            : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500'
                          }
                        `}
                      >
                        {toArabicNumbers(String(count))}
                      </button>
                    );
                  })}
                </div>
                {controllersChangeData.newCount !== controllersChangeData.oldCount && (
                  <div className="mt-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-orange-200 dark:border-orange-600">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">التغيير:</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">
                        {controllersChangeData.newCount > controllersChangeData.oldCount
                          ? `+${controllersChangeData.newCount - controllersChangeData.oldCount} دراع`
                          : `${controllersChangeData.newCount - controllersChangeData.oldCount} دراع`
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* تحذير إعادة الحساب */}
              {controllersChangeData.newCount !== controllersChangeData.oldCount && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-yellow-900 dark:text-yellow-100 font-semibold flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    سيتم إعادة حساب التكلفة بناءً على العدد الجديد من الأذرع
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowControllersConfirm(false);
                  setControllersChangeData(null);
                }}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-600 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-all duration-200 font-bold shadow-md hover:shadow-lg transform hover:scale-105"
                disabled={updatingControllers[controllersChangeData.sessionId]}
              >
                إلغاء
              </button>
              <button
                onClick={confirmUpdateControllers}
                disabled={controllersChangeData.newCount === controllersChangeData.oldCount || updatingControllers[controllersChangeData.sessionId]}
                className="px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {updatingControllers[controllersChangeData.sessionId] ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"></div>
                    جاري التعديل...
                  </>
                ) : (
                  <>
                    <Users className="h-5 w-5 ml-2" />
                    تأكيد التعديل
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل وقت فترة الدراعات */}
      {showEditPeriodTimeModal && selectedSessionForPeriodEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">تعديل وقت فترة الدراعات</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedSessionForPeriodEdit.deviceName}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditPeriodTimeModal(false);
                  setSelectedSessionForPeriodEdit(null);
                  setSelectedPeriodIndex(0);
                  setNewPeriodStartTime('');
                  setNewPeriodEndTime('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors duration-200"
                disabled={isUpdatingPeriodTime}
              >
                <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* معلومات الفترة الحالية */}
            <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
              <h4 className="font-bold text-purple-900 dark:text-purple-100 mb-2">معلومات الفترة</h4>
              {selectedSessionForPeriodEdit.controllersHistory && selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex] && (() => {
                const period = selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex];
                const isActivePeriod = !period.to;
                const controllersHistory = selectedSessionForPeriodEdit.controllersHistory;

                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">عدد الدراعات:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {toArabicNumbers(String(period.controllers))} دراع
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">الحالة:</span>
                      <span className={`font-medium ${isActivePeriod ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {isActivePeriod ? 'نشطة' : 'منتهية'}
                      </span>
                    </div>
                    {!isActivePeriod && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">وقت النهاية الحالي:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {formatTimeInArabic(dayjs(period.to).utc().add(2, 'hour'))}
                        </span>
                      </div>
                    )}

                    {/* معلومات الفترات المجاورة */}
                    <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-600">
                      <h5 className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-2">الفترات المجاورة:</h5>
                      <div className="space-y-1 text-xs">
                        {selectedPeriodIndex > 0 && (
                          <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded">
                            <span>الفترة السابقة ({toArabicNumbers(String(controllersHistory[selectedPeriodIndex - 1].controllers))} دراع):</span>
                            <span className="font-medium">
                              {controllersHistory[selectedPeriodIndex - 1].to
                                ? `تنتهي: ${formatTimeInArabic(dayjs(controllersHistory[selectedPeriodIndex - 1].to).utc().add(2, 'hour'))}`
                                : 'نشطة'
                              }
                            </span>
                          </div>
                        )}
                        {selectedPeriodIndex < controllersHistory.length - 1 && (
                          <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/30 rounded">
                            <span>الفترة التالية ({toArabicNumbers(String(controllersHistory[selectedPeriodIndex + 1].controllers))} دراع):</span>
                            <span className="font-medium">
                              تبدأ: {formatTimeInArabic(dayjs(controllersHistory[selectedPeriodIndex + 1].from).utc().add(2, 'hour'))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* حقول التعديل */}
            <div className="space-y-4 mb-6">
              {/* وقت البداية */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  وقت البداية الجديد
                </label>
                <input
                  type="datetime-local"
                  value={newPeriodStartTime}
                  onChange={(e) => setNewPeriodStartTime(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all duration-200"
                  disabled={isUpdatingPeriodTime}
                />
                {newPeriodStartTime && (
                  <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                    <p className="text-sm text-purple-800 dark:text-purple-200 font-medium">
                      📅 وقت البداية: {formatTimeInArabic(dayjs(newPeriodStartTime))}
                    </p>
                  </div>
                )}
              </div>

              {/* وقت النهاية - يظهر فقط للفترات المنتهية */}
              {selectedSessionForPeriodEdit.controllersHistory &&
                selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex] &&
                selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex].to && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    وقت النهاية الجديد
                  </label>
                  <input
                    type="datetime-local"
                    value={newPeriodEndTime}
                    onChange={(e) => setNewPeriodEndTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all duration-200"
                    disabled={isUpdatingPeriodTime}
                  />
                  {newPeriodEndTime && (
                    <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                      <p className="text-sm text-purple-800 dark:text-purple-200 font-medium">
                        📅 وقت النهاية: {formatTimeInArabic(dayjs(newPeriodEndTime))}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* تحذير */}
            <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ تعديل أوقات فترة الدراعات سيؤثر على حساب التكلفة الإجمالية للجلسة
              </p>
              {selectedSessionForPeriodEdit.controllersHistory &&
                selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex] &&
                !selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex].to && (
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  ℹ️ هذه فترة نشطة - يمكن تعديل وقت بدايتها فقط
                </p>
              )}
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-600">
                <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                  � التعديل التلقائي للفترات المجاورة:
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                  <li>• عند تعديل وقت البداية → سيتم تعديل وقت نهاية الفترة السابقة تلقائياً</li>
                  <li>• عند تعديل وقت النهاية → سيتم تعديل وقت بداية الفترة التالية تلقائياً</li>
                  <li>• هذا يضمن عدم وجود فجوات أو تداخلات بين الفترات</li>
                </ul>
              </div>
            </div>

            {/* الأزرار */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEditPeriodTimeModal(false);
                  setSelectedSessionForPeriodEdit(null);
                  setSelectedPeriodIndex(0);
                  setNewPeriodStartTime('');
                  setNewPeriodEndTime('');
                }}
                className="w-full sm:w-auto px-6 py-3 bg-gray-200 dark:bg-gray-600 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-all duration-200 font-medium"
                disabled={isUpdatingPeriodTime}
              >
                إلغاء
              </button>
              <button
                onClick={handleEditPeriodTime}
                className={`w-full sm:w-auto px-8 py-3 rounded-xl flex items-center justify-center min-w-[160px] transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  !newPeriodStartTime || isUpdatingPeriodTime
                    ? 'bg-purple-400 dark:bg-purple-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                } text-white`}
                disabled={!newPeriodStartTime || isUpdatingPeriodTime}
              >
                {isUpdatingPeriodTime ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري التحديث...
                  </>
                ) : (
                  <>
                    <Clock className="h-5 w-5 ml-2" />
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

export default GamingDevices;
