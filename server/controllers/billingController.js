import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import Session from '../models/Session.js';

// @desc    Get all bills
// @route   GET /api/bills
// @access  Private
export const getBills = async (req, res) => {
  try {
    const { status, tableNumber, page = 1, limit = 10, date, customerName } = req.query;

    const query = {};
    if (status) query.status = status;
    if (tableNumber) query.tableNumber = tableNumber;
    if (customerName) query.customerName = { $regex: customerName, $options: 'i' };

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

    const bills = await Bill.find(query)
      .populate({
        path: 'orders',
        populate: {
          path: 'items.menuItem',
          select: 'name arabicName preparationTime'
        }
      })
      .populate({
        path: 'sessions',
        populate: {
          path: 'createdBy',
          select: 'name'
        }
      })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .populate('payments.user', 'name')
      .populate('partialPayments.items.paidBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Update bills that have orders but zero total
    for (const bill of bills) {
      if (bill.orders && bill.orders.length > 0 && bill.total === 0) {
        console.log('🔄 Updating bill with zero total:', bill.billNumber);
        await bill.calculateSubtotal();
      }
    }

    const total = await Bill.countDocuments(query);

    res.json({
      success: true,
      count: bills.length,
      total,
      data: bills
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الفواتير',
      error: error.message
    });
  }
};

// @desc    Get single bill
// @route   GET /api/billing/:id
// @access  Public (for QR code access)
export const getBill = async (req, res) => {
  try {
    console.log('🔍 Fetching bill with ID:', req.params.id);

    // Validate bill ID format
    if (!req.params.id || req.params.id.length !== 24) {
      return res.status(400).json({
        success: false,
        message: 'معرف الفاتورة غير صحيح'
      });
    }

    const bill = await Bill.findById(req.params.id)
      .populate({
        path: 'orders',
        populate: [
          {
            path: 'items.menuItem',
            select: 'name arabicName preparationTime price'
          },
          {
            path: 'createdBy',
            select: 'name'
          }
        ]
      })
      .populate({
        path: 'sessions',
        populate: {
          path: 'createdBy',
          select: 'name'
        }
      })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .populate({
        path: 'payments.user',
        select: 'name'
      });

    if (!bill) {
      console.log('❌ Bill not found:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    console.log('✅ Bill found:', {
      id: bill._id,
      billNumber: bill.billNumber,
      total: bill.total,
      status: bill.status,
      ordersCount: bill.orders?.length || 0,
      sessionsCount: bill.sessions?.length || 0
    });

    // Log orders data for debugging
    if (bill.orders && bill.orders.length > 0) {
      console.log('📋 Orders data in bill:', bill.orders.map(order => ({
        orderNumber: order.orderNumber,
        status: order.status,
        itemsCount: order.items?.length || 0,
        items: order.items?.map(item => ({
          name: item.name,
          quantity: item.quantity,
          preparedCount: item.preparedCount,
          isReady: item.isReady,
          hasPreparedCount: item.preparedCount !== undefined
        }))
      })));

      // Log detailed preparedCount information
      bill.orders.forEach((order, orderIndex) => {
        console.log(`📋 Order ${orderIndex + 1} (${order.orderNumber}) details:`, {
          status: order.status,
          items: order.items?.map((item, itemIndex) => ({
            index: itemIndex,
            name: item.name,
            quantity: item.quantity,
            preparedCount: item.preparedCount,
            isReady: item.isReady,
            preparedCountType: typeof item.preparedCount,
            preparedCountDefined: item.preparedCount !== undefined
          }))
        });
      });
    }

    // Update bill if it has orders but zero total
    if (bill.orders && bill.orders.length > 0 && bill.total === 0) {
      console.log('🔄 Updating bill with zero total:', bill.billNumber);
      await bill.calculateSubtotal();
    }

    // Format the response
    const formattedBill = {
      _id: bill._id,
      billNumber: bill.billNumber,
      customerName: bill.customerName,
      customerPhone: bill.customerPhone,
      tableNumber: bill.tableNumber,
      orders: bill.orders || [],
      sessions: bill.sessions || [],
      subtotal: bill.subtotal || 0,
      discount: bill.discount || 0,
      tax: bill.tax || 0,
      total: bill.total || 0,
      paid: bill.paid || 0,
      remaining: bill.remaining || 0,
      status: bill.status,
      billType: bill.billType,
      payments: bill.payments || [],
      partialPayments: bill.partialPayments || [],
      qrCode: bill.qrCode,
      qrCodeUrl: bill.qrCodeUrl,
      notes: bill.notes,
      dueDate: bill.dueDate,
      createdBy: bill.createdBy,
      updatedBy: bill.updatedBy,
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt
    };

    res.json({
      success: true,
      data: formattedBill
    });
  } catch (error) {
    console.error('❌ Error fetching bill:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الفاتورة',
      error: error.message
    });
  }
};

// @desc    Create new bill
// @route   POST /api/bills
// @access  Private
export const createBill = async (req, res) => {
  try {
    console.log('🔍 Create Bill Request:', {
      body: req.body,
      user: req.user ? { id: req.user._id, name: req.user.name } : 'No user',
      headers: req.headers.authorization ? 'Token present' : 'No token'
    });

        const {
      tableNumber,
      customerName,
      customerPhone,
      orders,
      sessions,
      discount,
      tax,
      notes,
      billType,
      dueDate
    } = req.body;

    // Validate required fields
    if (!req.user || !req.user._id) {
      console.error('❌ No user found in request');
      return res.status(401).json({
        success: false,
        message: 'يجب تسجيل الدخول أولاً'
      });
    }

    if (!tableNumber && tableNumber !== 0) {
      console.error('❌ tableNumber is required');
      return res.status(400).json({
        success: false,
        message: 'رقم الطاولة مطلوب'
      });
    }

    // Validate sessions if provided
    if (sessions && sessions.length > 0) {
      try {
        const sessionIds = sessions.map(id => new mongoose.Types.ObjectId(id));
        const existingSessions = await Session.find({ _id: { $in: sessionIds } });

        if (existingSessions.length !== sessions.length) {
          console.error('❌ Some sessions not found');
          return res.status(400).json({
            success: false,
            message: 'بعض الجلسات غير موجودة'
          });
        }

        console.log(`✅ Found ${existingSessions.length} valid sessions`);
      } catch (error) {
        console.error('❌ Invalid session IDs:', error);
        return res.status(400).json({
          success: false,
          message: 'معرفات الجلسات غير صحيحة'
        });
      }
    }

    console.log('📝 Creating bill with data:', {
      tableNumber,
      customerName,
      customerPhone,
      orders: orders?.length || 0,
      sessions: sessions?.length || 0,
      discount,
      tax,
      notes,
      billType,
      dueDate,
      createdBy: req.user._id
    });

    const bill = await Bill.create({
      tableNumber,
      customerName,
      customerPhone,
      orders: orders || [],
      sessions: sessions || [],
      discount: discount || 0,
      tax: tax || 0,
      notes,
      billType: billType || 'cafe',
      dueDate,
      createdBy: req.user._id
    });

        console.log('✅ Bill created successfully:', bill.billNumber);

    // Calculate subtotal from orders and sessions (only if there are orders or sessions)
    if ((orders && orders.length > 0) || (sessions && sessions.length > 0)) {
      await bill.calculateSubtotal();
    } else {
      console.log('ℹ️ No orders or sessions to calculate subtotal');
    }

    // Update orders and sessions to reference this bill
    if (orders && orders.length > 0) {
      await Order.updateMany(
        { _id: { $in: orders } },
        { bill: bill._id }
      );
    }

    if (sessions && sessions.length > 0) {
      await Session.updateMany(
        { _id: { $in: sessions } },
        { bill: bill._id }
      );
    }

    await bill.populate(['orders', 'sessions', 'createdBy'], 'name');

    // Notify via Socket.IO
    if (req.io) {
      req.io.notifyBillUpdate('created', bill);
    }

    console.log('✅ Bill process completed successfully');

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الفاتورة بنجاح',
      data: bill
    });
  } catch (error) {
    console.error('❌ Create Bill Error:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
      user: req.user ? req.user._id : 'No user'
    });

    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء الفاتورة',
      error: error.message
    });
  }
};

// @desc    Update bill
// @route   PUT /api/bills/:id
// @access  Private
export const updateBill = async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      discount,
      tax,
      notes,
      dueDate
    } = req.body;

    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    // Don't allow updates if bill is paid
    if (bill.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن تعديل فاتورة مدفوعة بالكامل'
      });
    }

    // Update fields
    if (customerName !== undefined) bill.customerName = customerName;
    if (customerPhone !== undefined) bill.customerPhone = customerPhone;
    if (discount !== undefined) bill.discount = discount;
    if (tax !== undefined) bill.tax = tax;
    if (notes !== undefined) bill.notes = notes;
    if (dueDate !== undefined) bill.dueDate = dueDate;

    bill.updatedBy = req.user._id;

    // Recalculate totals
    await bill.calculateSubtotal();

    await bill.populate(['orders', 'sessions', 'createdBy', 'updatedBy'], 'name');

    res.json({
      success: true,
      message: 'تم تحديث الفاتورة بنجاح',
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث الفاتورة',
      error: error.message
    });
  }
};

// @desc    Add payment to bill
// @route   POST /api/bills/:id/payment
// @access  Private
export const addPayment = async (req, res) => {
  try {
    const { amount, method, reference, paid, remaining, status, paymentAmount } = req.body;

    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    // إذا تم إرسال البيانات المحدثة مباشرة (من الفرونت إند الجديد)
    if (paid !== undefined && remaining !== undefined && status !== undefined) {
      bill.paid = paid;
      bill.remaining = remaining;
      bill.status = status;

      // إضافة الدفع الجديد إلى قائمة المدفوعات
      if (paymentAmount && paymentAmount > 0) {
        await bill.addPayment(paymentAmount, method || 'cash', req.user._id, reference);
      }

      bill.updatedBy = req.user._id;
      await bill.save();
    } else {
      // الطريقة القديمة (للتوافق مع الكود القديم)
      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'مبلغ الدفع يجب أن يكون أكبر من صفر'
        });
      }

      if (bill.remaining < amount) {
        return res.status(400).json({
          success: false,
          message: 'مبلغ الدفع أكبر من المبلغ المتبقي'
        });
      }

      await bill.addPayment(amount, method, req.user._id, reference);
    }

    await bill.populate(['orders', 'sessions', 'createdBy', 'updatedBy', 'payments.user'], 'name');

    // Notify via Socket.IO
    if (req.io) {
      req.io.notifyBillUpdate('payment-received', bill);
    }

    res.json({
      success: true,
      message: 'تم تسجيل الدفع بنجاح',
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تسجيل الدفع',
      error: error.message
    });
  }
};

// @desc    Add order to bill
// @route   POST /api/bills/:id/orders
// @access  Private
export const addOrderToBill = async (req, res) => {
  try {
    const { orderId } = req.body;

    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    if (bill.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إضافة طلبات لفاتورة مدفوعة'
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    if (order.bill) {
      return res.status(400).json({
        success: false,
        message: 'الطلب مرتبط بفاتورة أخرى'
      });
    }

    // Add order to bill
    bill.orders.push(orderId);
    order.bill = bill._id;

    await Promise.all([bill.save(), order.save()]);

    // Recalculate totals
    await bill.calculateSubtotal();

    await bill.populate(['orders', 'sessions', 'createdBy', 'partialPayments.items.paidBy'], 'name');

    res.json({
      success: true,
      message: 'تم إضافة الطلب للفاتورة بنجاح',
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في إضافة الطلب للفاتورة',
      error: error.message
    });
  }
};

// @desc    Add session to bill
// @route   POST /api/bills/:id/sessions
// @access  Private
export const addSessionToBill = async (req, res) => {
  try {
    const { sessionId } = req.body;

    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    if (bill.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إضافة جلسات لفاتورة مدفوعة'
      });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'الجلسة غير موجودة'
      });
    }

    if (session.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إضافة جلسة غير مكتملة للفاتورة'
      });
    }

    // Add session to bill
    bill.sessions.push(sessionId);

    await bill.save();

    // Recalculate totals
    await bill.calculateSubtotal();

    await bill.populate(['orders', 'sessions', 'createdBy'], 'name');

    res.json({
      success: true,
      message: 'تم إضافة الجلسة للفاتورة بنجاح',
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في إضافة الجلسة للفاتورة',
      error: error.message
    });
  }
};

// @desc    Get bill by QR code
// @route   GET /api/bills/qr/:billId
// @access  Public
export const getBillByQR = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.billId)
      .populate('orders')
      .populate('sessions')
      .select('-payments -createdBy -updatedBy');

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    res.json({
      success: true,
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الفاتورة',
      error: error.message
    });
  }
};

// @desc    Cancel bill
// @route   PUT /api/bills/:id/cancel
// @access  Private
export const cancelBill = async (req, res) => {
  try {
    console.log('🔄 ===== CANCEL BILL REQUEST START =====');
    console.log('🔄 Request method:', req.method);
    console.log('🔄 Request URL:', req.originalUrl);
    console.log('🔄 Request params:', req.params);
    console.log('🔄 Request body:', req.body);
    console.log('🔄 Request headers:', req.headers);
    console.log('🔄 User:', req.user ? { id: req.user._id, name: req.user.name } : 'No user');
    console.log('🔄 Cancelling bill with ID:', req.params.id);

    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      console.log('❌ Bill not found:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    console.log('📄 Bill found:', {
      id: bill._id,
      billNumber: bill.billNumber,
      status: bill.status,
      paid: bill.paid,
      total: bill.total
    });

    // تحذير إذا كان هناك مدفوعات جزئية
    if (bill.paid > 0) {
      console.log('⚠️ Warning: Cancelling bill with partial payments:', bill.paid);
      // لا نمنع الإلغاء، فقط نعطي تحذير
    }

    console.log('✅ Proceeding to cancel bill...');
    console.log('✅ Current status:', bill.status);
    console.log('✅ Setting status to: cancelled');

    bill.status = 'cancelled';
    bill.updatedBy = req.user._id;

    console.log('✅ About to save bill...');
    await bill.save();
    console.log('✅ Bill saved successfully');

    console.log('✅ Bill status updated to cancelled');

    // Remove bill reference from orders and sessions
    console.log('✅ Removing bill references from orders and sessions...');
    await Order.updateMany(
      { bill: bill._id },
      { $unset: { bill: 1 } }
    );

    await Session.updateMany(
      { bill: bill._id },
      { $unset: { bill: 1 } }
    );

    console.log('✅ Bill references removed from orders and sessions');

    const message = bill.paid > 0
      ? 'تم إلغاء الفاتورة بنجاح (تحذير: كانت هناك مدفوعات جزئية)'
      : 'تم إلغاء الفاتورة بنجاح';

    console.log('✅ Sending success response:', message);
    console.log('🔄 ===== CANCEL BILL REQUEST END =====');

    res.json({
      success: true,
      message: message,
      data: bill
    });
  } catch (error) {
    console.error('❌ Error cancelling bill:', error);
    console.error('❌ Error stack:', error.stack);
    console.log('🔄 ===== CANCEL BILL REQUEST ERROR =====');
    res.status(500).json({
      success: false,
      message: 'خطأ في إلغاء الفاتورة',
      error: error.message
    });
  }
};

// @desc    Add partial payment for specific items
// @route   POST /api/bills/:id/partial-payment
// @access  Private
export const addPartialPayment = async (req, res) => {
  try {
    console.log('🔄 Adding partial payment for bill:', req.params.id);
    console.log('📄 Request body:', req.body);

    const { orderId, items, paymentMethod } = req.body;

    const bill = await Bill.findById(req.params.id)
      .populate('orders');

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    if (bill.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إضافة مدفوعات لفاتورة ملغية'
      });
    }

    // Find the order
    const order = bill.orders.find(o => o._id.toString() === orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود في هذه الفاتورة'
      });
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد العناصر المطلوب دفعها'
      });
    }

    // Validate that items exist in the order
    const orderItems = order.items || [];
    const validItems = items.filter(item =>
      orderItems.some(orderItem =>
        orderItem.name === item.itemName &&
        orderItem.price === item.price
      )
    );

    if (validItems.length !== items.length) {
      return res.status(400).json({
        success: false,
        message: 'بعض العناصر غير موجودة في الطلب'
      });
    }

    // Add partial payment
    await bill.addPartialPayment(
      orderId,
      order.orderNumber,
      validItems,
      req.user,
      paymentMethod || 'cash'
    );

    // Recalculate totals
    await bill.calculateSubtotal();

    await bill.populate(['orders', 'sessions', 'createdBy', 'partialPayments.items.paidBy'], 'name');

    console.log('✅ Partial payment added successfully');

    res.json({
      success: true,
      message: 'تم إضافة الدفع الجزئي بنجاح',
      data: bill
    });
  } catch (error) {
    console.error('❌ Error adding partial payment:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إضافة الدفع الجزئي',
      error: error.message
    });
  }
};

// @desc    Get bill items for partial payment
// @route   GET /api/bills/:id/items
// @access  Private
export const getBillItems = async (req, res) => {
  try {
    console.log('🔄 Getting bill items for partial payment:', req.params.id);

    const bill = await Bill.findById(req.params.id)
      .populate('orders');

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    const items = [];
    const paidItemsMap = new Map(); // لتتبع الكميات المدفوعة لكل عنصر

    // جمع الكميات المدفوعة من المدفوعات الجزئية
    if (bill.partialPayments && bill.partialPayments.length > 0) {
      bill.partialPayments.forEach(payment => {
        payment.items.forEach(item => {
          const key = `${payment.orderId}-${item.itemName}`;
          const currentPaid = paidItemsMap.get(key) || 0;
          paidItemsMap.set(key, currentPaid + item.quantity);
        });
      });
    }

    // Get items from orders with remaining quantities
    if (bill.orders && bill.orders.length > 0) {
      bill.orders.forEach(order => {
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            const key = `${order._id}-${item.name}`;
            const paidQuantity = paidItemsMap.get(key) || 0;
            const remainingQuantity = item.quantity - paidQuantity;

            // إضافة العنصر فقط إذا كان لديه كمية متبقية
            if (remainingQuantity > 0) {
              items.push({
                orderId: order._id,
                orderNumber: order.orderNumber,
                itemName: item.name,
                price: item.price,
                quantity: remainingQuantity, // الكمية المتبقية فقط
                originalQuantity: item.quantity, // الكمية الأصلية
                paidQuantity: paidQuantity, // الكمية المدفوعة
                totalPrice: item.price * remainingQuantity
              });
            }
          });
        }
      });
    }

    console.log('✅ Found items with remaining quantities:', items.length);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('❌ Error getting bill items:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب عناصر الفاتورة',
      error: error.message
    });
  }
};
