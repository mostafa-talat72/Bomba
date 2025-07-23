import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Plus, Edit, Trash2, Clock, CheckCircle, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MenuItem } from '../services/api';
import { api } from '../services/api';

interface LocalOrderItem {
  menuItem: string;
  name: string;
  arabicName?: string;
  price: number;
  quantity: number;
  preparedCount?: number;
  notes?: string;
}

const Cafe: React.FC = () => {
  const {
    menuItems,
    fetchMenuItems,
    showNotification
  } = useApp();
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'kitchen'>('menu');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [readyOrders, setReadyOrders] = useState<any[]>([]);
  const [currentOrder, setCurrentOrder] = useState<LocalOrderItem[]>([]);

  // فاتورة جديدة أو موجودة
  const [billOption, setBillOption] = useState<'new' | 'existing'>('new');
  const [selectedBillId, setSelectedBillId] = useState<string>('');
  const [openBills, setOpenBills] = useState<any[]>([]);
  const [searchBill, setSearchBill] = useState('');
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [todayStats, setTodayStats] = useState<{
    totalOrders: number;
    totalSales: number;
    ordersByStatus: any;
  }>({
    totalOrders: 0,
    totalSales: 0,
    ordersByStatus: {}
  });

  // إضافة state لإدارة قيم الإدخال المباشر للتجهيز
  const [preparedInputs, setPreparedInputs] = useState<{ [key: string]: string }>({});

  // إضافة state لإدارة حالة التجهيز لكل طلب
  const [preparingOrders, setPreparingOrders] = useState<{ [key: string]: boolean }>({});

  // دالة لإدارة حالة التجهيز
  const togglePreparing = (orderId: string) => {
    setPreparingOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // دالة لتجهيز الطلب بالكامل
  const prepareOrderComplete = async (orderId: string) => {
    try {
      const order = pendingOrders.find(o => o._id === orderId) || readyOrders.find(o => o._id === orderId);
      if (!order || !order.items) {
        showNotification('خطأ: الطلب غير موجود', 'error');
        return;
      }

      // تجهيز جميع الأصناف بالكامل
      const updatePromises = order.items.map((item, index) => {
        const quantity = item.quantity || 0;
        return updateItemPrepared(orderId, index, quantity);
      });

      await Promise.all(updatePromises);

      // إزالة حالة التجهيز
      setPreparingOrders(prev => {
        const newState = { ...prev };
        delete newState[orderId];
        return newState;
      });

      showNotification('تم تجهيز الطلب بالكامل', 'success');

      // إعادة تحميل البيانات
      fetchPendingOrders();
      fetchReadyOrders();
    } catch (error) {
      console.error('Error preparing order complete:', error);
      showNotification('خطأ في تجهيز الطلب', 'error');
    }
  };

  // دالة لإدارة الإدخال المباشر للتجهيز
  const handlePreparedInputChange = (orderId: string, itemIndex: number, value: string) => {
    const key = `${orderId}-${itemIndex}`;
    setPreparedInputs(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // دالة لتطبيق الإدخال المباشر للتجهيز
  const applyPreparedInput = async (orderId: string, itemIndex: number) => {
    const key = `${orderId}-${itemIndex}`;
    const inputValue = preparedInputs[key];

    if (!inputValue || inputValue.trim() === '') {
      showNotification('يرجى إدخال عدد صحيح', 'error');
      return;
    }

    const preparedCount = parseInt(inputValue);
    if (isNaN(preparedCount) || preparedCount < 0) {
      showNotification('يرجى إدخال عدد صحيح موجب', 'error');
      return;
    }

    // البحث عن الطلب للحصول على الكمية المطلوبة
    const order = pendingOrders.find(o => o._id === orderId) || readyOrders.find(o => o._id === orderId);
    if (!order || !order.items || !order.items[itemIndex]) {
      showNotification('خطأ: الطلب أو الصنف غير موجود', 'error');
      return;
    }

    const maxQuantity = order.items[itemIndex].quantity || 0;
    if (preparedCount > maxQuantity) {
      showNotification(`لا يمكن تجاوز الكمية المطلوبة (${maxQuantity})`, 'error');
      return;
    }

    try {
      await updateItemPrepared(orderId, itemIndex, preparedCount);
      // مسح قيمة الإدخال بعد التطبيق
      setPreparedInputs(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    } catch (error) {
      console.error('Error applying prepared input:', error);
      showNotification('خطأ في تحديث عدد التجهيز', 'error');
    }
  };

  // Group menu items by category
  const menuItemsByCategory = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  // Fetch categories
  useEffect(() => {
    fetchCategories();
    fetchOpenBills();
    fetchPendingOrders();
    fetchReadyOrders();
    fetchTodayStats();

    // إعادة تحميل البيانات كل 30 ثانية للتأكد من التحديث
    const interval = setInterval(() => {
      fetchPendingOrders();
      fetchReadyOrders();
      fetchTodayStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Fetch menu items when component mounts
  useEffect(() => {
    fetchMenuItems();
  }, []);

  // Update categories when menu items are loaded
  useEffect(() => {
    if (menuItems.length > 0) {
      const uniqueCategories = [...new Set(menuItems.map(item => item.category))];
      setCategories(uniqueCategories);
    }
  }, [menuItems]);

  // Fetch pending orders for kitchen
  useEffect(() => {
    if (activeTab === 'kitchen') {
      // لا نحتاج لاستدعاء الدوال هنا لأنها تُستدعى في useEffect الأول
      // فقط نضيف interval إضافي للطبخ
      const interval = setInterval(() => {
        fetchPendingOrders();
        fetchReadyOrders();
        fetchTodayStats();
      }, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const fetchCategories = async () => {
    try {
      // استخدام menuItems من الـ context بدلاً من استدعاء API مباشرة
      if (menuItems.length > 0) {
        const uniqueCategories = [...new Set(menuItems.map(item => item.category))];
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchOpenBills = async () => {
    try {
      const response = await api.getBills();
      if (response.success && response.data) {
        response.data.forEach((bill: any) => {
          if (bill.orders && bill.orders.length > 0) {
            bill.orders.forEach((order: any) => {
              if (order.items && order.items.length > 0) {
                order.items.forEach((item: any, index: number) => {
                  // تحضير البيانات للعرض
                });
              }
            });
          }
        });
        setOpenBills(response.data);
      }
    } catch (error) {
      console.error('Error fetching open bills:', error);
    }
  };

  const fetchPendingOrders = async () => {
    try {
      const response = await api.getPendingOrders();
      if (response.success && response.data) {
        const transformedOrders = response.data.map((order: any) => {
          if (order.items && order.items.length > 0) {
            order.items.forEach((item: any, index: number) => {
              // تحضير البيانات للعرض
            });
          }
          return order;
        });

        // تصفية الطلبات المسلمة أو الملغية
        const filteredOrders = transformedOrders.filter((order: any) =>
          order.status !== 'delivered' && order.status !== 'cancelled'
        );

        setPendingOrders(filteredOrders);
      }
    } catch (error) {
      console.error('Error fetching pending orders:', error);
    }
  };

  const fetchReadyOrders = async () => {
    try {
      const response = await api.getOrders({ status: 'ready' });
      if (response.success && response.data) {
        const transformedOrders = response.data.map((order: any) => {
          if (order.items && order.items.length > 0) {
            order.items.forEach((item: any, index: number) => {
              // تحضير البيانات للعرض
            });
          }
          return order;
        });

        // تصفية الطلبات المسلمة أو الملغية
        const filteredOrders = transformedOrders.filter((order: any) =>
          order.status !== 'delivered' && order.status !== 'cancelled'
        );

        setReadyOrders(filteredOrders);
      }
    } catch (error) {
      console.error('Error fetching ready orders:', error);
    }
  };

  const fetchTodayStats = async () => {
    try {
      const response = await api.getTodayOrdersStats();
      if (response.success && response.data) {
        setTodayStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching today stats:', error);
    }
  };

  const filteredMenuItems = menuItems.filter(item =>
    selectedCategory === 'all' || item.category === selectedCategory
  );

  const addToOrder = (item: MenuItem) => {
    if (!item || !item._id || !item.name) {
      showNotification('عنصر القائمة غير موجود أو غير معرف', 'error');
      return;
    }
    const existingItem = currentOrder.find(orderItem => orderItem.menuItem === item._id);

    if (existingItem) {
      setCurrentOrder(currentOrder.map(orderItem =>
        orderItem.menuItem === item._id
          ? { ...orderItem, quantity: orderItem.quantity + 1 }
          : orderItem
      ));
    } else {
      setCurrentOrder([...currentOrder, {
        menuItem: item._id,
        name: item.name,
        price: item.price,
        quantity: 1,
        preparedCount: 0,
        notes: item.notes
      }]);
    }
  };

  const removeFromOrder = (menuItemId: string) => {
    setCurrentOrder(currentOrder.filter(item => item.menuItem !== menuItemId));
  };

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromOrder(menuItemId);
    } else {
      setCurrentOrder(currentOrder.map(item =>
        item.menuItem === menuItemId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const calculateTotal = () => {
    return currentOrder.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  };

  const handleCreateOrder = async () => {
    if (currentOrder.length === 0) {
      showNotification('يرجى إضافة عناصر للطلب', 'error');
      return;
    }

    // تحقق صارم من كل عنصر
    if (currentOrder.some(item => !item || !item.menuItem || !item.name || typeof item.price !== 'number' || typeof item.quantity !== 'number')) {
      showNotification('هناك عنصر غير معرف أو ناقص في الطلب، يرجى إعادة إضافة العناصر.', 'error');
    return;
    }

    if (!customerName.trim()) {
      showNotification('يرجى إدخال اسم العميل', 'error');
      return;
    }


    setLoading(true);

    try {
      const orderData = {
        customerName: customerName.trim(),
        items: currentOrder.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          notes: item.notes,
        })),
        notes: orderNotes
      };


      let response;
      if (billOption === 'new') {
        // 1. أنشئ الفاتورة أولاً
        const billResponse = await api.createBill({
          customerName: customerName.trim(),
          orders: [],
          sessions: [],
          discount: 0,
          tax: 0,
          notes: orderNotes,
          billType: 'cafe'
        });
        if (!billResponse.success || !billResponse.data) {
          showNotification('فشل في إنشاء الفاتورة', 'error');
          setLoading(false);
          return;
        }
        const newBillId = billResponse.data._id || billResponse.data.id;

        // 2. أنشئ الطلب
        response = await api.createOrder(orderData);

        // 3. اربط الطلب بالفاتورة الجديدة
        if (response.success && response.data) {
          await api.addOrderToBill(newBillId, response.data._id);
        }
      } else if (billOption === 'existing' && selectedBillId) {
        response = await api.createOrder(orderData);
        if (response.success && response.data) {
          // إضافة الطلب إلى الفاتورة المختارة
          await api.addOrderToBill(selectedBillId, response.data._id);
        }
      } else {
        showNotification('يرجى اختيار فاتورة موجودة', 'error');
        setLoading(false);
        return;
      }

      if (response && response.success) {
        showNotification('تم إنشاء الطلب بنجاح', 'success');
        setShowNewOrder(false);
        setCustomerName('');
        setOrderNotes('');
        setCurrentOrder([]);
        setBillOption('new');
        setSelectedBillId('');
        setSelectedBill(null);
        setSearchBill('');

        // إعادة تحميل البيانات
        setTimeout(() => {
        fetchPendingOrders();
          fetchReadyOrders();
          fetchOpenBills();
        }, 1000);
      } else {
        const errorMessage = response?.message || 'خطأ في إنشاء الطلب';
        showNotification(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      showNotification('خطأ في إنشاء الطلب', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled') => {
    try {
      const response = await api.updateOrderStatus(orderId, status);

      if (response && response.success) {
        // إعادة تحميل البيانات
        fetchPendingOrders();
        fetchReadyOrders();
        return response;
      } else {
        const errorMessage = response?.message || 'خطأ في تحديث حالة الطلب';
        showNotification(errorMessage, 'error');
        return null;
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      showNotification('خطأ في تحديث حالة الطلب', 'error');
      return null;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'preparing':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'في الانتظار';
      case 'preparing':
        return 'قيد التجهيز';
      case 'ready':
        return 'جاهز للتسليم';
      case 'delivered':
        return 'تم التسليم';
      case 'cancelled':
        return 'ملغي';
      default:
        return status;
    }
  };

  // دالة للتحقق من وجود أصناف غير مجهزة
  const hasUnpreparedItems = (order: any) => {
    if (!order.items) return false;
    return order.items.some((item: any) => {
      return (item.preparedCount || 0) < (item.quantity || 0);
    });
  };

  // دالة للتحقق من وجود أصناف مجهزة
  const hasAnyPreparedItems = (order: any) => {
    if (!order.items) return false;
    return order.items.some((item: any) => {
      return (item.preparedCount || 0) > 0;
    });
  };

  // دالة للتحقق من أن جميع الأصناف مجهزة بالكامل
  const hasAllItemsFullyPrepared = (order: any) => {
    if (!order.items) return false;
    return order.items.every((item: any) => {
      return (item.preparedCount || 0) >= (item.quantity || 0);
    });
  };

  // دالة للتحقق من أن الطلب جاهز للتسليم
  const isOrderReadyForDelivery = (order: any) => {
    // التحقق من الحالة أولاً
    if (order.status === 'ready') {
        return true;
      }
    if (!order.items) return false;
    return order.items.every((item: any) => (item.preparedCount || 0) >= (item.quantity || 0));
  };

  // Filter orders with unprepared items using useMemo
  const incompleteOrders = useMemo(() => {
    const filtered = pendingOrders.filter(order => {
      // تجاهل الطلبات المسلمة أو الملغية
      if (order.status === 'delivered' || order.status === 'cancelled') {
        return false;
      }

      // إظهار الطلبات التي لديها أصناف غير مجهزة بالكامل (pending + preparing)
      const hasUnprepared = hasUnpreparedItems(order);
      return hasUnprepared;
    });
    return filtered;
  }, [pendingOrders]);

  // تحويل الطلبات إلى أصناف مجهزة منفصلة
  const preparedItems = useMemo(() => {
    const items: Array<{
      _id: string;
      orderId: string;
      orderNumber: string;
      customerName: string;
      itemName: string;
      quantity: number;
      preparedCount: number;
      price: number;
      totalPrice: number;
      createdAt: Date;
      orderCreatedAt: Date;
      billNumber?: string;
    }> = [];

    // البحث في جميع الطلبات (pending + ready)
    const allOrders = [...pendingOrders, ...readyOrders];

    allOrders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          const preparedCount = item.preparedCount || 0;
          const quantity = item.quantity || 0;

          // إضافة الأصناف المجهزة فقط (preparedCount > 0)
          if (preparedCount > 0) {
            items.push({
              _id: `${order._id}-${item.name}`,
              orderId: order._id,
              orderNumber: order.orderNumber,
              customerName: order.customerName || 'بدون اسم',
              itemName: item.name,
              quantity: preparedCount,
              preparedCount: preparedCount,
              price: item.price,
              totalPrice: item.price * preparedCount,
              createdAt: new Date(),
              orderCreatedAt: order.createdAt,
              billNumber: order.bill?.billNumber
            });
          }
        });
      }
    });

    return items;
  }, [pendingOrders, readyOrders]);

  // طلبات جاهزة للتسليم
  const readyForDeliveryOrders = useMemo(() => {
    const filtered = [...pendingOrders, ...readyOrders].filter(order => {
      // تجاهل الطلبات المسلمة أو الملغية
      if (order.status === 'delivered' || order.status === 'cancelled') {
        return false;
      }

      // إظهار الطلبات التي جميع أصنافها مجهزة بالكامل
      const isReady = isOrderReadyForDelivery(order);
      return isReady;
    });
    return filtered;
  }, [pendingOrders, readyOrders]);

  // Auto-refresh data every 30 seconds to ensure consistency
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPendingOrders();
      fetchReadyOrders();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Clean up delivered orders from all lists - يتم تنظيفها في fetchPendingOrders و fetchReadyOrders
  // لذلك لا نحتاج لـ useEffect منفصل هنا

  // Helper: Get unprepared items count for an order
  const getUnpreparedItemsCount = (order: any) => {
    if (!order.items) return 0;
    let count = 0;
    order.items.forEach((item: any) => {
      count += Math.max(0, (item.quantity || 0) - (item.preparedCount || 0));
    });
    return count;
  };

  // دالة لحساب عدد الأصناف المجهزة
  const getPreparedItemsCount = (order: any) => {
    if (!order.items) return 0;
    let count = 0;
    order.items.forEach((item: any) => {
      count += item.preparedCount || 0;
    });
    return count;
  };

  // Function to update item prepared count
  const updateItemPrepared = async (orderId: string, itemIndex: number, preparedCount: number) => {
    try {
      // تحديث فوري في الواجهة الأمامية أولاً
      setPendingOrders(prevOrders => {
        const updatedOrders = prevOrders.map(order => {
          if (order._id === orderId && order.items && order.items[itemIndex]) {
            const updatedOrder = { ...order };
            updatedOrder.items = [...order.items];
            updatedOrder.items[itemIndex] = {
              ...order.items[itemIndex],
              preparedCount: preparedCount
            };
            return updatedOrder;
          }
          return order;
        });

        return updatedOrders;
      });

      // تحديث فوري في selectedOrder إذا كان مفتوحاً
      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder(prevOrder => {
          if (prevOrder && prevOrder.items && prevOrder.items[itemIndex]) {
            const updatedOrder = { ...prevOrder };
            updatedOrder.items = [...prevOrder.items];
            updatedOrder.items[itemIndex] = {
              ...prevOrder.items[itemIndex],
              preparedCount: preparedCount
            };
            return updatedOrder;
          }
          return prevOrder;
        });
      }

      // إرسال التحديث إلى الخادم
      const response = await api.updateOrderItemPrepared(orderId, itemIndex, { preparedCount });
      if (response.success) {
        // التحقق من حالة الطلب بعد التحديث
        const updatedOrder = response.data;
        if (!updatedOrder) {
          showNotification('خطأ في تحديث حالة التجهيز', 'error');
          return;
        }

        const allItemsFullyPrepared = updatedOrder.items?.every(item =>
          (item.preparedCount || 0) >= (item.quantity || 0)
        );
        const anyItemsPrepared = updatedOrder.items?.some(item =>
          (item.preparedCount || 0) > 0
        );

        // إذا تم تجهيز جميع الأصناف بالكامل، إزالة الطلب من غير المكتملة
        if (allItemsFullyPrepared) {
          // إزالة الطلب من المعلقة
          setPendingOrders(prev => prev.filter(o => o._id !== orderId));

          // إضافة الطلب إلى الجاهزة
          setReadyOrders(prev => {
            const readyOrder: Order = {
              ...updatedOrder,
              status: 'ready' as const,
              _id: updatedOrder._id || orderId,
              id: updatedOrder.id || orderId
            };

            // التحقق من وجود الطلب في القائمة الجاهزة
            const existingIndex = prev.findIndex(o => o._id === orderId);
            if (existingIndex >= 0) {
              // تحديث الطلب الموجود
              const newReadyOrders = [...prev];
              newReadyOrders[existingIndex] = readyOrder;
              return newReadyOrders;
            } else {
              // إضافة طلب جديد
              return [...prev, readyOrder];
            }
          });

          // تحديث selectedOrder إذا كان مفتوحاً
          if (selectedOrder && selectedOrder._id === orderId) {
            setSelectedOrder({
              ...updatedOrder,
              status: 'ready' as const,
              _id: updatedOrder._id || orderId,
              id: updatedOrder.id || orderId
            } as Order);
          }

            showNotification('تم تجهيز الطلب بالكامل وتم نقله إلى الجاهزة', 'success');
        }
        // إذا كان هناك أصناف مجهزة ولكن لم تكتمل جميعها
        else if (anyItemsPrepared) {
          // تحديث الطلب في المعلقة
          setPendingOrders(prev => {
            const updatedOrders = prev.map(o => {
              if (o._id === orderId) {
                return {
                  ...updatedOrder,
                  status: 'pending' as const,
                  _id: updatedOrder._id || orderId,
                  id: updatedOrder.id || orderId
                } as Order;
              }
              return o;
            });
            return updatedOrders;
          });

          // تحديث selectedOrder إذا كان مفتوحاً
          if (selectedOrder && selectedOrder._id === orderId) {
            setSelectedOrder({
              ...updatedOrder,
              status: 'pending' as const,
              _id: updatedOrder._id || orderId,
              id: updatedOrder.id || orderId
            } as Order);
          }

          showNotification('تم تحديث عدد التجهيز', 'success');
        }
        // إذا لم تكن هناك أي أصناف مجهزة
        else {
          // تحديث الطلب في المعلقة
          setPendingOrders(prev => {
            const updatedOrders = prev.map(o => {
              if (o._id === orderId) {
                return {
              ...updatedOrder,
              status: 'pending' as const,
              _id: updatedOrder._id || orderId,
              id: updatedOrder.id || orderId
                } as Order;
              }
              return o;
            });
            return updatedOrders;
          });

          // إزالة الطلب من الجاهزة إذا كان موجوداً هناك
          setReadyOrders(prev => prev.filter(o => o._id !== orderId));

          // تحديث selectedOrder إذا كان مفتوحاً
          if (selectedOrder && selectedOrder._id === orderId) {
            setSelectedOrder({
              ...updatedOrder,
              status: 'pending' as const,
              _id: updatedOrder._id || orderId,
              id: updatedOrder.id || orderId
            } as Order);
          }

          showNotification('تم إزالة جميع الأصناف المجهزة', 'info');
        }

        // تحديث الفواتير لتعكس التغييرات
        fetchOpenBills();

        // إعادة تحميل البيانات للتأكد من التحديث
        setTimeout(() => {
          fetchPendingOrders();
          fetchReadyOrders();
        }, 500);
      } else {
        showNotification('خطأ في تحديث حالة التجهيز', 'error');

        // إعادة تحميل البيانات من الخادم في حالة الفشل
        fetchPendingOrders();
        fetchReadyOrders();
      }
    } catch (error) {
      showNotification('خطأ في تحديث حالة التجهيز', 'error');

      // إعادة تحميل البيانات من الخادم في حالة الفشل
      fetchPendingOrders();
    }
  };

  // Function to move order to ready manually
  const moveOrderToReady = async (orderId: string) => {
    try {
      // البحث عن الطلب
      const order = pendingOrders.find(o => o._id === orderId);
      if (!order) {
        showNotification('خطأ: الطلب غير موجود', 'error');
        return;
      }

      // التحقق من أن جميع الأصناف مجهزة بالكامل
      if (!hasAllItemsFullyPrepared(order)) {
        showNotification('لا يمكن تحريك الطلب - بعض الأصناف غير مجهزة بالكامل', 'error');
        return;
      }

      // تحديث حالة الطلب إلى ready
      await updateOrderStatus(orderId, 'ready');

      // إزالة من قائمة الطلبات قيد التجهيز
      setPendingOrders(prev => prev.filter(o => o._id !== orderId));

      showNotification('تم تحريك الطلب إلى الجاهزة بنجاح', 'success');

      // إعادة تحميل البيانات
      fetchPendingOrders();
      fetchReadyOrders();
    } catch (error) {
      console.error('❌ Error moving order to ready:', error);
      showNotification('خطأ في تحريك الطلب', 'error');
    }
  };

  // دالة لاختبار الاتصال بالخادم
  const testServerConnection = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/orders/pending');

      if (response.ok) {
        showNotification('الخادم يعمل بشكل طبيعي', 'success');
      } else {
        showNotification(`خطأ في الخادم: ${response.status}`, 'error');
      }
    } catch (error) {
      showNotification('لا يمكن الاتصال بالخادم، تأكد من تشغيله', 'error');
    }
  };

  // Function to deliver order
  const deliverOrder = async (orderId: string) => {
    try {
      // البحث عن الطلب في جميع القوائم
      const allOrders = [...pendingOrders, ...readyOrders];
      const order = allOrders.find(o => o._id === orderId);

      if (!order) {
        showNotification('خطأ: الطلب غير موجود', 'error');
        return;
      }

      // التحقق من أن الطلب جاهز للتسليم
      const isReady = isOrderReadyForDelivery(order);

      if (!isReady) {
        const unpreparedItems = order.items?.filter(item =>
          (item.preparedCount || 0) < (item.quantity || 0)
        ) || [];
        showNotification('لا يمكن تسليم الطلب - بعض الأصناف غير جاهزة', 'error');
        return;
      }

      // تحديث حالة الطلب إلى delivered
      const response = await updateOrderStatus(orderId, 'delivered');

      if (response && response.success) {
        // إزالة من جميع القوائم فوراً
        setReadyOrders(prev => {
          const filtered = prev.filter(o => o._id !== orderId);
          return filtered;
        });

        setPendingOrders(prev => {
          const filtered = prev.filter(o => o._id !== orderId);
          return filtered;
        });

        showNotification('تم تسليم الطلب بنجاح', 'success');

        // إعادة تحميل البيانات بعد تأخير قصير للتأكد من التحديث
        setTimeout(() => {
        fetchPendingOrders();
        fetchReadyOrders();
          fetchOpenBills(); // تحديث الفواتير
        }, 1000);
      } else {
        const errorMessage = response?.message || 'خطأ غير معروف في تحديث حالة الطلب';
        showNotification(errorMessage, 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'خطأ في تسليم الطلب';
      showNotification(errorMessage, 'error');
    }
  };

  // Function to deliver specific item
  const deliverItem = async (orderId: string, itemName: string, itemIndex: number) => {
    try {
      // البحث عن الطلب في جميع الطلبات (pending + ready)
      const order = pendingOrders.find(o => o._id === orderId) || readyOrders.find(o => o._id === orderId);
      if (!order || !order.items || !order.items[itemIndex]) {
        showNotification('خطأ: الطلب أو الصنف غير موجود', 'error');
        return;
      }

      const currentItem = order.items[itemIndex];
      const currentPreparedCount = currentItem.preparedCount || 0;
      const requiredQuantity = currentItem.quantity || 0;

      // حساب العدد المطلوب إضافته للوصول للكمية الكاملة
      const remainingToDeliver = requiredQuantity - currentPreparedCount;

      if (remainingToDeliver <= 0) {
        showNotification(`${itemName} تم تسليمه بالكامل بالفعل`, 'info');
        return;
      }

      // استخدام API الجديد لتسليم الصنف
      const response = await api.deliverItem(orderId, itemIndex);

      if (response.success) {
        // التحقق من حالة الطلب بعد التحديث
        const updatedOrder = response.data;
        if (updatedOrder) {
          // التحقق من أن جميع الأصناف تم تسليمها بالكامل
          const allItemsFullyDelivered = updatedOrder.items?.every(item =>
            (item.preparedCount || 0) >= (item.quantity || 0)
          );

          if (allItemsFullyDelivered) {
            // إذا تم تسليم جميع الأصناف، الطلب أصبح delivered
            setReadyOrders(prev => {
              const filtered = prev.filter(o => o._id !== orderId);
              return filtered;
            });

            setPendingOrders(prev => {
              const filtered = prev.filter(o => o._id !== orderId);
              return filtered;
            });

            showNotification(`تم تسليم ${itemName} واكتمل الطلب بالكامل`, 'success');
          } else {
            // إذا تبقى أصناف، تحديث الواجهة فقط
            setReadyOrders(prev => {
              const updatedOrders = prev.map(o => {
                if (o._id === orderId) {
                  const updatedOrder = { ...o };
                  updatedOrder.items = [...o.items];
                  updatedOrder.items[itemIndex] = {
                    ...o.items[itemIndex],
                    preparedCount: requiredQuantity
                  };
                  return updatedOrder;
                }
                return o;
              });
              return updatedOrders;
            });

            setPendingOrders(prev => {
              const updatedOrders = prev.map(o => {
                if (o._id === orderId) {
                  const updatedOrder = { ...o };
                  updatedOrder.items = [...o.items];
                  updatedOrder.items[itemIndex] = {
                    ...o.items[itemIndex],
                    preparedCount: requiredQuantity
                  };
                  return updatedOrder;
                }
                return o;
              });
              return updatedOrders;
            });

            showNotification(`تم تسليم ${itemName} بنجاح (${remainingToDeliver} من ${requiredQuantity})`, 'success');
          }
        }

        // إعادة تحميل البيانات للتأكد من التحديث
        setTimeout(() => {
          fetchPendingOrders();
          fetchReadyOrders();
        }, 500);
      } else {
        showNotification('خطأ في تسليم الصنف', 'error');
      }
    } catch (error) {
      showNotification('خطأ في تسليم الصنف', 'error');
    }
  };

  // Function to show order details
  const handleOrderClick = (order: any) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  // تحديث اسم العميل عند اختيار فاتورة موجودة
  const handleBillSelection = (bill: any) => {
    setSelectedBillId(bill._id);
    setSelectedBill(bill);
    setCustomerName(bill.customerName || '');
  };

  // إعادة تعيين عند تغيير خيار الفاتورة
  const handleBillOptionChange = (option: 'new' | 'existing') => {
    setBillOption(option);
    setSelectedBillId('');
    setSelectedBill(null);
    setSearchBill('');
    if (option === 'new') {
      setCustomerName('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <ShoppingCart className="h-8 w-8 text-primary-600 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إدارة الطلبات</h1>
            <p className="text-gray-600">طلبات المشروبات والأصناف للعملاء</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            onClick={() => {
              fetchPendingOrders();
              fetchReadyOrders();
              fetchTodayStats();
              showNotification('تم تحديث البيانات', 'success');
            }}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
            title="تحديث البيانات"
          >
            <svg className="h-5 w-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            تحديث
          </button>
          <button
            onClick={() => setShowNewOrder(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
          >
            <Plus className="h-5 w-5 ml-2" />
            طلب جديد
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">طلبات قيد التجهيز</p>
              <p className="text-2xl font-bold text-yellow-600">
                {incompleteOrders.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">جاهز للتسليم</p>
              <p className="text-2xl font-bold text-green-600">{readyForDeliveryOrders.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">أصناف مجهزة</p>
              <p className="text-2xl font-bold text-blue-600">{preparedItems.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-purple-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">إجمالي المبيعات اليوم</p>
              <p className="text-2xl font-bold text-purple-600">
                {todayStats.totalSales.toFixed(0)} ج.م
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">طلبات قيد التجهيز</h3>
        </div>
        <div className="p-6">
          {incompleteOrders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد طلبات قيد التجهيز</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {incompleteOrders.map((order) => (
                <div
                  key={order._id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
                >
                  {/* Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">📋</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">#{order.orderNumber}</span>
                    </div>

                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <User className="h-4 w-4 mr-1" />
                      <span className="truncate">{order.customerName || 'بدون اسم'}</span>
                    </div>

                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Content - عرض الأصناف بدون أسعار */}
                  <div className="p-4">
                    <div className="space-y-3">
                      {/* عرض جميع الأصناف المطلوبة بدون أسعار */}
                      {order.items && order.items.length > 0 && (
                        <div className="text-sm text-gray-700">
                          <div className="font-medium mb-2 text-gray-900">الأصناف المطلوبة:</div>
                          {order.items.map((item, index) => (
                            <div key={index} className="py-1 border-b border-gray-100 last:border-b-0">
                              <div className="flex justify-between items-center">
                                <span className="truncate">{item.name}</span>
                                <span className="font-medium text-gray-900">{item.quantity} قطعة</span>
                              </div>
                              {/* ملاحظة لهذا المشروب: غير متوفرة */}
                            </div>
                          ))}
                        </div>
                      )}

                      {order.bill && (
                        <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-100">
                          <span>فاتورة: {order.bill.billNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer - أزرار التجهيز */}
                  <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-lg">
                    {order.status === 'preparing' ? (
                      // حالة التجهيز - إظهار زر "تم التجهيز"
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          prepareOrderComplete(order._id);
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                      >
                        <CheckCircle className="h-4 w-4 ml-2" />
                        تم التجهيز
                      </button>
                    ) : (
                      // الحالة العادية - إظهار زر "بدء التجهيز"
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const response = await api.updateOrderStatus(order._id, 'preparing');
                            if (response && response.success) {
                              // تحديث حالة الطلب محلياً ليظهر الزر فوراً
                              setPendingOrders(prevOrders => prevOrders.map(o =>
                                o._id === order._id ? { ...o, status: 'preparing' } : o
                              ));
                            } else {
                              showNotification('حدث خطأ أثناء بدء التجهيز، يرجى المحاولة مرة أخرى', 'error');
                            }
                          } catch (error) {
                            showNotification('حدث خطأ أثناء بدء التجهيز، يرجى المحاولة مرة أخرى', 'error');
                          }
                        }}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                      >
                        <ShoppingCart className="h-4 w-4 ml-2" />
                        بدء التجهيز
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ready for Delivery Orders */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">طلبات جاهزة للتسليم</h3>
        </div>
        <div className="p-6">
          {readyForDeliveryOrders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد طلبات جاهزة للتسليم</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {readyForDeliveryOrders.map((order) => (
                <div
                  key={order._id}
                  className="bg-white rounded-lg shadow-sm border border-green-200 hover:shadow-md transition-shadow duration-200"
                >
                  {/* Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">✅</span>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          جاهز للتسليم
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">#{order.orderNumber}</span>
                    </div>

                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <User className="h-4 w-4 mr-1" />
                      <span className="truncate">{order.customerName || 'بدون اسم'}</span>
                    </div>

                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">الأصناف الجاهزة:</span>
                        <span className="font-semibold text-green-600">{order.items?.length || 0}</span>
                      </div>

                      {/* عرض الأصناف الجاهزة */}
                      {order.items && order.items.length > 0 && (
                        <div className="text-xs text-gray-600">
                          <div className="font-medium mb-1">الأصناف الجاهزة:</div>
                          {order.items.map((item, index) => (
                            <div key={index} className="py-1 border-b border-gray-100 last:border-b-0">
                              <div className="flex justify-between items-center">
                                <span className="truncate">{item.name}</span>
                                <span className="text-green-600 font-medium">{item.quantity} × {item.price} ج.م</span>
                              </div>
                              {/* ملاحظة لهذا المشروب: غير متوفرة */}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">إجمالي الطلب:</span>
                        <span className="font-semibold text-gray-900">{order.finalAmount || order.totalAmount} ج.م</span>
                      </div>

                      {order.bill && (
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>فاتورة: {order.bill.billNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-gray-100 bg-green-50 rounded-b-lg">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleOrderClick(order)}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        <ShoppingCart className="h-4 w-4 mr-1 inline" />
                        عرض التفاصيل
                      </button>
                      <button
                        onClick={() => deliverOrder(order._id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        تسليم الطلب
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Order Modal */}
      {showNewOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">طلب جديد</h3>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Menu Items for Order */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">اختر من القائمة</h4>
                  {/* فلتر الفئة */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">الفئة</label>
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="all">جميع الفئات</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">جاري تحميل القائمة...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {categories
                        .filter(category => selectedCategory === 'all' || category === selectedCategory)
                        .map(category => (
                          <div key={category}>
                            <h5 className="font-medium text-gray-700 mb-2">{category}</h5>
                            <div className="space-y-2">
                              {(menuItemsByCategory[category] || []).filter(item => item.isAvailable).map(item => (
                                <button
                                  key={item.id}
                                  onClick={() => addToOrder(item)}
                                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                                >
                                  <span className="text-gray-900">{item.name}</span>
                                  <span className="text-gray-600">{item.price} ج.م</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Order Details */}
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      اسم العميل
                      {billOption === 'existing' && selectedBill && (
                        <span className="text-xs text-gray-500 mr-2">(من الفاتورة المختارة)</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${billOption === 'existing' && selectedBill ? 'bg-gray-100' : ''
                        }`}
                      placeholder="أدخل اسم العميل"
                      readOnly={billOption === 'existing' && selectedBill}
                    />
                  </div>

                  {/* اختيار الفاتورة */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">الفاتورة</label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="billOption"
                          value="new"
                          checked={billOption === 'new'}
                          onChange={(e) => handleBillOptionChange(e.target.value as 'new' | 'existing')}
                          className="ml-2"
                        />
                        <span className="text-sm">فاتورة جديدة</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="billOption"
                          value="existing"
                          checked={billOption === 'existing'}
                          onChange={(e) => handleBillOptionChange(e.target.value as 'new' | 'existing')}
                          className="ml-2"
                        />
                        <span className="text-sm">فاتورة موجودة</span>
                      </label>
                    </div>

                    {billOption === 'existing' && (
                      <div className="mt-3">
                        <input
                          type="text"
                          placeholder="البحث عن فاتورة بالاسم..."
                          value={searchBill}
                          onChange={(e) => setSearchBill(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        <div className="mt-2 max-h-32 overflow-y-auto">
                          {openBills
                            .filter(bill =>
                              (bill.status === 'draft' || bill.status === 'partial') &&
                              (
                                bill.customerName?.toLowerCase().includes(searchBill.toLowerCase()) ||
                                bill.billNumber?.toLowerCase().includes(searchBill.toLowerCase())
                              )
                            )
                            .map(bill => (
                              <div
                                key={bill._id}
                                className={`p-2 border rounded cursor-pointer text-sm ${selectedBillId === bill._id ? 'bg-primary-100 border-primary-500' : 'bg-gray-50 border-gray-200'
                                  }`}
                                onClick={() => handleBillSelection(bill)}
                              >
                                <div className="font-medium">{bill.customerName || 'بدون اسم'}</div>
                                <div className="text-gray-600 text-xs">فاتورة رقم: {bill.billNumber}</div>
                                <div className="text-gray-600 text-xs">المجموع: {bill.total} ج.م</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <h4 className="font-medium text-gray-900 mb-4">تفاصيل الطلب</h4>
                  <div className="space-y-3">
                    {currentOrder.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">لا توجد عناصر في الطلب</p>
                    ) : (
                      currentOrder.map((item, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">{item.name}</span>
                            <button
                              onClick={() => removeFromOrder(item.menuItem)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse mb-2">
                            <button
                              onClick={() => updateQuantity(item.menuItem, item.quantity - 1)}
                              className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.menuItem, item.quantity + 1)}
                              className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center"
                            >
                              +
                            </button>
                            <span className="text-gray-600">{item.price} ج.م</span>
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">ملاحظات هذا المشروب:</label>
                            <textarea
                              value={item.notes || ''}
                              onChange={(e) => {
                                const updatedOrder = [...currentOrder];
                                updatedOrder[index] = { ...item, notes: e.target.value };
                                setCurrentOrder(updatedOrder);
                              }}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                              rows={1}
                              placeholder="مثال: بدون سكر، مع حليب إضافي..."
                            />
                          </div>
                        </div>
                      ))
                    )}

                    {currentOrder.length > 0 && (
                      <div className="border-t pt-3">
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>الإجمالي:</span>
                          <span className="text-green-600">
                            {calculateTotal().toFixed(2)} ج.م
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 space-x-reverse">
              <button
                onClick={() => {
                  setShowNewOrder(false);
                  setCustomerName('');
                  setBillOption('new');
                  setSelectedBillId('');
                  setSelectedBill(null);
                  setSearchBill('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              >
                إلغاء
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={loading || currentOrder.length === 0}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white rounded-lg transition-colors duration-200"
              >
                {loading ? 'جاري إنشاء الطلب...' : 'إنشاء الطلب'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  تفاصيل الطلب #{selectedOrder.orderNumber}
                </h3>
                <button
                  onClick={() => setShowOrderDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Order Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">العميل:</span>
                    <p className="font-medium">{selectedOrder.customerName || 'بدون اسم'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">الحالة:</span>
                    <p className="font-medium">{getStatusText(selectedOrder.status)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">الوقت:</span>
                    <p className="font-medium">
                      {new Date(selectedOrder.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* حالة الطلب الكلية */}
                <div className="mt-4 p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">حالة الطلب الكلية:</span>
                    {hasAllItemsFullyPrepared(selectedOrder) ? (
                      <div className="flex items-center">
                        <span className="text-green-600 text-sm font-medium mr-2">✓ جاهز للتحريك</span>
                        <span className="text-xs text-gray-500">جميع الأصناف مجهزة بالكامل</span>
                      </div>
                    ) : hasAnyPreparedItems(selectedOrder) ? (
                        <div className="flex items-center">
                          <span className="text-yellow-600 text-sm font-medium mr-2">⚠ جزئي</span>
                          <span className="text-xs text-gray-500">
                          {getUnpreparedItemsCount(selectedOrder)} صنف غير مجهز بالكامل
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                        <span className="text-red-600 text-sm font-medium mr-2">✗ غير مجهز</span>
                        <span className="text-xs text-gray-500">لا توجد أصناف مجهزة</span>
                      </div>
                    )}
                  </div>

                  {/* تفاصيل إضافية */}
                  <div className="mt-2 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>إجمالي الأصناف: {selectedOrder.items?.length || 0}</span>
                      <span>الأصناف المجهزة بالكامل: {(selectedOrder.items?.filter(item => (item.preparedCount || 0) >= (item.quantity || 0)).length || 0)}</span>
                      <span>الأصناف الجزئية: {(selectedOrder.items?.filter(item => (item.preparedCount || 0) > 0 && (item.preparedCount || 0) < (item.quantity || 0)).length || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">أصناف الطلب</h4>
                {selectedOrder?.items?.map((item, index) => {
                    const preparedCount = item.preparedCount || 0;
                  const quantity = item.quantity || 0;
                  const isFullyPrepared = preparedCount >= quantity;
                  const isPartiallyPrepared = preparedCount > 0 && preparedCount < quantity;
                  const isNotPrepared = preparedCount === 0;

                    return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        isFullyPrepared
                          ? 'border-green-200 bg-green-50'
                          : isPartiallyPrepared
                          ? 'border-yellow-200 bg-yellow-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h5 className="font-medium text-gray-900">{item.name}</h5>
                          <p className="text-sm text-gray-600">
                            {item.price} ج.م × {quantity} = {item.price * quantity} ج.م
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              isFullyPrepared
                                ? 'bg-green-100 text-green-800'
                                : isPartiallyPrepared
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {isFullyPrepared
                              ? 'جاهز'
                              : isPartiallyPrepared
                              ? 'جزئي'
                              : 'في الانتظار'}
                              </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-600">
                            مجهز: {preparedCount} / {quantity}
                            </span>
                            {isFullyPrepared && (
                            <span className="text-sm text-green-600 font-medium">
                              ✓ جاهز للتسليم
                            </span>
                            )}
                          </div>

                        {/* Preparation Controls */}
                        {selectedOrder.status !== 'delivered' && (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="0"
                              max={quantity}
                              value={preparedCount}
                              onChange={(e) => {
                                const newValue = Math.min(
                                  Math.max(0, parseInt(e.target.value) || 0),
                                  quantity
                                );
                                updateItemPrepared(selectedOrder._id, index, newValue);
                              }}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                              <button
                              onClick={() => updateItemPrepared(selectedOrder._id, index, quantity)}
                              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                              >
                              تجهيز كامل
                              </button>
                          </div>
                        )}
                        </div>
                      </div>
                    );
                })}
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 space-x-reverse">
                <button
                  onClick={() => setShowOrderDetails(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                >
                  إغلاق
                </button>

                {/* زر تحريك الطلب إلى الجاهزة */}
                {selectedOrder && hasAllItemsFullyPrepared(selectedOrder) && (
                  <button
                    onClick={() => {
                      moveOrderToReady(selectedOrder._id);
                      setShowOrderDetails(false);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 flex items-center"
                  >
                    <CheckCircle className="h-4 w-4 ml-2" />
                    تحريك إلى الجاهزة
                  </button>
                )}

                {/* زر إعادة تحميل البيانات */}
                <button
                  onClick={() => {
                    fetchPendingOrders();
                    fetchReadyOrders();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 flex items-center"
                  title="إعادة تحميل البيانات"
                >
                  <svg className="h-4 w-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  تحديث
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cafe;
