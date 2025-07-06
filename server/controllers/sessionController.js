import Session from '../models/Session.js';
import Device from '../models/Device.js';
import Bill from '../models/Bill.js';

const sessionController = {
  // Get all sessions
  getSessions: async (req, res) => {
    try {
      const { status, deviceType, page = 1, limit = 10 } = req.query;

      const query = {};
      if (status) query.status = status;
      if (deviceType) query.deviceType = deviceType;

      const sessions = await Session.find(query)
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name')
        .sort({ startTime: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Session.countDocuments(query);

      res.json({
        success: true,
        count: sessions.length,
        total,
        data: sessions
      });
    } catch (err) {
      console.error('getSessions error:', err);
      res.status(500).json({
        success: false,
        message: 'خطأ في جلب الجلسات',
        error: err.message
      });
    }
  },

  // Get single session
  getSession: async (req, res) => {
    try {
      const session = await Session.findById(req.params.id)
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name');

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'الجلسة غير موجودة',
          error: 'Session not found'
        });
      }

      res.json({
        success: true,
        data: session
      });
    } catch (err) {
      console.error('getSession error:', err);
      res.status(500).json({
        success: false,
        message: 'خطأ في جلب الجلسة',
        error: err.message
      });
    }
  },

  // Create new session
  createSession: async (req, res) => {
    try {
      const { deviceNumber, deviceName, deviceType, customerName, controllers } = req.body;

      // Validate required fields
      if (!deviceNumber || !deviceName || !deviceType) {
        return res.status(400).json({
          success: false,
          message: 'رقم الجهاز واسمه ونوعه مطلوبان',
          error: 'الحقول المطلوبة ناقصة'
        });
      }

      // Check if device is already in use
      const existingSession = await Session.findOne({
        deviceNumber,
        status: 'active'
      });

      if (existingSession) {
        return res.status(400).json({
          success: false,
          message: 'الجهاز مستخدم حالياً',
          error: 'Device is already in use'
        });
      }

      // Create new session
      const session = new Session({
        deviceNumber,
        deviceName,
        deviceType,
        customerName,
        controllers: controllers || 1,
        createdBy: req.user._id
      });

      await session.save();
      await session.populate('createdBy', 'name');

      // Update device status to active
      await Device.findOneAndUpdate(
        { number: deviceNumber },
        { status: 'active' }
      );

      res.status(201).json({
        success: true,
        message: 'تم بدء الجلسة بنجاح',
        data: session
      });
    } catch (err) {
      console.error('createSession error:', err);
      res.status(400).json({
        success: false,
        message: 'خطأ في إنشاء الجلسة',
        error: err.message
      });
    }
  },

  // Update controllers during session
  updateControllers: async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { controllers } = req.body;

      if (!controllers || controllers < 1 || controllers > 4) {
        return res.status(400).json({
          success: false,
          message: 'عدد الدراعات يجب أن يكون بين 1 و 4',
          error: 'Invalid controllers count'
        });
      }

      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'الجلسة غير موجودة',
          error: 'Session not found'
        });
      }

      if (session.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن تعديل عدد الدراعات في جلسة غير نشطة',
          error: 'Session is not active'
        });
      }

      // Update controllers using the method
      session.updateControllers(controllers);
      session.updatedBy = req.user._id;

      await session.save();
      await session.populate(['createdBy', 'updatedBy'], 'name');

      res.json({
        success: true,
        message: 'تم تحديث عدد الدراعات بنجاح',
        data: session
      });
    } catch (err) {
      console.error('updateControllers error:', err);
      res.status(400).json({
        success: false,
        message: 'خطأ في تحديث عدد الدراعات',
        error: err.message
      });
    }
  },

  // End session
  endSession: async (req, res) => {
    try {
      const { id } = req.params;
      console.log('🔄 Ending session with ID:', id);

      const session = await Session.findById(id);

      if (!session) {
        console.log('❌ Session not found:', id);
        return res.status(404).json({
          success: false,
          message: 'الجلسة غير موجودة',
          error: 'Session not found'
        });
      }

      if (session.status !== 'active') {
        console.log('❌ Session is not active:', session.status);
        return res.status(400).json({
          success: false,
          message: 'الجلسة غير نشطة',
          error: 'Session is not active'
        });
      }

      console.log('📊 Session before ending:', {
        id: session._id,
        deviceType: session.deviceType,
        deviceName: session.deviceName,
        startTime: session.startTime,
        controllers: session.controllers,
        controllersHistory: session.controllersHistory
      });

      // End session using the method
      session.endSession();
      session.updatedBy = req.user._id;

      await session.save();
      await session.populate(['createdBy', 'updatedBy'], 'name');

      console.log('✅ Session ended successfully:', {
        finalCost: session.finalCost,
        totalCost: session.totalCost,
        endTime: session.endTime
      });

      // Update device status to available
      await Device.findOneAndUpdate(
        { number: session.deviceNumber },
        { status: 'available' }
      );

      // Create bill automatically for the session
      let bill = null;
      try {
        console.log('💰 Creating bill for session...');

        // Determine bill type based on device type
        let billType = 'cafe';
        let customerName = session.customerName || 'عميل';
        let tableNumber = 0;
        let tableName = '';

        if (session.deviceType === 'playstation') {
          billType = 'playstation';
          customerName = session.customerName || `عميل بلايستيشن(${session.deviceNumber})`;
          tableNumber = session.deviceNumber;
          tableName = session.deviceName;
        } else if (session.deviceType === 'computer') {
          billType = 'computer';
          customerName = session.customerName || `عميل كمبيوتر(${session.deviceNumber})`;
          tableNumber = session.deviceNumber;
          tableName = session.deviceName;
        }

        const billData = {
          tableNumber: tableName || session.deviceName, // اسم الجهاز بدلاً من رقم الجهاز
          customerName: customerName,
          sessions: [session._id],
          subtotal: session.finalCost || 0,
          total: session.finalCost || 0,
          discount: session.discount || 0,
          tax: 0,
          notes: `فاتورة جلسة ${tableName || session.deviceName} - ${session.deviceType}`,
          billType: billType,
          createdBy: req.user._id
        };

        console.log('📝 Bill data:', billData);

        bill = await Bill.create(billData);

        console.log('✅ Bill created successfully:', {
          id: bill._id,
          billNumber: bill.billNumber,
          total: bill.total,
          status: bill.status,
          billType: bill.billType
        });

        // Calculate bill totals
        await bill.calculateSubtotal();

        // Update session to reference this bill
        session.bill = bill._id;
        await session.save();

        await bill.populate(['sessions', 'createdBy'], 'name');

        console.log(`✅ تم إنشاء فاتورة تلقائياً للجلسة: ${bill.billNumber} (نوع: ${billType})`);
      } catch (billError) {
        console.error('❌ خطأ في إنشاء الفاتورة التلقائية:', billError);
        console.error('❌ Bill error details:', {
          message: billError.message,
          errors: billError.errors
        });
        // Continue with session ending even if bill creation fails
      }

      res.json({
        success: true,
        message: 'تم إنهاء الجلسة وإنشاء الفاتورة بنجاح',
        data: {
          session,
          bill: bill ? {
            id: bill._id,
            billNumber: bill.billNumber,
            total: bill.total,
            status: bill.status
          } : null
        }
      });
    } catch (err) {
      console.error('❌ endSession error:', err);
      res.status(400).json({
        success: false,
        message: 'خطأ في إنهاء الجلسة',
        error: err.message
      });
    }
  },

  // Get active sessions
  getActiveSessions: async (req, res) => {
    try {
      const sessions = await Session.find({ status: 'active' })
        .populate('createdBy', 'name')
        .sort({ startTime: -1 });

      res.json({
        success: true,
        count: sessions.length,
        data: sessions
      });
    } catch (err) {
      console.error('getActiveSessions error:', err);
      res.status(500).json({
        success: false,
        message: 'خطأ في جلب الجلسات النشطة',
        error: err.message
      });
    }
  }
};

export default sessionController;
