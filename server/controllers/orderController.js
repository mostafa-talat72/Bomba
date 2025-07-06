import Order from '../models/Order.js';
import InventoryItem from '../models/InventoryItem.js';
import MenuItem from '../models/MenuItem.js';
import Bill from '../models/Bill.js';

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
export const getOrders = async (req, res) => {
  try {
    console.log('🔍 Getting orders with query:', req.query);

    const { status, tableNumber, page = 1, limit = 10, date } = req.query;

    const query = {};
    if (status) query.status = status;
    if (tableNumber) query.tableNumber = tableNumber;

    // Filter by date if provided
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      query.createdAt = {
        $gte: startDate,
        $lt: endDate
      };
    }

    console.log('🔍 Query:', query);

    const orders = await Order.find(query)
      .populate('createdBy', 'name')
      .populate('preparedBy', 'name')
      .populate('deliveredBy', 'name')
      .populate('bill')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    console.log('📋 Found orders:', orders.length);
    console.log('📋 Orders data:', orders);

    // Log details of each order
    orders.forEach((order, index) => {
      console.log(`📋 Order ${index + 1}:`, {
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        itemsCount: order.items ? order.items.length : 0,
        items: order.items,
        status: order.status,
        finalAmount: order.finalAmount
      });
    });

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      count: orders.length,
      total,
      data: orders
    });
  } catch (error) {
    console.error('❌ Error getting orders:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الطلبات',
      error: error.message
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('preparedBy', 'name')
      .populate('deliveredBy', 'name')
      .populate('bill');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الطلب',
      error: error.message
    });
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res) => {
  try {
    console.log('📝 Creating new order with data:', req.body);

    const { tableNumber, customerName, customerPhone, items, notes, bill } = req.body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب إضافة عنصر واحد على الأقل للطلب'
      });
    }

    // Process items and calculate totals
    const processedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItem);
      if (!menuItem) {
        return res.status(400).json({
          success: false,
          message: `عنصر القائمة غير موجود: ${item.menuItem}`
        });
      }

      if (!menuItem.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `العنصر غير متاح: ${menuItem.name}`
        });
      }

      // Calculate addons total
      const addonsTotal = item.addons ? item.addons.reduce((sum, addon) => sum + addon.price, 0) : 0;

      // Calculate item total
      const itemTotal = (menuItem.price + addonsTotal) * item.quantity;
      subtotal += itemTotal;

      processedItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        arabicName: menuItem.arabicName || menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        addons: item.addons || [],
        addonsTotal,
        itemTotal,
        notes: item.notes,
        preparationTime: menuItem.preparationTime
      });
    }

    // Create order
    const orderData = {
      tableNumber,
      customerName,
      customerPhone,
      items: processedItems,
      subtotal,
      finalAmount: subtotal, // No discount initially
      notes,
      bill,
      createdBy: req.user.id
    };

    console.log('💰 Order totals calculated:', {
      subtotal,
      finalAmount: orderData.finalAmount,
      itemsCount: processedItems.length
    });

    console.log('📋 Processed items:', processedItems);
    console.log('📄 Order data:', orderData);

    const order = new Order(orderData);

    // Manual calculation as fallback
    order.finalAmount = order.subtotal - (order.discount || 0);

    console.log('💰 Final order amounts:', {
      subtotal: order.subtotal,
      discount: order.discount,
      finalAmount: order.finalAmount
    });

    // Generate order number manually
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await Order.countDocuments({
      createdAt: {
        $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      }
    });
    order.orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    console.log('🔢 Generated order number:', order.orderNumber);
    console.log('💾 Saving order...');

    await order.save();

    console.log('✅ Order saved successfully');

    // Populate the order with related data for response
    const populatedOrder = await Order.findById(order._id)
      .populate('createdBy', 'name')
      .populate('bill')
      .populate('items.menuItem');

    console.log('📋 Final populated order:', populatedOrder);

    // Add order to bill if bill exists
    if (bill) {
      try {
        const billDoc = await Bill.findById(bill);
        if (billDoc) {
          billDoc.orders.push(order._id);
          await billDoc.save();
          console.log('✅ Order added to bill:', billDoc.billNumber);

          // Recalculate bill totals
          await billDoc.calculateSubtotal();
          console.log('✅ Bill totals recalculated');
        }
      } catch (error) {
        console.error('❌ Error adding order to bill:', error);
      }
    }

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      data: populatedOrder
    });
  } catch (error) {
    console.error('❌ Error creating order:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'بيانات الطلب غير صحيحة',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء الطلب',
      error: error.message
    });
  }
};

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private
export const updateOrder = async (req, res) => {
  try {
    const { status, notes, preparedBy, deliveredBy } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    // Update fields
    if (status) {
      order.status = status;

      if (status === 'preparing' && preparedBy) {
        order.preparedBy = preparedBy;
      } else if (status === 'delivered' && deliveredBy) {
        order.deliveredBy = deliveredBy;
      }
    }

    if (notes !== undefined) order.notes = notes;

    await order.save();
    await order.populate(['createdBy', 'preparedBy', 'deliveredBy'], 'name');

    // Notify via Socket.IO
    if (req.io) {
      req.io.notifyOrderUpdate('status-changed', order);
    }

    res.json({
      success: true,
      message: 'تم تحديث الطلب بنجاح',
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث الطلب',
      error: error.message
    });
  }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    // Only allow deletion if order is pending
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن حذف طلب تم البدء في تحضيره'
      });
    }

    // Restore inventory if items were consumed
    for (const item of order.items) {
      if (item.inventoryItem) {
        const inventoryItem = await InventoryItem.findById(item.inventoryItem);
        if (inventoryItem) {
          await inventoryItem.addStockMovement(
            'in',
            item.quantity,
            `استرداد من حذف طلب رقم ${order.orderNumber}`,
            req.user._id,
            order._id.toString()
          );
        }
      }
    }

    await order.deleteOne();

    res.json({
      success: true,
      message: 'تم حذف الطلب بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في حذف الطلب',
      error: error.message
    });
  }
};

// @desc    Get pending orders
// @route   GET /api/orders/pending
// @access  Private
export const getPendingOrders = async (req, res) => {
  try {
    console.log('🔍 Getting pending orders...');

    const orders = await Order.find({
      status: { $in: ['pending', 'preparing'] }
    })
    .populate('items.menuItem', 'name arabicName preparationTime')
    .populate('bill', 'billNumber customerName tableNumber')
    .populate('createdBy', 'name')
    .sort({ createdAt: 1 });

    console.log('📋 Found pending orders:', orders.length);

    // Log details of each order
    orders.forEach((order, index) => {
      console.log(`📋 Order ${index + 1}:`, {
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        itemsCount: order.items ? order.items.length : 0,
        items: order.items?.map(item => ({
          name: item.name,
          quantity: item.quantity,
          preparedCount: item.preparedCount || 0
        }))
      });
    });

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('❌ Error getting pending orders:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الطلبات المعلقة',
      error: error.message
    });
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private
export const getOrderStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' }
        }
      }
    ]);

    const totalOrders = await Order.countDocuments(filter);
    const totalAmount = await Order.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);

    res.json({
      success: true,
      data: {
        stats,
        totalOrders,
        totalAmount: totalAmount[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('❌ Error getting order stats:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب إحصائيات الطلبات',
      error: error.message
    });
  }
};

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    if (order.status === 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إلغاء طلب مسلم'
      });
    }

    order.status = 'cancelled';
    if (reason) {
      order.notes = order.notes ? `${order.notes}\nسبب الإلغاء: ${reason}` : `سبب الإلغاء: ${reason}`;
    }

    await order.save();

    res.json({
      success: true,
      message: 'تم إلغاء الطلب بنجاح',
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في إلغاء الطلب',
      error: error.message
    });
  }
};

// @desc    Update order item status
// @route   PATCH /api/orders/:id/items/:itemIndex/status
// @access  Private
export const updateOrderItemStatus = async (req, res) => {
  try {
    const { id, itemIndex } = req.params;
    const { isReady } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    if (itemIndex < 0 || itemIndex >= order.items.length) {
      return res.status(400).json({
        success: false,
        message: 'فهرس العنصر غير صحيح'
      });
    }

    order.items[itemIndex].isReady = isReady;
    if (isReady) {
      order.items[itemIndex].readyTime = new Date();
    }

    // Check if all items are ready
    const allItemsReady = order.items.every(item => item.isReady);
    if (allItemsReady && order.status === 'preparing') {
      order.status = 'ready';
      order.actualReadyTime = new Date();
    }

    await order.save();

    res.json({
      success: true,
      message: 'تم تحديث حالة العنصر بنجاح',
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث حالة العنصر',
      error: error.message
    });
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'حالة الطلب مطلوبة'
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    // تحقق قبل السماح بتغيير الحالة إلى delivered
    if (status === 'delivered') {
      // يجب أن تكون كل الأصناف تم تجهيزها بالكامل ثم تسليمها (preparedCount === 0 && isReady === true)
      const allItemsWereReady = order.items.every(item => item.isReady === true);
      const allItemsDelivered = order.items.every(item => (item.preparedCount || 0) === 0);
      if (!(allItemsWereReady && allItemsDelivered)) {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن تسليم الطلب إلا بعد تجهيز وتسليم جميع الأصناف.'
        });
      }
    }

    const updateData = { status };

    // Set preparedBy when status changes to preparing
    if (status === 'preparing' && order.status === 'pending') {
      updateData.preparedBy = req.user.id;
    }

    // Set deliveredBy when status changes to delivered
    if (status === 'delivered' && order.status !== 'delivered') {
      updateData.deliveredBy = req.user.id;
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('items.menuItem', 'name arabicName')
    .populate('bill', 'billNumber customerName')
    .populate('createdBy', 'name')
    .populate('preparedBy', 'name')
    .populate('deliveredBy', 'name');

    res.json({
      success: true,
      message: 'تم تحديث حالة الطلب بنجاح',
      data: updatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث حالة الطلب',
      error: error.message
    });
  }
};

// @desc    Update preparedCount for an item in an order
// @route   PUT /api/orders/:orderId/item/:itemIndex/prepared
// @access  Private
export const updateOrderItemPrepared = async (req, res) => {
  try {
    const { orderId, itemIndex } = req.params;
    const { preparedCount } = req.body;

    console.log('🔄 Updating prepared count:', { orderId, itemIndex, preparedCount });

    const order = await Order.findById(orderId);
    if (!order) {
      console.log('❌ Order not found:', orderId);
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    if (!order.items[itemIndex]) {
      console.log('❌ Item not found at index:', itemIndex);
      return res.status(404).json({ success: false, message: 'العنصر غير موجود في الطلب' });
    }

    console.log('📋 Before update - Item:', {
      name: order.items[itemIndex].name,
      quantity: order.items[itemIndex].quantity,
      preparedCount: order.items[itemIndex].preparedCount,
      isReady: order.items[itemIndex].isReady,
      wasEverReady: order.items[itemIndex].wasEverReady
    });

    // تحديث العدد الجاهز مع التأكد من عدم تجاوز الكمية المطلوبة
    const newPreparedCount = Math.max(0, Math.min(preparedCount, order.items[itemIndex].quantity));
    order.items[itemIndex].preparedCount = newPreparedCount;

    // تحديث isReady و wasEverReady تلقائياً
    if (newPreparedCount >= order.items[itemIndex].quantity) {
      order.items[itemIndex].isReady = true;
      order.items[itemIndex].wasEverReady = true;
    }
    // لا نضع isReady = false عند التسليم لأن الصنف كان جاهزاً مسبقاً

    // التحقق من حالة الطلب الكلية وتحديثها إذا لزم الأمر
    const allItemsReady = order.items.every(item => (item.preparedCount || 0) >= (item.quantity || 0));
    const anyItemsPrepared = order.items.some(item => (item.preparedCount || 0) > 0);
    const allItemsDelivered = order.items.every(item => (item.preparedCount || 0) === 0);
    const allItemsWereReady = order.items.every(item => item.isReady === true);

        // منطق محسن: إذا تم تسليم جميع الأصناف وكانت جاهزة مسبقاً
    const allItemsWereEverReady = order.items.every(item => item.wasEverReady === true);
    const shouldBeDelivered = allItemsDelivered && allItemsWereEverReady;

    // تحديث حالة الطلب بناءً على حالة الأصناف
    if (shouldBeDelivered) {
      // إذا تم تسليم جميع الأصناف وكانت جاهزة مسبقاً، انقل الطلب إلى delivered
      order.status = 'delivered';
      order.deliveredTime = new Date();
      order.deliveredBy = req.user.id;
      console.log('✅ Order status updated to delivered (all items delivered and were ready)');
    } else if (anyItemsPrepared && order.status !== 'ready') {
      order.status = 'ready';
      if (allItemsReady) {
        order.actualReadyTime = new Date();
      }
      console.log('✅ Order status updated to ready (some items prepared)');
    } else if (!anyItemsPrepared && order.status !== 'pending') {
      order.status = 'pending';
      console.log('⚠ Order status updated to pending (no items prepared)');
    }

    console.log('📋 After update - Item:', {
      name: order.items[itemIndex].name,
      quantity: order.items[itemIndex].quantity,
      preparedCount: order.items[itemIndex].preparedCount,
      isReady: order.items[itemIndex].isReady,
      wasEverReady: order.items[itemIndex].wasEverReady
    });

    await order.save();
    console.log('✅ Order saved successfully');

    // إعادة تحميل الطلب مع البيانات المحدثة
    const updatedOrder = await Order.findById(order._id)
      .populate('items.menuItem', 'name arabicName preparationTime')
      .populate('bill', 'billNumber customerName tableNumber')
      .populate('createdBy', 'name')
      .populate('preparedBy', 'name')
      .populate('deliveredBy', 'name')
      .lean(); // استخدام lean() للحصول على كائن JavaScript عادي

    if (!updatedOrder) {
      console.error('❌ Failed to reload updated order');
      return res.status(500).json({
        success: false,
        message: 'خطأ في إعادة تحميل الطلب المحدث',
        error: 'Order not found after update'
      });
    }

    console.log('📋 Updated order data:', {
      orderNumber: updatedOrder.orderNumber,
      itemsCount: updatedOrder.items?.length || 0,
      items: updatedOrder.items?.map(item => ({
        name: item.name,
        quantity: item.quantity,
        preparedCount: item.preparedCount || 0,
        isReady: item.isReady,
        wasEverReady: item.wasEverReady
      }))
    });

    // التحقق من حالة الطلب الكلية (بعد التحديث)
    const finalAllItemsReady = updatedOrder.items?.every(item =>
      (item.preparedCount || 0) >= (item.quantity || 0)
    );
    const finalAnyItemsPrepared = updatedOrder.items?.some(item =>
      (item.preparedCount || 0) > 0
    );
    const finalAllItemsDelivered = updatedOrder.items?.every(item =>
      (item.preparedCount || 0) === 0
    );
    const finalAllItemsWereReady = updatedOrder.items?.every(item => item.isReady === true);

        // منطق محسن للتحقق من حالة التسليم
    const finalAllItemsWereEverReady = updatedOrder.items?.every(item => item.wasEverReady === true);
    const finalShouldBeDelivered = finalAllItemsDelivered && finalAllItemsWereEverReady;

    console.log('📋 Order overall status:', {
      allItemsReady: finalAllItemsReady,
      anyItemsPrepared: finalAnyItemsPrepared,
      allItemsDelivered: finalAllItemsDelivered,
      allItemsWereReady: finalAllItemsWereReady,
      allItemsWereEverReady: finalAllItemsWereEverReady,
      shouldBeDelivered: finalShouldBeDelivered,
      currentStatus: updatedOrder.status
    });

    return res.json({
      success: true,
      message: 'تم تحديث حالة التجهيز بنجاح',
      data: updatedOrder,
      orderStatus: {
        allItemsReady: finalAllItemsReady,
        anyItemsPrepared: finalAnyItemsPrepared,
        allItemsDelivered: finalAllItemsDelivered,
        allItemsWereReady: finalAllItemsWereReady,
        shouldMoveToReady: finalAllItemsReady,
        shouldMoveToPending: !finalAnyItemsPrepared,
        shouldMoveToDelivered: finalShouldBeDelivered
      }
    });
  } catch (error) {
    console.error('❌ Error updating preparedCount:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ في تحديث حالة التجهيز',
      error: error.message
    });
  }
};

// @desc    Get today's orders statistics
// @route   GET /api/orders/today-stats
// @access  Private
export const getTodayOrdersStats = async (req, res) => {
  try {
    console.log('📊 Getting today\'s orders statistics...');

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    console.log('📅 Date range:', { startOfDay, endOfDay });

    // Get all orders created today
    const todayOrders = await Order.find({
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    }).select('finalAmount totalAmount status createdAt');

    console.log('📋 Found today\'s orders:', todayOrders.length);

    // Calculate statistics
    const totalOrders = todayOrders.length;
    const totalSales = todayOrders.reduce((sum, order) => {
      return sum + (order.finalAmount || order.totalAmount || 0);
    }, 0);

    // Group by status
    const ordersByStatus = todayOrders.reduce((acc, order) => {
      const status = order.status;
      if (!acc[status]) {
        acc[status] = { count: 0, amount: 0 };
      }
      acc[status].count++;
      acc[status].amount += (order.finalAmount || order.totalAmount || 0);
      return acc;
    }, {});

    console.log('📊 Today\'s statistics:', {
      totalOrders,
      totalSales,
      ordersByStatus
    });

    res.json({
      success: true,
      data: {
        totalOrders,
        totalSales,
        ordersByStatus,
        date: today.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('❌ Error getting today\'s orders statistics:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب إحصائيات طلبات اليوم',
      error: error.message
    });
  }
};
