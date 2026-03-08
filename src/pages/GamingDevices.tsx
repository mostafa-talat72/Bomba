import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Monitor, Play, Square, Users, Plus, Table as TableIcon, X, Edit, Trash2, Clock } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useOrganization } from '../context/OrganizationContext';
import { useApp } from '../context/AppContext';
import api, { Device, Session } from '../services/api';
import { SessionCostDisplay } from '../components/SessionCostDisplay';
import { formatDecimal, formatCurrency, getCurrencySymbol } from '../utils/formatters';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

// Format time based on locale with proper number formatting and timezone support
const formatTimeByLocale = (dateTime: dayjs.Dayjs, locale: string, tz?: string): string => {
  dayjs.locale(locale);
  // If timezone is provided, convert to that timezone, otherwise use the datetime as-is
  const timeInZone = tz ? dateTime.tz(tz) : dateTime;
  const formatted = timeInZone.format('DD/MM/YYYY - hh:mm A');

  if (locale === 'ar') {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return formatted
      .replace(/[0-9]/g, (digit) => arabicNumbers[parseInt(digit)])
      .replace('AM', 'ص')
      .replace('PM', 'م');
  }

  return formatted;
};

// ???? ?????? ??? ?????? ????????? ????? ??? ????? ???????
const translateDefaultCustomerName = (customerName: string, deviceType: string, deviceNumber: string | number, t: any): string => {
  // ??? ??? ????? ??????? ???? ????
  if (!customerName || customerName.trim() === '') {
    return '';
  }

  // Arabic patterns for default customer names
  const arabicPatterns = {
    customer: /^عميل\s*\((.+)\)$/i,
    playstationCustomer: /^عميل بلايستيشن\s+PS/i,
    computerCustomer: /^عميل كمبيوتر\s+PC/i,
    table: /^طاولة\s+\d+$/i,
  };

  // ????? ????? ??????? ?????????? ???????????
  const englishPatterns = {
    customer: /^Customer\s*\((.+)\)$/i,
    playstationCustomer: /^PlayStation Customer\s+PS/i,
    computerCustomer: /^Computer Customer\s+PC/i,
    table: /^Table\s+\d+$/i,
  };

  // ????? ????? ??????? ?????????? ?????????
  const frenchPatterns = {
    customer: /^Client\s*\((.+)\)$/i,
    playstationCustomer: /^Client PlayStation\s+PS/i,
    computerCustomer: /^Client Ordinateur\s+PC/i,
    table: /^Table\s+\d+$/i,
  };

  // ?????? ?? ????? ???????
  // ??? "???? (??? ??????)"
  let match = customerName.match(arabicPatterns.customer) ||
              customerName.match(englishPatterns.customer) ||
              customerName.match(frenchPatterns.customer);

  if (match && match[1]) {
    // ??????? ??? ?????? ?? ???? ???????
    const deviceName = match[1];
    return `${t('gaming.defaultCustomerName')} (${deviceName})`;
  }

  if (arabicPatterns.playstationCustomer.test(customerName) ||
      englishPatterns.playstationCustomer.test(customerName) ||
      frenchPatterns.playstationCustomer.test(customerName)) {
    // ???? ?????????
    return `${t('gaming.playstationCustomer')} PS${deviceNumber}`;
  }

  if (arabicPatterns.computerCustomer.test(customerName) ||
      englishPatterns.computerCustomer.test(customerName) ||
      frenchPatterns.computerCustomer.test(customerName)) {
    // ???? ???????
    return `${t('gaming.computerCustomer')} PC${deviceNumber}`;
  }

  if (arabicPatterns.table.test(customerName) ||
      englishPatterns.table.test(customerName) ||
      frenchPatterns.table.test(customerName)) {
    // ??? ?????
    const tableNumber = customerName.match(/\d+/)?.[0] || '';
    return `${t('gaming.table')} ${tableNumber}`;
  }

  // ??? ?? ??? ????? ?????????? ???? ????? ??? ??
  return customerName;
};

interface GamingDevicesProps {
  deviceType: 'playstation' | 'computer';
}

const GamingDevices: React.FC<GamingDevicesProps> = ({ deviceType }) => {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const { timezone, formatDateTime } = useOrganization();
  const { sessions, createSession, endSession, user, createDevice, updateDevice, deleteDevice, fetchBills, showNotification, tables, fetchTables, fetchTableSections, fetchSessions } = useApp();
  
  // Get currency from localStorage and format it based on language
  const organizationCurrency = localStorage.getItem('organizationCurrency') || 'EGP';
  const currencySymbol = getCurrencySymbol(organizationCurrency, i18n.language);
  
  // Configuration based on device type
  const config = {
    playstation: {
      icon: Gamepad2,
      title: t('gaming.playstation.title'),
      subtitle: t('gaming.playstation.subtitle'),
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
      title: t('gaming.computer.title'),
      subtitle: t('gaming.computer.subtitle'),
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

  // ???? ?????
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedControllers, setSelectedControllers] = useState<number | null>(null);

  // ??? ??????
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  
  // ??? ?????? ?????? ??? ??? ??????
  const [showLinkTableModal, setShowLinkTableModal] = useState(false);
  const [selectedSessionForLink, setSelectedSessionForLink] = useState<Session | null>(null);
  const [linkingTable, setLinkingTable] = useState(false);

  // ?? ??? ?????? ?? ???????
  const [showUnlinkTableModal, setShowUnlinkTableModal] = useState(false);
  const [selectedSessionForUnlink, setSelectedSessionForUnlink] = useState<Session | null>(null);
  const [unlinkingTable, setUnlinkingTable] = useState(false);
  const [customerNameForUnlink, setCustomerNameForUnlink] = useState('');

  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [endingSessions, setEndingSessions] = useState<Record<string, boolean>>({});
  const [updatingControllers, setUpdatingControllers] = useState<Record<string, boolean>>({});
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  
  // ????? ??????? ??????
  const [showEditDevice, setShowEditDevice] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<any>(null);
  const [isDeletingDevice, setIsDeletingDevice] = useState(false);

  // ????? ????? ??? ??? ??????
  const [showEditStartTimeModal, setShowEditStartTimeModal] = useState(false);
  const [selectedSessionForEditTime, setSelectedSessionForEditTime] = useState<Session | null>(null);
  const [newStartTime, setNewStartTime] = useState('');
  const [isUpdatingStartTime, setIsUpdatingStartTime] = useState(false);

  // ????? ????? ??? ???? ????????
  const [showEditPeriodTimeModal, setShowEditPeriodTimeModal] = useState(false);
  const [selectedSessionForPeriodEdit, setSelectedSessionForPeriodEdit] = useState<Session | null>(null);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number>(0);
  const [newPeriodStartTime, setNewPeriodStartTime] = useState('');
  const [newPeriodEndTime, setNewPeriodEndTime] = useState('');
  const [isUpdatingPeriodTime, setIsUpdatingPeriodTime] = useState(false);

  // ????? ????? ????? ??? ??????
  const [showControllersConfirm, setShowControllersConfirm] = useState(false);
  const [controllersChangeData, setControllersChangeData] = useState<{sessionId: string, newCount: number, oldCount: number, deviceName: string} | null>(null);

  // ????? ????? ????? ??????
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false);
  const [sessionToEnd, setSessionToEnd] = useState<Session | null>(null);
  const [customerNameForEnd, setCustomerNameForEnd] = useState('');

  // Loading states
  const [isInitialLoading, setIsInitialLoading] = useState(sessions.length === 0);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // ????? ?????
  const [devices, setDevices] = useState<Device[]>([]);
  
  // Track if we've loaded data for this page visit
  const hasLoadedRef = useRef(false);
  const lastPathRef = useRef(location.pathname);

  // ????? ???????
  const loadDevices = async () => {
    try {
      const response = await api.getDevices({ type: deviceType });
      if (response.success && response.data) {
        setDevices(response.data);
      }
    } catch {
      showNotification(t('gaming.deviceAddedError'), 'error');
    }
  };

  // Reset loaded flag when navigating away
  useEffect(() => {
    const currentPath = deviceType === 'playstation' ? '/playstation' : '/computer';
    if (location.pathname !== currentPath) {
      hasLoadedRef.current = false;
    }
  }, [location.pathname, deviceType]);

  // ????? ???????? ???? ??????
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
        const errorMessage = err instanceof Error ? err.message : t('gaming.loadingError');
        setLoadingError(errorMessage);
        showNotification(t('gaming.loadingError'), 'error');
        setIsInitialLoading(false);
      }
    };

    loadAllData();
    
    return () => {
      isMounted = false;
    };
  }, [user, location.pathname, deviceType]);

  // ????? ??????? ?????? Escape
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

  // ???? ??????? ??????
  const handleEditDevice = (device: any) => {
    const activeSession = sessions.find(session => 
      session.deviceId === device._id && session.status === 'active'
    );
    
    if (activeSession) {
      showNotification(t('gaming.cannotEditActiveDevice'), 'error');
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
      showNotification(t('gaming.deviceDeletedError'), 'error');
    } finally {
      setIsDeletingDevice(false);
    }
  };

  // ????? ???? ????
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddDeviceError(null);
    if (!newDevice.name || !newDevice.number) {
      setAddDeviceError(t('gaming.deviceNameRequired'));
      setIsAddingDevice(false);
      return;
    }

    const deviceNumber = parseInt(newDevice.number);
    if (isNaN(deviceNumber) || deviceNumber <= 0) {
      setAddDeviceError(t('gaming.deviceNumberInvalid'));
      setIsAddingDevice(false);
      return;
    }

    const existingDevice = devices.find(d => {
      const existingNumber = typeof d.number === 'string' ? 
        parseInt((d.number as string).replace(/[^0-9]/g, '')) : d.number;
      return existingNumber === deviceNumber;
    });
    if (existingDevice) {
      setAddDeviceError(t('gaming.deviceNumberExists', { number: formatDecimal(deviceNumber, i18n.language) }));
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
          setAddDeviceError(t('gaming.hourlyRateForControllersInvalid', { count: i }));
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
        setAddDeviceError(t('gaming.hourlyRateInvalid'));
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
        showNotification(t('gaming.deviceAddedSuccess'), 'success');
      } else {
        setAddDeviceError(t('gaming.deviceAddedError'));
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } }; message?: string };
      const errorMessage = apiError?.response?.data?.error || apiError?.message || t('gaming.deviceAddedError');
      setAddDeviceError(errorMessage);
      showNotification(`${t('gaming.deviceAddedError')}: ${errorMessage}`, 'error');
    } finally {
      setIsAddingDevice(false);
    }
  };

  // ??? ???? ?????
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
          // ????? ???? ??????
          await api.updateDeviceStatus(selectedDevice.id, { status: 'active' });
          
          // ????? ???? ???????? ???????? ??????
          await Promise.all([
            loadDevices(),
            fetchSessions(), // ??? ????: ????? ??????? ?????? ??????? ????????
            fetchBills(),
            fetchTables() // ????? ???? ????????
          ]);
          
          showNotification(t('gaming.sessionStartedSuccess'), 'success');
          
          setShowNewSession(false);
          setSelectedDevice(null);
          setSelectedControllers(null);
          setSessionError(null);
          setSelectedTable(null);
        } catch (updateError) {
          showNotification(t('gaming.sessionStartedError'), 'warning');
          setShowNewSession(false);
        }
      } else {
        setSessionError(t('gaming.sessionStartedError'));
        showNotification(t('gaming.sessionStartedError'), 'error');
      }
    } catch (err: unknown) {
      const apiError = err as { message?: string; response?: { data?: { message?: string, error?: string } } };
      const errorMessage = apiError?.response?.data?.error || apiError?.response?.data?.message || apiError?.message || t('gaming.sessionStartedError');
      
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('in use') || errorMessage.includes('قيد الاستخدام')) {
        userFriendlyMessage = t('gaming.deviceInUse');
      } else if (errorMessage.includes('not found') || errorMessage.includes('غير موجود')) {
        userFriendlyMessage = t('gaming.deviceNotFound');
      } else {
        userFriendlyMessage = errorMessage;
      }
      
      setSessionError(userFriendlyMessage);
      showNotification(userFriendlyMessage, 'error');
    } finally {
      setLoadingSession(false);
    }
  };

  // ????? ??? ??? ??????
  const handleEditStartTime = async () => {
    if (!selectedSessionForEditTime || !newStartTime) {
      showNotification(t('gaming.newStartTime') + ' ' + t('gaming.required'), 'error');
      return;
    }

    try {
      setIsUpdatingStartTime(true);
      
      // Convert local time from organization timezone to UTC
      const localDateTime = dayjs.tz(newStartTime, timezone);
      const currentTime = dayjs().tz(timezone);
      
      if (localDateTime.isAfter(currentTime)) {
        showNotification(t('gaming.cannotEditFutureTime'), 'error');
        return;
      }

      const twentyFourHoursAgo = currentTime.subtract(24, 'hour');
      if (localDateTime.isBefore(twentyFourHoursAgo)) {
        showNotification(t('gaming.cannotEditFutureTime'), 'error');
        return;
      }
      
      // ????? ??? UTC ??????? ???????
      const utcDateTime = localDateTime.utc().toISOString();
      
      await api.updateSessionStartTime(selectedSessionForEditTime.id, {
        startTime: utcDateTime
      });

      await fetchSessions();
      await fetchBills();

      showNotification(t('gaming.startTimeUpdatedSuccess'), 'success');
      
      setShowEditStartTimeModal(false);
      setSelectedSessionForEditTime(null);
      setNewStartTime('');

    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || t('gaming.startTimeUpdatedError');
      showNotification(errorMessage, 'error');
    } finally {
      setIsUpdatingStartTime(false);
    }
  };

  const openEditStartTimeModal = (session: Session) => {
    setSelectedSessionForEditTime(session);
    
    // ????? ??? ??? ?????? ?? UTC ??? ??????? ??????? ???????
    const utcStartTime = new Date(session.startTime);
    const orgTime = new Date(utcStartTime.toLocaleString('en-US', { timeZone: timezone }));
    
    const year = orgTime.getFullYear();
    const month = String(orgTime.getMonth() + 1).padStart(2, '0');
    const day = String(orgTime.getDate()).padStart(2, '0');
    const hours = String(orgTime.getHours()).padStart(2, '0');
    const minutes = String(orgTime.getMinutes()).padStart(2, '0');
    
    const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    setNewStartTime(formattedTime);
    
    setShowEditStartTimeModal(true);
  };

  // ????? ??????
  const handleEndSession = async (sessionId: string) => {
    // Find the session
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      showNotification(t('gaming.sessionNotFound'), 'error');
      return;
    }

    // Check if session is linked to a table
    const bill = typeof session.bill === 'object' ? session.bill : null;
    const isLinkedToTable = bill ? !!(bill as any)?.table : false;

    // If not linked to a table, show confirmation modal
    if (!isLinkedToTable) {
      setSessionToEnd(session);
      setCustomerNameForEnd(session.customerName || `عميل (${session.deviceName})`);
      setShowEndSessionConfirm(true);
      return;
    }

    // Session is linked to a table, end directly
    try {
      setEndingSessions(prev => ({ ...prev, [sessionId]: true }));
      await endSession(sessionId);
      await loadDevices();
      await fetchSessions();
    } catch (error) {
      showNotification(t('gaming.sessionEndedError'), 'error');
    } finally {
      setEndingSessions(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  // ????? ????? ??????
  const confirmEndSession = async () => {
    if (!sessionToEnd) return;

    if (!customerNameForEnd.trim()) {
      showNotification(t('gaming.customerNameRequired'), 'error');
      return;
    }

    try {
      setEndingSessions(prev => ({ ...prev, [sessionToEnd.id]: true }));
      await endSession(sessionToEnd.id, customerNameForEnd.trim());
      await loadDevices();
      await fetchSessions();
      
      setShowEndSessionConfirm(false);
      setSessionToEnd(null);
      setCustomerNameForEnd('');
    } catch (error) {
      showNotification(t('gaming.sessionEndedError'), 'error');
    } finally {
      setEndingSessions(prev => ({ ...prev, [sessionToEnd.id]: false }));
    }
  };

  // ??? ????? ????? ????? ??? ?????? (??? ????? ??????? ??????)
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

  // ????? ????? ???? ????? ???????
  const changeControllersInModal = (newCount: number) => {
    if (!controllersChangeData) return;
    setControllersChangeData({
      ...controllersChangeData,
      newCount: newCount
    });
  };

  // ????? ????? ??? ??????
  const confirmUpdateControllers = async () => {
    if (!controllersChangeData) return;

    const { sessionId, newCount } = controllersChangeData;

    try {
      setUpdatingControllers(prev => ({ ...prev, [sessionId]: true }));
      
      await api.updateSessionControllers(sessionId, newCount);
      await fetchSessions();
      await fetchBills();
      
      const message = t('gaming.controllersUpdatedSuccess', { count: newCount }).replace(newCount.toString(), formatDecimal(newCount, i18n.language));
      showNotification(message, 'success');
      
      setShowControllersConfirm(false);
      setControllersChangeData(null);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || t('gaming.controllersUpdatedError');
      showNotification(errorMessage, 'error');
    } finally {
      setUpdatingControllers(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  // ???? ??? ????? ????? ??? ???? ????????
  const openEditPeriodTimeModal = (session: Session, periodIndex: number) => {
    setSelectedSessionForPeriodEdit(session);
    setSelectedPeriodIndex(periodIndex);

    // ?????? ??? ?????? ???????
    const period = session.controllersHistory?.[periodIndex];
    if (!period) {
      showNotification(t('gaming.periodTimeUpdatedError'), 'error');
      return;
    }

    // ????? ??? ????? ?????? ?? UTC ??? ??????? ??????? ???????
    const orgStartTime = dayjs(period.from).tz(timezone);
    const formattedStartTime = orgStartTime.format('YYYY-MM-DDTHH:mm');
    setNewPeriodStartTime(formattedStartTime);

    // ????? ??? ????? ?????? ??? ???? ??????
    if (period.to) {
      const orgEndTime = dayjs.utc(period.to).tz(timezone);
      const formattedEndTime = orgEndTime.format('YYYY-MM-DDTHH:mm');
      setNewPeriodEndTime(formattedEndTime);
    } else {
      // ?????? ?????? - ?? ???? ??? ?????
      setNewPeriodEndTime('');
    }

    setShowEditPeriodTimeModal(true);
  };

  // ???? ????? ??? ???? ????????
  const handleEditPeriodTime = async () => {
    if (!selectedSessionForPeriodEdit || !newPeriodStartTime) {
      showNotification(t('gaming.newPeriodStartTime') + ' ' + t('gaming.required'), 'error');
      return;
    }

    // ?????? ?? ?????? ???????
    const period = selectedSessionForPeriodEdit.controllersHistory?.[selectedPeriodIndex];
    if (!period) {
      showNotification(t('gaming.periodTimeUpdatedError'), 'error');
      return;
    }

    const isActivePeriod = !period.to; // ?????? ?????? ??? ??? ??? ?????

    // ??????? ????????? ?????? ?? ???? ??? ???????
    if (!isActivePeriod && !newPeriodEndTime) {
      showNotification(t('gaming.newPeriodEndTime') + ' ' + t('gaming.required'), 'error');
      return;
    }

    try {
      setIsUpdatingPeriodTime(true);

      // ????? ????? ?????? ?? ??????? ??????? ??????? ??? UTC
      const localStartDateTime = dayjs.tz(newPeriodStartTime, timezone);
      const localEndDateTime = newPeriodEndTime ? dayjs.tz(newPeriodEndTime, timezone) : null;

      // ?????? ?? ?? ??? ??????? ??? ??? ????? ??????
      const sessionStartTime = dayjs(selectedSessionForPeriodEdit.startTime).tz(timezone);
      if (localStartDateTime.isBefore(sessionStartTime)) {
        showNotification(t('gaming.periodTimeUpdatedError'), 'error');
        return;
      }

      // ?????? ?? ?? ??? ??????? ??? ??? ???????
      if (localEndDateTime && localEndDateTime.isBefore(localStartDateTime)) {
        showNotification(t('gaming.periodTimeUpdatedError'), 'error');
        return;
      }

      // ????? ??? UTC ??????? ???????
      const utcStartDateTime = localStartDateTime.utc().toISOString();
      const utcEndDateTime = localEndDateTime ? localEndDateTime.utc().toISOString() : undefined;

      // ????? ???????? ??????? - ???? ????? ??????? ???????? ???????? ?? ???????
      await api.updateControllersPeriodTime(
        selectedSessionForPeriodEdit.id,
        selectedPeriodIndex,
        utcStartDateTime,
        utcEndDateTime
      );

      showNotification(t('gaming.periodTimeUpdatedSuccess'), 'success');

      // ????? ????? ??????? ?????? ????????
      await fetchSessions();
      await fetchBills();
      
      // ????? ??????? ?????? ????????
      setShowEditPeriodTimeModal(false);
      setSelectedSessionForPeriodEdit(null);
      setSelectedPeriodIndex(0);
      setNewPeriodStartTime('');
      setNewPeriodEndTime('');

    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || t('gaming.periodTimeUpdatedError');
      showNotification(errorMessage, 'error');
    } finally {
      setIsUpdatingPeriodTime(false);
    }
  };

  // ??? ?????? ??????
  const handleLinkTableToSession = async (session: Session, tableId: string | null) => {
    if (!tableId) {
      showNotification(t('gaming.pleaseSelectTable'), 'warning');
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
          message = t('gaming.tableChangedSuccess', { 
            oldTable: formatDecimal(changeData.oldTable, i18n.language), 
            newTable: formatDecimal(changeData.newTable, i18n.language) 
          });
        } else {
          const billData = result.data?.bill;
          message = t('gaming.tableLinkedSuccess', { table: formatDecimal(tableNumber, i18n.language) });
          
          if (billData && billData.sessionsCount > 1) {
            const mergedMessage = t('gaming.billsMerged', { count: billData.sessionsCount }).replace(billData.sessionsCount.toString(), formatDecimal(billData.sessionsCount, i18n.language));
            message += ` (${mergedMessage})`;
          }
        }
        
        showNotification(message, 'success');
        
        await Promise.all([fetchBills(), loadDevices(), fetchSessions()]);
        setShowLinkTableModal(false);
        setSelectedSessionForLink(null);
      } else {
        const errorMessage = result.message || (isCurrentlyLinkedToTable ? t('gaming.tableChangeError') : t('gaming.tableLinkError'));
        showNotification(errorMessage, 'error');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('gaming.tableLinkError');
      const actionText = isCurrentlyLinkedToTable ? t('gaming.changeTable') : t('gaming.linkTable');
      showNotification(`${actionText}: ${errorMsg}`, 'error');
    } finally {
      setLinkingTable(false);
    }
  };

  // ?? ??? ?????? ?? ???????
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
          t('gaming.tableUnlinkedSuccess', { table: formatDecimal(tableNumber, i18n.language) }),
          'success'
        );

        await Promise.all([fetchBills(), fetchSessions(), loadDevices()]);

        setShowUnlinkTableModal(false);
        setSelectedSessionForUnlink(null);
        setCustomerNameForUnlink('');
      } else {
        showNotification(t('gaming.tableUnlinkError'), 'error');
      }
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        t('gaming.tableUnlinkError');
      showNotification(errorMsg, 'error');
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
                <Plus className={`h-5 w-5 ${isRTL ? 'mr-2' : 'ml-2'}`} />
                {t('gaming.addDevice')}
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
            {t('gaming.loading')}
          </p>
          <p className="text-sm mt-1" style={{ color: deviceType === 'playstation' ? '#2563eb' : '#ea580c' }}>
            {t('gaming.pleaseWait')}
          </p>
        </div>
      )}

      {/* Error State */}
      {loadingError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className={`w-5 h-5 text-red-600 dark:text-red-400 ${isRTL ? 'ml-2' : 'mr-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-red-800 dark:text-red-200 font-medium">{loadingError}</p>
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">{t('gaming.checkConnection')}</p>
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center"
            >
              <svg className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('gaming.retry')}
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
                        {t('gaming.active')}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-500 to-slate-500 text-white text-xs font-bold rounded-full shadow-lg border-4 border-white dark:border-gray-800">
                        {t('gaming.available')}
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
                              <span className="text-sm font-bold text-blue-900 dark:text-blue-100">{formatDecimal(activeSession.controllers ?? 1, i18n.language)} {t('gaming.controllers')}</span>
                            </div>

                            {/* ????? ???????? */}
                            {activeSession.controllersHistory && activeSession.controllersHistory.length > 0 && (
                              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 p-4 rounded-xl border-2 border-purple-300 dark:border-purple-700 shadow-sm">
                                <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  {t('gaming.controllersHistory')}
                                </h4>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                  {activeSession.controllersHistory.map((period, index) => {
                                    const isCurrentPeriod = !period.to;
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
                                              {formatDecimal(period.controllers, i18n.language)} {t('gaming.controllers')}
                                            </span>
                                            {isCurrentPeriod && (
                                              <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full animate-pulse">
                                                {t('gaming.active')}
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                            {t('gaming.from')}: {formatDateTime(period.from)}
                                            {period.to && (
                                              <span> - {t('gaming.to')}: {formatDateTime(period.to)}</span>
                                            )}
                                          </div>
                                        </div>

                                        {/* ?? ????? ??? ?????? */}
                                        <button
                                          onClick={() => openEditPeriodTimeModal(activeSession, index)}
                                          className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 flex items-center justify-center"
                                          title={t('gaming.editStartTime')}
                                        >
                                          <Edit className="h-3 w-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* ????? ????? ??? ?????? */}
                            <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 p-4 rounded-xl border-2 border-orange-300 dark:border-orange-700">
                              <p className="text-xs font-bold text-orange-900 dark:text-orange-100 mb-3 text-center">{t('gaming.editControllers')}</p>
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                                  disabled={(activeSession.controllers ?? 1) <= 1 || updatingControllers[activeSession.id]}
                                  onClick={() => openControllersEditor(activeSession)}
                                  title={t('gaming.editControllers')}
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
                                  title={t('gaming.editControllers')}
                                >
                                  <span className="font-bold text-xl text-orange-600 dark:text-orange-400 block text-center">
                                    {formatDecimal(activeSession.controllers ?? 1, i18n.language)}
                                  </span>
                                  <span className="text-xs text-gray-600 dark:text-gray-400 block text-center">{t('gaming.controllers')}</span>
                                </button>
                                <button
                                  className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                                  disabled={(activeSession.controllers ?? 1) >= 4 || updatingControllers[activeSession.id]}
                                  onClick={() => openControllersEditor(activeSession)}
                                  title={t('gaming.editControllers')}
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

                        {/* ??? ???? ??? ??????? ??? (???? ?????) */}
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
                                  <TableIcon className={`h-4 w-4 ${isRTL ? 'mr-1' : 'ml-1'}`} />
                                  {t('gaming.linkedToTable')}: {formatDecimal(billTableNumber, i18n.language)}
                                </div>
                              ) : (
                                <div className="flex items-center text-gray-500 dark:text-gray-400">
                                  <TableIcon className={`h-4 w-4 ${isRTL ? 'mr-1' : 'ml-1'}`} />
                                  {t('gaming.notLinkedToTable')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : device.status === 'maintenance' ? (
                      <div className="text-center py-4">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{t('gaming.maintenance')}</p>
                      </div>
                    ) : device.status === 'unavailable' ? (
                      <div className="text-center py-4">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{t('gaming.unavailable')}</p>
                      </div>
                    ) : null}
                  </div>

                  {/* ??????? ?????? ?? ????? ?????? */}
                  <div className="mt-4 space-y-2">
                    {activeSession ? (
                      <>
                        {/* ????? ?????? ?????? ?????? */}
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
                                  {t('gaming.editStartTime')}
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedSessionForLink(activeSession);
                                    setShowLinkTableModal(true);
                                  }}
                                  className="px-3 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-1"
                                >
                                  <TableIcon className="h-4 w-4" />
                                  {t('gaming.changeTable')}
                                </button>
                              </div>

                              <div className="mb-2">
                                <button
                                  onClick={() => {
                                    setSelectedSessionForUnlink(activeSession);
                                    // ????? ??? ?????? ????????? ????? ??? ????? ???????
                                    const translatedName = translateDefaultCustomerName(
                                      activeSession.customerName || '',
                                      activeSession.deviceType,
                                      activeSession.deviceNumber,
                                      t
                                    );
                                    setCustomerNameForUnlink(translatedName);
                                    setShowUnlinkTableModal(true);
                                  }}
                                  className="w-full px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-1"
                                >
                                  <X className="h-4 w-4" />
                                  {t('gaming.unlinkTable')}
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
                                {t('gaming.editStartTime')}
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedSessionForLink(activeSession);
                                  setShowLinkTableModal(true);
                                }}
                                className="px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-1"
                              >
                                <TableIcon className="h-4 w-4" />
                                {t('gaming.linkTable')}
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
                              <svg className={`animate-spin h-5 w-5 text-white ${isRTL ? 'ml-2' : 'mr-2'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {t('gaming.ending')}
                            </>
                          ) : (
                            <>
                              <Square className={`h-5 w-5 ${isRTL ? 'mr-2' : 'ml-2'}`} />
                              {t('gaming.endSession')}
                            </>
                          )}
                        </button>
                      </>
                    ) : device.status === 'available' ? (
                      <button
                        onClick={() => openSessionModal(device)}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 px-4 rounded-xl flex items-center justify-center transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <Play className={`h-5 w-5 ${isRTL ? 'mr-2' : 'ml-2'}`} />
                        {t('gaming.startSession')}
                      </button>
                    ) : (
                      <div className="w-full py-3 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-center text-sm font-semibold">
                        {t('gaming.unavailable')}
                      </div>
                    )}
                  </div>

                  {/* ????? ??????? ?????? - ?????? ??? */}
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
                        title={isActive ? t('gaming.cannotEditActiveDevice') : t('gaming.editDevice')}
                      >
                        <Edit className="h-4 w-4" />
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDeleteDevice(device)}
                        disabled={isActive}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-2 ${
                          isActive
                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white'
                        }`}
                        title={isActive ? t('gaming.cannotDeleteActiveDevice') : t('gaming.deleteDevice')}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('common.delete')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ????? ????? ???? ???? */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border-2 ${config.colors.headerBorder}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('gaming.addNewDevice')}</h2>
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
                  {t('gaming.deviceName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder={t('gaming.deviceNamePlaceholder')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('gaming.deviceNumber')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={newDevice.number}
                  onChange={(e) => setNewDevice({ ...newDevice, number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder={t('gaming.deviceNumberPlaceholder')}
                  required
                  min="1"
                />
              </div>

              {deviceType === 'playstation' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('gaming.defaultControllers')}
                    </label>
                    <select
                      value={newDevice.controllers}
                      onChange={(e) => setNewDevice({ ...newDevice, controllers: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      {[1, 2, 3, 4].map(num => (
                        <option key={num} value={num}>{formatDecimal(num, i18n.language)} {t('gaming.controllers')}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('gaming.hourlyRateFor')} {t('gaming.controllers')}
                    </label>
                    {[1, 2, 3, 4].map(num => (
                      <div key={num} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
                          {formatDecimal(num, i18n.language)} {t('gaming.controllers')}:
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
                        <span className="text-sm text-gray-600 dark:text-gray-400">{currencySymbol}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('gaming.hourlyRate')} <span className="text-red-500">*</span>
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
                    <span className="text-sm text-gray-600 dark:text-gray-400">{currencySymbol}</span>
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
                  {t('common.cancel')}
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
                  {isAddingDevice ? t('common.adding') : t('common.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ????? ????? ???? */}
      {showEditDevice && editingDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border-2 ${config.colors.headerBorder}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('gaming.editDevice')}</h2>
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
                showNotification(t('gaming.deviceUpdatedSuccess'), 'success');
              } catch (error) {
                showNotification(t('gaming.deviceUpdatedError'), 'error');
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('gaming.deviceName')} <span className="text-red-500">*</span>
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
                  {t('gaming.deviceNumber')} <span className="text-red-500">*</span>
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
                    {t('gaming.hourlyRateForControllers')}
                  </label>
                  {[1, 2, 3, 4].map(num => (
                    <div key={num} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
                        {formatDecimal(num, i18n.language)} {t('gaming.controllers')}:
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
                      <span className="text-sm text-gray-600 dark:text-gray-400">{currencySymbol}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('gaming.hourlyRate')} <span className="text-red-500">*</span>
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
                    <span className="text-sm text-gray-600 dark:text-gray-400">{currencySymbol}</span>
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors duration-200"
                >
                  {t('common.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ????? ????? ??? ?????? */}
      {showDeleteConfirm && deviceToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">{t('gaming.confirmDeleteDevice')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('gaming.confirmDeleteDevice')} "{deviceToDelete.name}"? {t('common.cannotUndo')}.
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
                {t('gaming.cancel')}
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
                {isDeletingDevice ? t('gaming.deleting') : t('gaming.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ????? ??? ???? ????? */}
      {showNewSession && selectedDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className={`bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border-2 ${config.colors.headerBorder} animate-bounce-in`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Play className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {t('gaming.startSession')}
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
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{t('gaming.selectedDevice')}</p>
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{selectedDevice.name}</p>
                </div>
              </div>
            </div>

            {/* ??? ?????? (???????) */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <TableIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                {t('gaming.linkTableOptional')}
              </label>
              <select
                value={selectedTable || ''}
                onChange={(e) => setSelectedTable(e.target.value || null)}
                className="w-full px-4 py-3 border-2 border-purple-300 dark:border-purple-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100 transition-all shadow-sm hover:shadow-md"
              >
                <option value="">{t('gaming.noTable')}</option>
                {tables.filter((t: any) => t.isActive).sort((a: any, b: any) => {
                  return String(a.number).localeCompare(String(b.number), 'ar', { numeric: true });
                }).map((table: any) => (
                  <option key={table.id || table._id} value={table._id}>
                    {t('gaming.table')} {table.number}
                  </option>
                ))}
              </select>
            </div>

            {/* ??? ???????? - ??????????? ??? */}
            {deviceType === 'playstation' && (
              <div className="mb-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-xl border-2 border-green-200 dark:border-green-800">
                <label className="block text-sm font-bold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('gaming.selectControllers')} <span className="text-red-500">*</span>
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
                      <span className="text-lg font-bold block">{formatDecimal(num, i18n.language)}</span>
                      <div className={`text-xs mt-1 font-semibold ${selectedControllers === num ? 'text-green-100' : 'text-gray-600 dark:text-gray-400'}`}>
                        {selectedDevice.playstationRates && selectedDevice.playstationRates[num] ? `${formatCurrency(selectedDevice.playstationRates[num], i18n.language)}/${t('dashboard.hours')}` : '-'}
                      </div>
                    </button>
                  ))}
                </div>
                {!selectedControllers && (
                  <p className="text-xs text-green-700 dark:text-green-300 mt-3 text-center font-semibold">
                    ?? {t('gaming.pleaseSelectControllers')}
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
                {t('common.cancel')}
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
                    {t('gaming.starting')}
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 ml-2" />
                    {t('gaming.startSession')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ????? ??? ?????? ?????? */}
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
                    return isCurrentlyLinkedToTable ? t('gaming.changeTableTitle') : t('gaming.linkTableTitle');
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
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{t('gaming.device')}</p>
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
                      <p className="text-xs text-green-600 dark:text-green-400 font-semibold">{t('gaming.bill')}</p>
                      <p className="text-sm font-bold text-green-900 dark:text-green-100">
                        #{typeof selectedSessionForLink.bill === 'object' ? (selectedSessionForLink.bill as any)?.billNumber : t('gaming.unknown')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                <TableIcon className="h-5 w-5" />
                {t('gaming.selectTableLabel')}
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
                <option value="">{t('gaming.noTable')}</option>
                {tables.filter((t: any) => t.isActive).sort((a: any, b: any) => {
                  return String(a.number).localeCompare(String(b.number), 'ar', { numeric: true });
                }).map((table: any) => (
                  <option key={table.id || table._id} value={table._id}>
                    {t('gaming.table')} {table.number}
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
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ????? ?? ??? ?????? ?? ??????? */}
      {showUnlinkTableModal && selectedSessionForUnlink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('gaming.unlinkTableTitle')}</h2>
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
                {t('gaming.device')}: {devices.find(d => d.number === selectedSessionForUnlink.deviceNumber)?.name || selectedSessionForUnlink.deviceName}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {t('gaming.currentTable')}: {(() => {
                  const bill = typeof selectedSessionForUnlink.bill === 'object' ? selectedSessionForUnlink.bill : null;
                  const billTable = bill ? (bill as any)?.table : null;
                  return billTable?.number || t('gaming.unknown');
                })()}
              </p>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ?? {t('gaming.unlinkWarningMessage')}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('gaming.customerName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerNameForUnlink}
                onChange={(e) => setCustomerNameForUnlink(e.target.value)}
                placeholder={t('gaming.customerNamePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={unlinkingTable}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('gaming.newBillNameNote')}
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
                {t('gaming.cancel')}
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
                    <svg className={`animate-spin h-5 w-5 text-white ${isRTL ? 'ml-2' : 'mr-2'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('gaming.unlinking')}
                  </>
                ) : (
                  <>
                    <X className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('gaming.unlink')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ????? ????? ??? ??? ?????? */}
      {showEditStartTimeModal && selectedSessionForEditTime && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('gaming.editStartTimeTitle')}</h2>
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
                {t('gaming.device')}: {devices.find(d => d.number === selectedSessionForEditTime.deviceNumber)?.name || selectedSessionForEditTime.deviceName}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('gaming.newStartTime')} <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={isUpdatingStartTime}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('gaming.cannotEditFutureTime')}
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
                {t('gaming.cancel')}
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
                    <svg className={`animate-spin h-5 w-5 text-white ${isRTL ? 'ml-2' : 'mr-2'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('gaming.updating')}
                  </>
                ) : (
                  <>
                    <Edit className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('gaming.saveChanges')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ????? ????? ????? ??? ?????? */}
      {showControllersConfirm && controllersChangeData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border-2 border-orange-200 dark:border-orange-800 animate-bounce-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('gaming.confirmControllersChange')}</h2>
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
              {/* {t('gaming.deviceInfo')} */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4 shadow-sm">
                <p className="text-blue-900 dark:text-blue-100 font-bold mb-2 flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('gaming.sessionInfo', { device: controllersChangeData.deviceName })}
                </p>
                <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('gaming.currentCount')}:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{formatDecimal(controllersChangeData.oldCount, i18n.language)} {t('gaming.controllers')}</span>
                </div>
              </div>

              {/* ?????? ??? ?????? */}
              <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-4 shadow-sm">
                <p className="text-orange-900 dark:text-orange-100 font-bold mb-3 text-center">{t('gaming.selectNewCount')}</p>
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
                        {formatDecimal(count, i18n.language)}
                      </button>
                    );
                  })}
                </div>
                {controllersChangeData.newCount !== controllersChangeData.oldCount && (
                  <div className="mt-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-orange-200 dark:border-orange-600">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('gaming.change')}:</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">
                        {controllersChangeData.newCount > controllersChangeData.oldCount
                          ? `+${formatDecimal(controllersChangeData.newCount - controllersChangeData.oldCount, i18n.language)} ${t('gaming.controllers')}`
                          : `${formatDecimal(controllersChangeData.newCount - controllersChangeData.oldCount, i18n.language)} ${t('gaming.controllers')}`
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ????? ????? ?????? */}
              {controllersChangeData.newCount !== controllersChangeData.oldCount && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-yellow-900 dark:text-yellow-100 font-semibold flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {t('gaming.recalculateWarning')}
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
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmUpdateControllers}
                disabled={controllersChangeData.newCount === controllersChangeData.oldCount || updatingControllers[controllersChangeData.sessionId]}
                className="px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {updatingControllers[controllersChangeData.sessionId] ? (
                  <>
                    <div className={`h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`}></div>
                    {t('gaming.updating')}
                  </>
                ) : (
                  <>
                    <Users className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('gaming.confirmChange')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ????? ????? ??? ???? ???????? */}
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
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('gaming.editPeriodTimeTitle')}</h3>
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

            {/* ??????? ?????? ??????? */}
            <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
              <h4 className="font-bold text-purple-900 dark:text-purple-100 mb-2">{t('gaming.periodInfo')}</h4>
              {selectedSessionForPeriodEdit.controllersHistory && selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex] && (() => {
                const period = selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex];
                const isActivePeriod = !period.to;
                const controllersHistory = selectedSessionForPeriodEdit.controllersHistory;

                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">{t('gaming.controllersCount')}:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatDecimal(period.controllers, i18n.language)} {t('gaming.controllers')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">{t('gaming.periodStatus')}:</span>
                      <span className={`font-medium ${isActivePeriod ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {isActivePeriod ? t('gaming.activePeriod') : t('gaming.endedPeriod')}
                      </span>
                    </div>
                    {!isActivePeriod && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">{t('gaming.currentEndTime')}:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {formatDateTime(new Date(period.to))}
                        </span>
                      </div>
                    )}

                    {/* ??????? ??????? ???????? */}
                    <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-600">
                      <h5 className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-2">{t('gaming.adjacentPeriods')}:</h5>
                      <div className="space-y-1 text-xs">
                        {selectedPeriodIndex > 0 && (
                          <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded">
                            <span>{t('gaming.previousPeriod')} ({formatDecimal(controllersHistory[selectedPeriodIndex - 1].controllers, i18n.language)} {t('gaming.controllers')}):</span>
                            <span className="font-medium">
                              {controllersHistory[selectedPeriodIndex - 1].to
                                ? `${t('gaming.ends')}: ${formatDateTime(new Date(controllersHistory[selectedPeriodIndex - 1].to))}`
                                : t('gaming.activePeriod')
                              }
                            </span>
                          </div>
                        )}
                        {selectedPeriodIndex < controllersHistory.length - 1 && (
                          <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/30 rounded">
                            <span>{t('gaming.nextPeriod')} ({formatDecimal(controllersHistory[selectedPeriodIndex + 1].controllers, i18n.language)} {t('gaming.controllers')}):</span>
                            <span className="font-medium">
                              {t('gaming.starts')}: {formatDateTime(new Date(controllersHistory[selectedPeriodIndex + 1].from))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ???? ??????? */}
            <div className="space-y-4 mb-6">
              {/* ??? ??????? */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  {t('gaming.newPeriodStartTime')}
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
                      {t('gaming.newPeriodStartTime')}: {formatDateTime(new Date(newPeriodStartTime))}
                    </p>
                  </div>
                )}
              </div>

              {/* ??? ??????? - ???? ??? ??????? ???????? */}
              {selectedSessionForPeriodEdit.controllersHistory &&
                selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex] &&
                selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex].to && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    {t('gaming.newPeriodEndTime')}
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
                        {t('gaming.newPeriodEndTime')}: {formatDateTime(new Date(newPeriodEndTime))}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ????? */}
            <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ?? {t('gaming.periodTimeWarning')}
              </p>
              {selectedSessionForPeriodEdit.controllersHistory &&
                selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex] &&
                !selectedSessionForPeriodEdit.controllersHistory[selectedPeriodIndex].to && (
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  ?? {t('gaming.activePeriodInfo')}
                </p>
              )}
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-600">
                <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                  {t('gaming.autoAdjustTitle')}:
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                  <li>? {t('gaming.autoAdjustStart')}</li>
                  <li>? {t('gaming.autoAdjustEnd')}</li>
                  <li>? {t('gaming.autoAdjustNoGaps')}</li>
                </ul>
              </div>
            </div>

            {/* ??????? */}
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
                {t('gaming.cancel')}
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
                    <svg className={`animate-spin h-5 w-5 text-white ${isRTL ? 'ml-2' : 'mr-2'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('gaming.updating')}
                  </>
                ) : (
                  <>
                    <Clock className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('gaming.updateTime')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ????? ????? ????? ?????? */}
      {showEndSessionConfirm && sessionToEnd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border-2 border-red-200 dark:border-red-800 animate-bounce-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Square className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {t('gaming.confirmEndSession')}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowEndSessionConfirm(false);
                  setSessionToEnd(null);
                  setCustomerNameForEnd('');
                }}
                className="w-10 h-10 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:scale-110 transform shadow-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{t('gaming.device')}</p>
                </div>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{sessionToEnd.deviceName}</p>
              </div>

              <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border-2 border-purple-300 dark:border-purple-700 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <label className="text-sm text-purple-600 dark:text-purple-400 font-semibold">
                    {t('gaming.customerName')} <span className="text-red-500">*</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={customerNameForEnd}
                  onChange={(e) => setCustomerNameForEnd(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-purple-300 dark:border-purple-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100 font-medium"
                  placeholder={t('gaming.customerNamePlaceholder')}
                  disabled={endingSessions[sessionToEnd.id]}
                />
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                  {t('gaming.customerNameNote')}
                </p>
              </div>

              <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
                  ?? {t('gaming.endSessionWarning')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEndSessionConfirm(false);
                  setSessionToEnd(null);
                  setCustomerNameForEnd('');
                }}
                disabled={endingSessions[sessionToEnd.id]}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-600 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-all duration-200 font-bold shadow-md hover:shadow-lg transform hover:scale-105"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmEndSession}
                disabled={endingSessions[sessionToEnd.id] || !customerNameForEnd.trim()}
                className={`flex-1 px-4 py-3 rounded-xl text-white transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2 ${
                  endingSessions[sessionToEnd.id] || !customerNameForEnd.trim()
                    ? 'bg-red-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700'
                }`}
              >
                {endingSessions[sessionToEnd.id] ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('gaming.ending')}
                  </>
                ) : (
                  <>
                    <Square className="h-5 w-5" />
                    {t('gaming.endSession')}
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
