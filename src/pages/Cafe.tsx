import React, { useState, useEffect, useMemo } from 'react';
import { Coffee, Plus, Edit, Trash2, ShoppingCart, Clock, CheckCircle, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MenuItem, Order, OrderItem } from '../services/api';
import { api } from '../services/api';

interface LocalOrderItem {
  menuItem: string;
  name: string;
  arabicName?: string;
  price: number;
  quantity: number;
  preparedCount?: number;
  addons: Array<{
    name: string;
    price: number;
  }>;
  notes?: string;
  _newAddonName?: string;
  _newAddonPrice?: string;
}

const Cafe: React.FC = () => {
  const {
    orders,
    createOrder,
    updateOrder,
    menuItems,
    fetchMenuItems,
    bills,
    fetchBills,
    fetchOrders,
    showNotification
  } = useApp();
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'kitchen'>('menu');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<LocalOrderItem[]>([]);

  // فاتورة جديدة أو موجودة
  const [billOption, setBillOption] = useState<'new' | 'existing'>('new');
  const [selectedBillId, setSelectedBillId] = useState<string>('');
  const [openBills, setOpenBills] = useState<any[]>([]);
  const [searchBill, setSearchBill] = useState('');
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [todayStats, setTodayStats] = useState<{
    totalOrders: number;
    totalSales: number;
    ordersByStatus: any;
  }>({
    totalOrders: 0,
    totalSales: 0,
    ordersByStatus: {}
  });

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
    console.log('🔄 Component mounted, fetching initial data...');
    fetchCategories();
    fetchOpenBills();
    fetchPendingOrders();
    fetchReadyOrders();
    fetchTodayStats();

    // إعادة تحميل البيانات كل 30 ثانية للتأكد من التحديث
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing orders data...');
      fetchPendingOrders();
      fetchReadyOrders();
      fetchTodayStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Fetch menu items when component mounts
  useEffect(() => {
    console.log('🔄 Fetching menu items...');
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
      fetchPendingOrders();
      fetchReadyOrders();
      fetchTodayStats();
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
      console.log('🔄 Fetching open bills...');
      const response = await api.getBills();
      if (response.success && response.data) {
        console.log('📄 Fetched open bills:', response.data.length);
        response.data.forEach((bill: any) => {
          console.log('📄 Bill:', bill.billNumber, 'Orders:', bill.orders?.length || 0);
          if (bill.orders && bill.orders.length > 0) {
            bill.orders.forEach((order: any) => {
              console.log('📋 Order in bill:', order.orderNumber, 'Items:', order.items?.length || 0);
              if (order.items && order.items.length > 0) {
                order.items.forEach((item: any, index: number) => {
                  console.log('📦 Item', index, ':', item.name, 'Quantity:', item.quantity, 'Prepared:', item.preparedCount || 0);
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
        console.log('📋 Fetched pending orders:', response.data.length);

        // Transform the data to match our local Order interface
        const transformedOrders = response.data.map((order: any) => {
          console.log('📋 Order:', order.orderNumber, 'Items:', order.items?.length || 0);
          if (order.items && order.items.length > 0) {
            order.items.forEach((item: any, index: number) => {
              console.log('📦 Item', index, ':', item.name, 'Quantity:', item.quantity, 'Prepared:', item.preparedCount || 0);
            });
          }

          return {
            _id: order._id,
            id: order._id, // Use _id as id
            orderNumber: order.orderNumber,
            tableNumber: order.tableNumber || 1,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            items: order.items || [],
            subtotal: order.subtotal || order.totalAmount || 0,
            finalAmount: order.finalAmount || order.totalAmount || 0,
            totalAmount: order.totalAmount || 0,
            status: order.status,
            notes: order.notes,
            createdAt: order.createdAt,
            bill: order.bill
          };
        });

        console.log('📋 Transformed orders count:', transformedOrders.length);

        // تأكد من عدم وجود طلبات مسلمة في القائمة
        const filteredOrders = transformedOrders.filter(order =>
          order.status !== 'delivered' && order.status !== 'cancelled'
        );

        if (filteredOrders.length !== transformedOrders.length) {
          console.log('⚠️ Filtered out', transformedOrders.length - filteredOrders.length, 'delivered/cancelled orders');
        }

        setPendingOrders(filteredOrders);
        // setOrders(transformedOrders); // Also update the main orders state
      }
    } catch (error) {
      console.error('Error fetching pending orders:', error);
    }
  };

  const fetchReadyOrders = async () => {
    try {
      const response = await api.getOrders({ status: 'ready' });
      if (response.success && response.data) {
        console.log('✅ Fetched ready orders:', response.data.length);

        // Transform the data to match our local Order interface
        const transformedOrders = response.data.map((order: any) => {
          return {
            _id: order._id,
            id: order._id,
            orderNumber: order.orderNumber,
            tableNumber: order.tableNumber || 1,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            items: order.items || [],
            subtotal: order.subtotal || order.totalAmount || 0,
            finalAmount: order.finalAmount || order.totalAmount || 0,
            totalAmount: order.totalAmount || 0,
            status: order.status,
            notes: order.notes,
            createdAt: order.createdAt,
            bill: order.bill
          };
        });

        console.log('✅ Transformed ready orders count:', transformedOrders.length);

        // تأكد من عدم وجود طلبات مسلمة في القائمة الجاهزة
        const filteredOrders = transformedOrders.filter(order =>
          order.status !== 'delivered' && order.status !== 'cancelled'
        );

        if (filteredOrders.length !== transformedOrders.length) {
          console.log('⚠️ Filtered out', transformedOrders.length - filteredOrders.length, 'delivered/cancelled orders from ready list');
        }

        setReadyOrders(filteredOrders);
      }
    } catch (error) {
      console.error('Error fetching ready orders:', error);
    }
  };

  const fetchTodayStats = async () => {
    try {
      console.log('📊 Fetching today\'s orders statistics...');
      const response = await api.getTodayOrdersStats();
      if (response.success && response.data) {
        console.log('📊 Today\'s stats:', response.data);
        setTodayStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching today\'s stats:', error);
    }
  };

  const filteredMenuItems = menuItems.filter(item =>
    selectedCategory === 'all' || item.category === selectedCategory
  );

  const addToOrder = (item: MenuItem) => {
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
        addons: []
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
      const addonsTotal = (item.addons || []).reduce((sum, addon) => sum + (addon.price || 0), 0);
      return total + (item.price + addonsTotal) * item.quantity;
    }, 0);
  };

  const handleCreateOrder = async () => {
    if (currentOrder.length === 0) {
      alert('يرجى إضافة عناصر للطلب');
      return;
    }

    if (!customerName.trim()) {
      alert('يرجى إدخال اسم العميل');
      return;
    }

    setLoading(true);
    try {
      let billId = null;

      // إنشاء فاتورة جديدة أو ربط بفاتورة موجودة
      let finalCustomerName = customerName.trim();

      if (billOption === 'new') {
        // إنشاء فاتورة جديدة
        const billData = {
          tableNumber: 1, // رقم الطاولة الافتراضي للكافيه
          customerName: finalCustomerName,
          billType: 'cafe' as const
        };
        const billResponse = await api.createBill(billData);
        if (billResponse.success && billResponse.data) {
          billId = billResponse.data._id;
        }
      } else if (billOption === 'existing' && selectedBillId) {
        billId = selectedBillId;
        // استخدام اسم العميل من الفاتورة المختارة
        finalCustomerName = selectedBill?.customerName || finalCustomerName;
      }

      const orderData = {
        tableNumber: 1, // رقم الطاولة الافتراضي للكافيه
        customerName: finalCustomerName,
        items: currentOrder.map(item => ({
          menuItem: item.menuItem,
          name: item.name,
          arabicName: item.name,
          price: item.price,
          quantity: item.quantity,
          notes: item.notes || undefined,
          addons: item.addons || []
        })),
        bill: billId
      };

      console.log('📝 Sending order data:', orderData);
      console.log('📝 Current order items:', currentOrder);

      const response = await api.createOrder(orderData);

      console.log('📥 Order response:', response);

      if (response.success) {
        // Clear current order
        setCurrentOrder([]);
        setCustomerName('');
        setBillOption('new');
        setSelectedBillId('');
        setSelectedBill(null);
        setSearchBill('');

        alert('تم إنشاء الطلب بنجاح');

        // Refresh data
        console.log('🔄 Refreshing data after order creation...');
        fetchOpenBills();
        fetchPendingOrders();
        fetchTodayStats();
        if (activeTab === 'kitchen') {
          fetchPendingOrders();
        }
        console.log('✅ Data refresh completed');
      } else {
        console.error('❌ Order creation failed:', response);
        alert(`خطأ في إنشاء الطلب: ${response.message || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('❌ Error creating order:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      alert(`خطأ في إنشاء الطلب: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled') => {
    try {
      const response = await api.updateOrder(orderId, { status });
      if (response.success) {
        fetchPendingOrders();
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('خطأ في تحديث حالة الطلب');
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
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'في الانتظار';
      case 'preparing': return 'قيد التحضير';
      case 'ready': return 'جاهز';
      case 'delivered': return 'تم التسليم';
      default: return 'غير معروف';
    }
  };

  // Helper: Check if order has any unprepared items
  const hasUnpreparedItems = (order: Order) => {
    if (!order.items) return false;
    for (const item of order.items) {
      const prepared = item.preparedCount || 0;
      const quantity = item.quantity || 0;
      if (prepared < quantity) {
        console.log('🔍 Found unprepared item:', { name: item.name, prepared, quantity });
        return true;
      }
    }
    return false;
  };

  const hasAnyPreparedItems = (order: Order) => {
    if (!order.items) return false;
    for (const item of order.items) {
      const prepared = item.preparedCount || 0;
      if (prepared > 0) {
        console.log('🔍 Found prepared item:', { name: item.name, prepared });
        return true;
      }
    }
    return false;
  };

  // Filter orders with unprepared items using useMemo
  const incompleteOrders = useMemo(() => {
    const filtered = pendingOrders.filter(order => {
      // تجاهل الطلبات المسلمة أو الملغية
      if (order.status === 'delivered' || order.status === 'cancelled') {
        console.log('📋 Order', order.orderNumber, 'is', order.status, ', skipping');
        return false;
      }

      const hasUnprepared = hasUnpreparedItems(order);
      console.log('📋 Order', order.orderNumber, 'has unprepared items:', hasUnprepared);
      return hasUnprepared;
    });
    console.log('📋 Incomplete orders count:', filtered.length);
    return filtered;
  }, [pendingOrders]);

  // تحويل الطلبات الجاهزة إلى أصناف جاهزة منفصلة
  const readyItems = useMemo(() => {
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
    }> = [];

    readyOrders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          const preparedCount = item.preparedCount || 0;
          const quantity = item.quantity || 0;

          // إضافة الأصناف الجاهزة فقط (preparedCount > 0)
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
              orderCreatedAt: order.createdAt
            });
          }
        });
      }
    });

    console.log('📋 Ready items count:', items.length);
    return items;
  }, [readyOrders]);

  // Update incomplete orders when pendingOrders change
  useEffect(() => {
    console.log('🔄 Pending orders changed, updating incomplete orders...');
    console.log('📋 Total pending orders:', pendingOrders.length);
    console.log('📋 Incomplete orders:', incompleteOrders.length);
  }, [pendingOrders, incompleteOrders]);

  // Auto-refresh data every 30 seconds to ensure consistency
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing cafe data...');
      fetchPendingOrders();
      fetchReadyOrders();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Helper: Get unprepared items count for an order
  const getUnpreparedItemsCount = (order: Order) => {
    if (!order.items) return 0;
    let count = 0;
    for (const item of order.items) {
      const unprepared = (item.quantity || 0) - (item.preparedCount || 0);
      if (unprepared > 0) {
        count += unprepared;
        console.log('🔢 Unprepared count for', item.name, ':', unprepared, 'total:', count);
      }
    }
    return count;
  };

  // Function to update item prepared count
  const updateItemPrepared = async (orderId: string, itemIndex: number, preparedCount: number) => {
    try {
      console.log('🔄 Updating prepared count:', { orderId, itemIndex, preparedCount });

      // تحديث فوري في الواجهة الأمامية أولاً
      setPendingOrders(prevOrders => {
        const updatedOrders = prevOrders.map(order => {
          if (order._id === orderId && order.items && order.items[itemIndex]) {
            console.log('📋 Updating order:', order.orderNumber, 'item:', itemIndex);
            const updatedOrder = { ...order };
            updatedOrder.items = [...order.items];
            updatedOrder.items[itemIndex] = {
              ...order.items[itemIndex],
              preparedCount: preparedCount
            };
            console.log('📋 Updated item:', updatedOrder.items[itemIndex]);
            return updatedOrder;
          }
          return order;
        });

        console.log('📋 Updated orders count:', updatedOrders.length);
        console.log('📋 Incomplete orders count:', updatedOrders.filter(order => hasUnpreparedItems(order)).length);

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
        console.log('✅ API response successful');

        // التحقق من حالة الطلب بعد التحديث
        const updatedOrder = response.data;
        if (!updatedOrder) {
          console.error('❌ No updated order data received');
          showNotification('خطأ في تحديث حالة التجهيز', 'error');
          return;
        }

        const allItemsReady = updatedOrder.items?.every(item =>
          (item.preparedCount || 0) >= (item.quantity || 0)
        );
        const anyItemsPrepared = updatedOrder.items?.some(item =>
          (item.preparedCount || 0) > 0
        );

        console.log('📋 Order status after update:', {
          orderId,
          allItemsReady,
          anyItemsPrepared,
          items: updatedOrder.items?.map(item => ({
            name: item.name,
            quantity: item.quantity,
            preparedCount: item.preparedCount
          }))
        });

        // إذا كان هناك أي صنف جاهز، انقل الطلب إلى الجاهزة
        if (anyItemsPrepared) {
          console.log('✅ Some items ready, moving to ready orders');

          // إضافة الطلب إلى الجاهزة (حتى لو كان موجوداً في المعلقة)
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
              console.log('📋 Updated existing order in ready list');
              return newReadyOrders;
            } else {
              // إضافة طلب جديد
              console.log('📋 Added new order to ready list');
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

          if (allItemsReady) {
            showNotification('تم تجهيز الطلب بالكامل وتم نقله إلى الجاهزة', 'success');
          } else {
            showNotification('تم تجهيز بعض الأصناف وتم نقل الطلب إلى الجاهزة', 'success');
          }
        }
        // إذا لم تكن هناك أي أصناف جاهزة، انقل الطلب إلى المعلقة
        else {
          console.log('❌ No items prepared, moving back to pending');

          // إزالة الطلب من الجاهزة إذا كان موجوداً هناك
          setReadyOrders(prev => prev.filter(o => o._id !== orderId));

          // إضافة الطلب إلى المعلقة
          setPendingOrders(prev => {
            const pendingOrder: Order = {
              ...updatedOrder,
              status: 'pending' as const,
              _id: updatedOrder._id || orderId,
              id: updatedOrder.id || orderId
            };

            // التحقق من وجود الطلب في القائمة المعلقة
            const existingIndex = prev.findIndex(o => o._id === orderId);
            if (existingIndex >= 0) {
              // تحديث الطلب الموجود
              const newPendingOrders = [...prev];
              newPendingOrders[existingIndex] = pendingOrder;
              console.log('📋 Updated existing order in pending list');
              return newPendingOrders;
            } else {
              // إضافة طلب جديد
              console.log('📋 Added new order to pending list');
              return [...prev, pendingOrder];
            }
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

          showNotification('تم إزالة جميع الأصناف الجاهزة وتم إرجاع الطلب للمعلقة', 'info');
        }

        // تحديث الفواتير لتعكس التغييرات
        fetchOpenBills();

        // إعادة تحميل البيانات للتأكد من التحديث
        setTimeout(() => {
          console.log('🔄 Refreshing data after update...');
          fetchPendingOrders();
          fetchReadyOrders();
        }, 500);
      } else {
        console.error('❌ API response failed:', response);
        showNotification('خطأ في تحديث حالة التجهيز', 'error');

        // إعادة تحميل البيانات من الخادم في حالة الفشل
        fetchPendingOrders();
        fetchReadyOrders();
      }
    } catch (error) {
      console.error('❌ Error updating prepared count:', error);
      showNotification('خطأ في تحديث حالة التجهيز', 'error');

      // إعادة تحميل البيانات من الخادم في حالة الفشل
      fetchPendingOrders();
    }
  };

  // Function to move order to ready manually
  const moveOrderToReady = async (orderId: string) => {
    try {
      console.log('✅ Moving order to ready:', orderId);

      const order = pendingOrders.find(o => o._id === orderId);
      if (!order) {
        console.error('❌ Order not found:', orderId);
        return;
      }

      // تحقق من أن جميع الأصناف جاهزة
      const allItemsReady = order.items?.every(item =>
        (item.preparedCount || 0) >= (item.quantity || 0)
      );

      if (!allItemsReady) {
        showNotification('لا يمكن تحريك الطلب إلى الجاهزة - بعض الأصناف غير جاهزة', 'error');
        return;
      }

      // تحديث حالة الطلب إلى ready
      await updateOrderStatus(orderId, 'ready');

      // نقل الطلب من pending إلى ready
      setPendingOrders(prev => prev.filter(o => o._id !== orderId));
      setReadyOrders(prev => {
        const readyOrder = { ...order, status: 'ready' as const };
        return [...prev, readyOrder];
      });

      showNotification('تم تحريك الطلب إلى الجاهزة بنجاح', 'success');
    } catch (error) {
      console.error('❌ Error moving order to ready:', error);
      showNotification('خطأ في تحريك الطلب إلى الجاهزة', 'error');
    }
  };

  // Function to deliver order
  const deliverOrder = async (orderId: string) => {
    try {
      console.log('🚚 Delivering order:', orderId);
      const response = await updateOrder(orderId, 'delivered');
      if (response) {
        // Remove from ready orders
        setReadyOrders(prev => prev.filter(order => order._id !== orderId));
        showNotification('تم تسليم الطلب بنجاح', 'success');

        // إعادة تحميل البيانات
        fetchPendingOrders();
        fetchReadyOrders();
      }
    } catch (error) {
      console.error('❌ Error delivering order:', error);
      showNotification('خطأ في تسليم الطلب', 'error');
    }
  };

  // Function to deliver specific item
  const deliverItem = async (orderId: string, itemName: string, itemIndex: number) => {
    try {
      console.log('🚚 Delivering item:', { orderId, itemName, itemIndex });

      // البحث عن الطلب في readyOrders
      const order = readyOrders.find(o => o._id === orderId);
      if (!order || !order.items || !order.items[itemIndex]) {
        showNotification('خطأ: الطلب أو الصنف غير موجود', 'error');
        return;
      }

      // تحديث preparedCount للصنف إلى 0 (تم تسليمه)
      const response = await api.updateOrderItemPrepared(orderId, itemIndex, { preparedCount: 0 });
      if (response.success) {
        console.log('✅ Item delivered successfully');

        // التحقق من حالة الطلب بعد التحديث
        const updatedOrder = response.data;
        if (updatedOrder) {
          // التحقق من حالة الطلب من response
          const orderStatus = (response as any).orderStatus;

          if (orderStatus?.shouldMoveToDelivered) {
            // إذا تم تسليم جميع الأصناف، الطلب أصبح delivered
            console.log('✅ All items delivered, order is now delivered');

            // إزالة الطلب من readyOrders
            setReadyOrders(prev => {
              const filtered = prev.filter(o => o._id !== orderId);
              console.log('📋 Removed from readyOrders, remaining:', filtered.length);
              return filtered;
            });

            // إزالة الطلب من pendingOrders إذا كان موجوداً هناك
            setPendingOrders(prev => {
              const filtered = prev.filter(o => o._id !== orderId);
              console.log('📋 Removed from pendingOrders, remaining:', filtered.length);
              return filtered;
            });

            showNotification(`تم تسليم ${itemName} واكتمل الطلب`, 'success');
          } else if (orderStatus?.anyItemsPrepared) {
            // إذا تبقى أصناف جاهزة، تحديث الواجهة فقط
            setReadyOrders(prev => {
              const updatedOrders = prev.map(o => {
                if (o._id === orderId) {
                  const updatedOrder = { ...o };
                  updatedOrder.items = [...o.items];
                  updatedOrder.items[itemIndex] = {
                    ...o.items[itemIndex],
                    preparedCount: 0
                  };
                  return updatedOrder;
                }
                return o;
              });
              return updatedOrders;
            });

            showNotification(`تم تسليم ${itemName} بنجاح`, 'success');
          } else {
            // إذا لم تتبق أي أصناف جاهزة، إزالة الطلب من readyOrders
            setReadyOrders(prev => prev.filter(o => o._id !== orderId));
            showNotification(`تم تسليم ${itemName} بنجاح`, 'success');
          }
        }

        // إعادة تحميل البيانات للتأكد من التحديث
        setTimeout(() => {
          console.log('🔄 Refreshing data after item delivery...');
          fetchPendingOrders();
          fetchReadyOrders();
          console.log('✅ Data refresh completed');
        }, 500);
      } else {
        console.error('❌ Failed to deliver item:', response);
        showNotification('خطأ في تسليم الصنف', 'error');
      }
    } catch (error) {
      console.error('❌ Error delivering item:', error);
      showNotification('خطأ في تسليم الصنف', 'error');
    }
  };

  // Function to show order details
  const handleOrderClick = (order: Order) => {
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
          <Coffee className="h-8 w-8 text-primary-600 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إدارة الكافيه</h1>
            <p className="text-gray-600">طلبات الكافيه والمشروبات للعملاء</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">طلبات غير مكتملة</p>
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
              <p className="text-sm font-medium text-gray-600">أصناف جاهزة</p>
              <p className="text-2xl font-bold text-green-600">{readyItems.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Coffee className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">أصناف غير جاهزة</p>
              <p className="text-2xl font-bold text-blue-600">
                {incompleteOrders.reduce((sum, order) => sum + getUnpreparedItemsCount(order), 0)}
              </p>
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

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <User className="h-6 w-6 text-orange-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">إجمالي الطلبات اليوم</p>
              <p className="text-2xl font-bold text-orange-600">
                {todayStats.totalOrders}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">الطلبات غير المكتملة</h3>
        </div>
        <div className="p-6">
          {incompleteOrders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد طلبات غير مكتملة</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {incompleteOrders.map((order) => (
                <div
                  key={order._id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 cursor-pointer"
                  onClick={() => handleOrderClick(order)}
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

                  {/* Content */}
                  <div className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">الأصناف غير الجاهزة:</span>
                        <span className="font-semibold text-red-600">{getUnpreparedItemsCount(order)}</span>
                      </div>

                      {/* عرض الأصناف غير الجاهزة فقط */}
                      {order.items && order.items.length > 0 && (
                        <div className="text-xs text-gray-600">
                          <div className="font-medium mb-1">الأصناف غير الجاهزة:</div>
                          {order.items.map((item, index) => {
                            const prepared = item.preparedCount || 0;
                            const quantity = item.quantity || 0;
                            const remaining = quantity - prepared;

                            if (remaining > 0) {
                              return (
                                <div key={index} className="flex justify-between items-center py-1">
                                  <span className="truncate">{item.name}</span>
                                  <span className="text-red-600 font-medium">
                                    {prepared}/{quantity} (متبقي: {remaining})
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          }).filter(Boolean)}
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
                  <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-lg">
                    <div className="flex items-center justify-center text-sm font-medium text-primary-600">
                      <Coffee className="h-4 w-4 mr-1" />
                      انقر لعرض التفاصيل
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ready Items List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">الأصناف الجاهزة للتسليم</h3>
        </div>
        <div className="p-6">
          {readyItems.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد أصناف جاهزة للتسليم</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {readyItems.map((item) => (
                <div
                  key={item._id}
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
                      <span className="text-xs text-gray-500">#{item.orderNumber}</span>
                    </div>

                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <User className="h-4 w-4 mr-1" />
                      <span className="truncate">{item.customerName}</span>
                    </div>

                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{new Date(item.orderCreatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">الصنف:</span>
                        <span className="font-semibold text-gray-900">{item.itemName}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">الكمية الجاهزة:</span>
                        <span className="font-semibold text-green-600">{item.quantity}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">السعر:</span>
                        <span className="font-semibold text-gray-900">{item.totalPrice} ج.م</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-gray-100 bg-green-50 rounded-b-lg">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          // البحث عن الطلب الأصلي وعرض تفاصيله
                          const originalOrder = readyOrders.find(o => o._id === item.orderId);
                          if (originalOrder) {
                            handleOrderClick(originalOrder);
                          }
                        }}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        <Coffee className="h-4 w-4 mr-1 inline" />
                        عرض الطلب
                      </button>
                      <button
                        onClick={() => {
                          // البحث عن index الصنف في الطلب الأصلي
                          const originalOrder = readyOrders.find(o => o._id === item.orderId);
                          if (originalOrder && originalOrder.items) {
                            const itemIndex = originalOrder.items.findIndex(orderItem => orderItem.name === item.itemName);
                            if (itemIndex !== -1) {
                              deliverItem(item.orderId, item.itemName, itemIndex);
                            } else {
                              showNotification('خطأ: لم يتم العثور على الصنف', 'error');
                            }
                          } else {
                            showNotification('خطأ: لم يتم العثور على الطلب', 'error');
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        تسليم الصنف
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
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">جاري تحميل القائمة...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(menuItemsByCategory).map(([category, items]) => (
                        <div key={category}>
                          <h5 className="font-medium text-gray-700 mb-2">{category}</h5>
                          <div className="space-y-2">
                            {items.filter(item => item.isAvailable).map(item => (
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
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">إضافات برسوم:</label>
                            {item.addons && item.addons.length > 0 && (
                              <ul className="mb-2">
                                {item.addons.map((addon, aIdx) => (
                                  <li key={aIdx} className="flex items-center space-x-2 space-x-reverse text-sm mb-1">
                                    <span>{addon.name} ({addon.price} ج.م)</span>
                                    <button
                                      onClick={() => {
                                        const updatedOrder = [...currentOrder];
                                        updatedOrder[index].addons = updatedOrder[index].addons.filter((_, i) => i !== aIdx);
                                        setCurrentOrder(updatedOrder);
                                      }}
                                      className="text-red-400 hover:text-red-600 text-xs ml-2"
                                      title="حذف الإضافة"
                                    >
                                      حذف
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="flex items-center space-x-2 space-x-reverse">
                              <input
                                type="text"
                                placeholder="اسم الإضافة"
                                className="border border-gray-300 rounded px-2 py-1 text-xs w-1/2"
                                value={item._newAddonName || ''}
                                onChange={e => {
                                  const updatedOrder = [...currentOrder];
                                  updatedOrder[index]._newAddonName = e.target.value;
                                  setCurrentOrder(updatedOrder);
                                }}
                              />
                              <input
                                type="number"
                                placeholder="السعر"
                                className="border border-gray-300 rounded px-2 py-1 text-xs w-1/4"
                                min={0}
                                value={item._newAddonPrice || ''}
                                onChange={e => {
                                  const updatedOrder = [...currentOrder];
                                  updatedOrder[index]._newAddonPrice = e.target.value;
                                  setCurrentOrder(updatedOrder);
                                }}
                              />
                              <button
                                type="button"
                                className="bg-green-500 hover:bg-green-600 text-white rounded px-2 py-1 text-xs"
                                onClick={() => {
                                  if (!item._newAddonName || !item._newAddonPrice || isNaN(Number(item._newAddonPrice))) return;
                                  const updatedOrder = [...currentOrder];
                                  updatedOrder[index].addons = [
                                    ...(updatedOrder[index].addons || []),
                                    { name: item._newAddonName, price: Number(item._newAddonPrice) }
                                  ];
                                  delete updatedOrder[index]._newAddonName;
                                  delete updatedOrder[index]._newAddonPrice;
                                  setCurrentOrder(updatedOrder);
                                }}
                              >
                                إضافة
                              </button>
                            </div>
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
                    {hasAnyPreparedItems(selectedOrder) ? (
                      hasUnpreparedItems(selectedOrder) ? (
                        <div className="flex items-center">
                          <span className="text-yellow-600 text-sm font-medium mr-2">⚠ جزئي</span>
                          <span className="text-xs text-gray-500">
                            {getUnpreparedItemsCount(selectedOrder)} صنف غير جاهز
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="text-green-600 text-sm font-medium mr-2">✓ جاهز بالكامل</span>
                          <span className="text-xs text-gray-500">جميع الأصناف جاهزة</span>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center">
                        <span className="text-red-600 text-sm font-medium mr-2">✗ غير جاهز</span>
                        <span className="text-xs text-gray-500">لا توجد أصناف جاهزة</span>
                      </div>
                    )}
                  </div>

                  {/* تفاصيل إضافية */}
                  <div className="mt-2 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>إجمالي الأصناف: {selectedOrder.items?.length || 0}</span>
                      <span>الأصناف الجاهزة: {(selectedOrder.items?.filter(item => (item.preparedCount || 0) >= (item.quantity || 0)).length || 0)}</span>
                      <span>الأصناف الجزئية: {(selectedOrder.items?.filter(item => (item.preparedCount || 0) > 0 && (item.preparedCount || 0) < (item.quantity || 0)).length || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">الأصناف المطلوبة</h4>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, index) => {
                    const preparedCount = item.preparedCount || 0;
                    const remaining = (item.quantity || 0) - preparedCount;
                    const isFullyPrepared = preparedCount >= (item.quantity || 0);
                    const isPartiallyPrepared = preparedCount > 0 && preparedCount < (item.quantity || 0);

                    return (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <span className="font-medium text-gray-900">{item.name}</span>
                            {isFullyPrepared && (
                              <span className="mr-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                جاهز
                              </span>
                            )}
                            {isPartiallyPrepared && (
                              <span className="mr-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                                جزئي
                              </span>
                            )}
                            {!isPartiallyPrepared && !isFullyPrepared && (
                              <span className="mr-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                                غير جاهز
                              </span>
                            )}
                          </div>
                          <span className="text-gray-600">{item.price * (item.quantity || 0)} ج.م</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 space-x-reverse">
                            <span className="text-sm text-gray-600">
                              الكمية: {item.quantity} | الجاهز: {preparedCount} | المتبقي: {remaining}
                            </span>
                            {isFullyPrepared && (
                              <span className="text-green-600 text-sm font-medium">✓ جاهز بالكامل</span>
                            )}
                            {isPartiallyPrepared && (
                              <span className="text-yellow-600 text-sm font-medium">⚠ جزئي</span>
                            )}
                            {!isPartiallyPrepared && !isFullyPrepared && (
                              <span className="text-red-600 text-sm font-medium">✗ غير جاهز</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            {remaining > 0 && (
                              <button
                                onClick={() => updateItemPrepared(selectedOrder._id, index, preparedCount + 1)}
                                className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition-colors duration-200"
                                title={`إضافة واحد إلى ${item.name}`}
                              >
                                +1
                              </button>
                            )}
                            {preparedCount > 0 && (
                              <button
                                onClick={() => updateItemPrepared(selectedOrder._id, index, preparedCount - 1)}
                                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors duration-200"
                                title={`إزالة واحد من ${item.name}`}
                              >
                                -1
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-center py-4">لا توجد عناصر في هذا الطلب</p>
                )}
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
                {selectedOrder && hasAnyPreparedItems(selectedOrder) && (
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
