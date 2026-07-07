import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { api, Order } from '../services/api';
import { io, Socket } from 'socket.io-client';
import { Clock, ChefHat, Bell, RefreshCw, AlertCircle, Layers, Check } from 'lucide-react';

const SOUND_URL = '/sounds/new-order.mp3';
const STATUS_COLUMNS = ['pending', 'preparing', 'ready'] as const;

interface MenuSection {
  _id: string;
  name: string;
}

const VISIBLE_STATUSES = ['pending', 'preparing', 'ready'];

const CARD_BORDER_COLORS = [
  'border-s-4 border-orange-500',
  'border-s-4 border-cyan-500',
  'border-s-4 border-purple-500',
  'border-s-4 border-pink-500',
  'border-s-4 border-indigo-500',
  'border-s-4 border-teal-500',
];

export function KitchenDisplay() {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.getOrders({ status: 'pending,preparing,ready' });
      if (res.success && res.data) setOrders(res.data);
    } catch { }
  }, []);

  const fetchSections = useCallback(async () => {
    try {
      const res = await api.getMenuSections();
      if (res.success && res.data) setSections(res.data);
    } catch { }
  }, []);

  useEffect(() => {
    Promise.all([fetchOrders(), fetchSections()]).then(() => setLoading(false));
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchSections]);

  useEffect(() => {
    if (socketRef.current) return;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socketUrl = apiUrl.replace(/\/api\/?$/, '');
    const socket = io(socketUrl, { transports: ['websocket', 'polling'], reconnection: true });
    socketRef.current = socket;

    socket.emit('join-role', 'kitchen');

    socket.on('new-order', (data: Order) => {
      setOrders(prev => [data, ...prev.filter(o => o._id !== data._id)]);
      setNewOrderAlert(true);
      setTimeout(() => setNewOrderAlert(false), 5000);
      try { audioRef.current?.play(); } catch { }
    });

    socket.on('order-update', (data: { type: string; order: Order }) => {
      if (data.type === 'created') {
        setOrders(prev => [data.order, ...prev.filter(o => o._id !== data.order._id)]);
      } else if (data.type === 'status-changed' || data.type === 'updated') {
        const status = data.order.status;
        if (status && VISIBLE_STATUSES.includes(status)) {
          setOrders(prev => {
            const filtered = prev.filter(o => o._id !== data.order._id);
            return [...filtered, data.order];
          });
        } else {
          setOrders(prev => prev.filter(o => o._id !== data.order._id));
        }
      } else if (data.type === 'deleted') {
        setOrders(prev => prev.filter(o => o._id !== data.order._id));
      }
    });

    return () => {
      if (import.meta.env.DEV) {
        socket.off('new-order');
        socket.off('order-update');
      } else {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const res = await api.updateOrderStatus(orderId, newStatus as any);
      if (!res.success) return;
      setOrders(prev =>
        newStatus && VISIBLE_STATUSES.includes(newStatus)
          ? prev.map(o => o._id === orderId ? { ...o, status: newStatus as Order['status'] } : o)
          : prev.filter(o => o._id !== orderId)
      );
    } catch { }
  };

  const handleItemToggle = async (orderId: string, item: Order['items'][number]) => {
    const order = orders.find(o => o._id === orderId);
    if (!order) return;
    const itemIndex = order.items.findIndex(oi => oi._id === item._id);
    if (itemIndex === -1) return;
    const current = order.items[itemIndex];
    const newCount = (current.preparedCount ?? 0) >= (current.quantity ?? 1) ? 0 : (current.quantity ?? 1);
    const res = await api.updateOrderItemPrepared(orderId, itemIndex, { preparedCount: newCount });
    if (!res.success) return;
    const fetchRes = await api.getOrders({ status: 'pending,preparing,ready' });
    if (fetchRes.success && fetchRes.data) setOrders(fetchRes.data);
  };

  const handleSectionDeliver = async (orderId: string, sectionId: string) => {
    const res = await api.deliverOrderSection(orderId, sectionId);
    if (!res.success) return;
    const data = res.data;
    if (!data) return;
    setOrders(prev => {
      const order = data;
      const hasUndeliveredItems = order.items.some(
        (item: any) => (item.deliveredCount || 0) < (item.quantity || 0)
      );
      if (!hasUndeliveredItems) {
        return prev.filter(o => o._id !== orderId);
      }
      return prev.map(o => o._id === orderId ? order : o);
    });
  };

  const handleSectionAction = async (orderId: string, sectionId: string, action: 'prepare' | 'ready') => {
    if (action === 'prepare') {
      await handleStatusChange(orderId, 'preparing');
      return;
    }
    const order = orders.find(o => o._id === orderId);
    if (!order) return;
    const itemIndices = order.items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => {
        const s = getOrderItemSection(item);
        return s === sectionId && (item.deliveredCount ?? 0) < (item.quantity ?? 0);
      });
    if (itemIndices.length === 0) return;
    try {
      for (const { item, idx } of itemIndices) {
        const newCount = item.quantity;
        const res = await api.updateOrderItemPrepared(orderId, idx, { preparedCount: newCount });
        if (!res.success) break;
      }
      const fetchRes = await api.getOrders({ status: 'pending,preparing,ready' });
      if (fetchRes.success && fetchRes.data) setOrders(fetchRes.data);
    } catch { }
  };

  const getElapsed = (createdAt: Date) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const totalMinutes = Math.floor(diff / 60000);
    if (totalMinutes < 60) return t('common.elapsedMinutes', { minutes: formatNumber(totalMinutes) });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return t('common.elapsedHours', { hours: formatNumber(hours), minutes: formatNumber(minutes) });
  };

  const formatNumber = (num: number) => new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-SA' : i18n.language).format(num);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 dark:bg-yellow-900/10';
      case 'preparing': return 'bg-blue-50 dark:bg-blue-900/10';
      case 'ready': return 'bg-green-50 dark:bg-green-900/10';
      default: return '';
    }
  };

  const getSectionName = (sectionId: string) => {
    const section = sections.find(s => s._id === sectionId);
    return section ? section.name : t('kitchenDisplay.unknownSection');
  };

  const getOrderItemSection = (item: Order['items'][number]): string | null => {
    return item.section || null;
  };

  const visibleOrders = useMemo(() =>
    orders
      .filter(o => o.status && VISIBLE_STATUSES.includes(o.status))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  [orders]);

  const getSectionStatus = (order: Order, sectionId: string): string | null => {
    const sectionItems = order.items.filter(item => {
      const s = getOrderItemSection(item);
      return s === sectionId && (item.deliveredCount ?? 0) < (item.quantity ?? 0);
    });
    if (sectionItems.length === 0) return null;
    const anyPrepared = sectionItems.some(item => (item.preparedCount ?? 0) > 0);
    const allPrepared = sectionItems.every(item => (item.preparedCount ?? 0) >= (item.quantity ?? 0));
    if (allPrepared) return 'ready';
    if (anyPrepared) return 'preparing';
    if (order.status === 'preparing') return 'preparing';
    return 'pending';
  };

  const getOrderAggregateStatus = (order: Order): string => {
    const items = order.items.filter(
      item => (item.deliveredCount ?? 0) < (item.quantity ?? 0)
    );
    if (items.length === 0) return 'ready';
    const anyPending = items.some(item => (item.preparedCount ?? 0) === 0);
    const anyPreparing = items.some(
      item => (item.preparedCount ?? 0) > 0 && (item.preparedCount ?? 0) < (item.quantity ?? 0)
    );
    if (anyPending) return 'pending';
    if (anyPreparing) return 'preparing';
    return 'ready';
  };

  const sectionOrders = visibleOrders
    .map(order => {
      if (selectedSection === 'all') return order;
      const filteredItems = order.items.filter(item => {
        const itemSection = getOrderItemSection(item);
        return itemSection === selectedSection && (item.deliveredCount ?? 0) < (item.quantity ?? 0);
      });
      if (filteredItems.length === 0) return null;
      return { ...order, items: filteredItems };
    })
    .filter(Boolean) as Order[];

  const statusOrders = (status: string) =>
    selectedSection === 'all'
      ? sectionOrders.filter(o => getOrderAggregateStatus(o) === status)
      : sectionOrders.filter(o => getSectionStatus(o, selectedSection) === status);

  const getSectionOrderCount = useCallback((sectionId: string) => {
    if (sectionId === 'all') return visibleOrders.length;
    return visibleOrders.filter(o =>
      o.items.some(item => {
        const matchesSection = getOrderItemSection(item) === sectionId;
        const notDelivered = (item.deliveredCount ?? 0) < (item.quantity ?? 1);
        return matchesSection && notDelivered;
      })
    ).length;
  }, [visibleOrders]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <audio ref={audioRef} src={SOUND_URL} preload="none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <ChefHat className="h-7 w-7 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('kitchenDisplay.title')}</h1>
          {newOrderAlert && (
            <span className="flex items-center gap-1 text-sm bg-red-500 text-white px-3 py-1 rounded-full animate-pulse">
              <Bell className="h-4 w-4" /> {t('kitchenDisplay.newOrder')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setSelectedSection('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedSection === 'all'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <Layers className="h-4 w-4" />
            {t('kitchenDisplay.allSections')}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              selectedSection === 'all' ? 'bg-white/20' : 'bg-gray-300 dark:bg-gray-600'
            }`}>{formatNumber(getSectionOrderCount('all'))}</span>
          </button>
          {sections.map(s => (
            <button
              key={s._id}
              onClick={() => setSelectedSection(s._id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedSection === s._id
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {s.name}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                selectedSection === s._id ? 'bg-white/20' : 'bg-gray-300 dark:bg-gray-600'
              }`}>{formatNumber(getSectionOrderCount(s._id))}</span>
            </button>
          ))}
          <button onClick={fetchOrders} className="p-2 text-gray-500 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors flex-shrink-0" title={t('common.refresh')}>
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Status Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUS_COLUMNS.map(status => {
          const items = statusOrders(status);
          return (
            <div key={status} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className={`px-4 py-3 font-bold text-sm flex items-center justify-between ${
                status === 'pending' ? 'bg-yellow-500 text-white' :
                status === 'preparing' ? 'bg-blue-500 text-white' :
                'bg-green-500 text-white'
              }`}>
                <span>{t(`kitchenDisplay.${status}`)}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{formatNumber(items.length)}</span>
              </div>
              <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto p-2">
                {items.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 dark:text-gray-500 text-sm rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {t('kitchenDisplay.noOrders')}
                  </div>
                ) : items.map((order, idx) => (
                  <div key={order._id} className={`p-3 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 ${CARD_BORDER_COLORS[idx % CARD_BORDER_COLORS.length]} ${getStatusColor(status)}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-extrabold text-base text-gray-900 dark:text-gray-100 tracking-tight">
                          #{order.orderNumber || order._id.slice(-6)}
                        </span>
                        {order.table && (
                          <span className="inline-flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-sm font-bold px-2.5 h-7 rounded-md">
                            {(() => {
                              const tn = order.table.number;
                              const nm = order.table.name;
                              if (tn != null) {
                                if (!Number.isNaN(Number(tn))) return formatNumber(Number(tn));
                                return tn;
                              }
                              return nm || '';
                            })()}
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">
                        <Clock className="h-3.5 w-3.5" />
                        {getElapsed(order.createdAt)}
                      </span>
                    </div>

                    {selectedSection === 'all' ? (
                      <GroupedItemsBySection order={order} sections={sections} getSectionName={getSectionName} onItemToggle={handleItemToggle} onSectionAction={handleSectionAction} onSectionDeliver={handleSectionDeliver} />
                    ) : (
                      <ul className="space-y-1 mb-3">
                        {order.items.map((item, i) => {
                          const isItemPrepared = (item.preparedCount ?? 0) >= (item.quantity ?? 1);
                          return (
                            <li key={i} className="flex items-center justify-between text-sm py-0.5">
                              <div className="flex items-center gap-2 min-w-0">
                                {status !== 'pending' && (
                                  <label className="flex items-center cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isItemPrepared}
                                      onChange={() => handleItemToggle(order._id, item)}
                                      className="sr-only"
                                    />
                                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                                      isItemPrepared
                                        ? 'bg-green-500 border-green-500 scale-110'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-green-400 hover:shadow-sm'
                                    }`}>
                                      {isItemPrepared && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                    </span>
                                  </label>
                                )}
                                <span className={`text-gray-700 dark:text-gray-300 truncate ${
                                  isItemPrepared ? 'line-through text-gray-400 dark:text-gray-500' : ''
                                }`}>
                                  {i18n.language === 'ar' ? item.arabicName || item.name : item.name}
                                </span>
                              </div>
                              <span className="text-gray-500 font-medium flex-shrink-0 ms-2">{t('common.quantity', { count: formatNumber(item.quantity) })}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {order.notes && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mb-2 bg-orange-50 dark:bg-orange-900/20 p-1.5 rounded">
                        📝 {order.notes}
                      </p>
                    )}

                    {selectedSection !== 'all' && (
                      <div className="flex gap-2">
                        {status === 'pending' && (
                          <button onClick={() => handleSectionAction(order._id, selectedSection, 'prepare')} className="flex-1 text-xs bg-blue-500 hover:bg-blue-600 text-white py-1.5 rounded-lg transition-colors">{t('kitchenDisplay.markPreparing')}</button>
                        )}
                        {status === 'preparing' && (
                          <button onClick={() => handleSectionAction(order._id, selectedSection, 'ready')} className="flex-1 text-xs bg-green-500 hover:bg-green-600 text-white py-1.5 rounded-lg transition-colors">{t('kitchenDisplay.markReady')}</button>
                        )}
                        {status === 'ready' && (
                          <button onClick={() => handleSectionDeliver(order._id, selectedSection)} className="flex-1 text-xs bg-gray-500 hover:bg-gray-600 text-white py-1.5 rounded-lg transition-colors">{t('kitchenDisplay.markDelivered')}</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupedItemsBySection({ order, sections, getSectionName, onItemToggle, onSectionAction, onSectionDeliver }: {
  order: Order;
  sections: MenuSection[];
  getSectionName: (id: string) => string;
  onItemToggle?: (orderId: string, item: Order['items'][number]) => void;
  onSectionAction?: (orderId: string, sectionId: string, action: 'prepare' | 'ready') => void;
  onSectionDeliver?: (orderId: string, sectionId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const formatNumber = (num: number) => new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-SA' : i18n.language).format(num);
  const visibleItems = order.items.filter(item => (item.deliveredCount ?? 0) < (item.quantity ?? 0));
  const grouped = new Map<string, typeof order.items>();
  visibleItems.forEach(item => {
    const sectionId = item.section || '__unknown__';
    const existing = grouped.get(sectionId) || [];
    existing.push(item);
    grouped.set(sectionId, existing);
  });

  const statusBadgeClass: Record<string, string> = {
    pending: 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30',
    preparing: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30',
    ready: 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30',
  };

  const getGroupStatus = (items: typeof order.items): string => {
    const anyPrepared = items.some(item => (item.preparedCount ?? 0) > 0);
    const allPrepared = items.every(item => (item.preparedCount ?? 0) >= (item.quantity ?? 0));
    if (allPrepared) return 'ready';
    if (anyPrepared) return 'preparing';
    if (order.status === 'preparing') return 'preparing';
    return 'pending';
  };

  return (
    <div className="space-y-2 mb-3">
      {Array.from(grouped.entries()).map(([sectionId, items]) => {
        const groupStatus = getGroupStatus(items);
        return (
          <div key={sectionId} className="border border-gray-100 dark:border-gray-700 rounded-lg p-2 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              <Layers className="h-3 w-3" />
              {sectionId === '__unknown__' ? '' : getSectionName(sectionId)}
              <span className={`ms-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusBadgeClass[groupStatus] || ''}`}>
                {t(`kitchenDisplay.${groupStatus}`)}
              </span>
            </div>
            <ul className="space-y-0.5">
              {items.map((item, i) => {
                const isItemPrepared = (item.preparedCount ?? 0) >= (item.quantity ?? 1);
                return (
                  <li key={i} className="flex items-center justify-between text-sm py-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {groupStatus !== 'pending' && onItemToggle && (
                        <label className="flex items-center cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isItemPrepared}
                            onChange={() => onItemToggle(order._id, item)}
                            className="sr-only"
                          />
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                            isItemPrepared
                              ? 'bg-green-500 border-green-500 scale-110'
                              : 'border-gray-300 dark:border-gray-600 hover:border-green-400 hover:shadow-sm'
                          }`}>
                            {isItemPrepared && <Check className="w-3 h-3 text-white stroke-[3]" />}
                          </span>
                        </label>
                      )}
                      <span className={`text-gray-700 dark:text-gray-300 truncate ${
                        isItemPrepared ? 'line-through text-gray-400 dark:text-gray-500' : ''
                      }`}>
                        {i18n.language === 'ar' ? item.arabicName || item.name : item.name}
                      </span>
                    </div>
                    <span className="text-gray-500 font-medium flex-shrink-0 ms-2">{t('common.quantity', { count: formatNumber(item.quantity) })}</span>
                  </li>
                );
              })}
            </ul>
            {onSectionAction && groupStatus === 'pending' && (
              <button onClick={() => onSectionAction(order._id, sectionId, 'prepare')}
                className="w-full mt-2 text-xs bg-blue-500 hover:bg-blue-600 text-white py-1.5 rounded-lg transition-colors">
                {t('kitchenDisplay.markPreparing')}
              </button>
            )}
            {onSectionAction && groupStatus === 'preparing' && (
              <button onClick={() => onSectionAction(order._id, sectionId, 'ready')}
                className="w-full mt-2 text-xs bg-green-500 hover:bg-green-600 text-white py-1.5 rounded-lg transition-colors">
                {t('kitchenDisplay.markReady')}
              </button>
            )}
            {onSectionDeliver && groupStatus === 'ready' && (
              <button onClick={() => onSectionDeliver(order._id, sectionId)}
                className="w-full mt-2 text-xs bg-gray-500 hover:bg-gray-600 text-white py-1.5 rounded-lg transition-colors">
                {t('kitchenDisplay.markDelivered')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default KitchenDisplay;
