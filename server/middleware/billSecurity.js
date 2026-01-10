import Bill from '../models/Bill.js';
import jwt from 'jsonwebtoken';

/**
 * Middleware لحماية الوصول للفواتير
 * يسمح فقط للمستخدمين المصرح لهم بالوصول للفاتورة
 */
export const secureBillAccess = async (req, res, next) => {
  try {
    const { billId } = req.params;
    const user = req.user;

    // التحقق من صحة معرف الفاتورة
    if (!billId || billId.length !== 24) {
      return res.status(400).json({
        success: false,
        message: 'معرف الفاتورة غير صحيح'
      });
    }

    // جلب الفاتورة
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    // التحقق من الصلاحيات
    const canAccess = 
      user.role === 'admin' || // المدير يمكنه الوصول لجميع الفواتير
      user.hasPermission('billing') || // صلاحية الفواتير
      user.hasPermission('all') || // صلاحية شاملة
      bill.createdBy?.toString() === user._id.toString(); // منشئ الفاتورة

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية للوصول لهذه الفاتورة'
      });
    }

    // إضافة الفاتورة للطلب للاستخدام في المتحكم
    req.bill = bill;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'خطأ في التحقق من صلاحية الوصول',
      error: error.message
    });
  }
};

/**
 * إنشاء رمز مؤقت للوصول للفاتورة (للعملاء)
 */
export const generateBillAccessToken = (billId, expiresIn = '24h') => {
  return jwt.sign(
    { 
      billId, 
      type: 'bill_access',
      timestamp: Date.now()
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * التحقق من رمز الوصول المؤقت للفاتورة
 */
export const verifyBillAccessToken = async (req, res, next) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'رمز الوصول مطلوب'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'bill_access') {
      return res.status(401).json({
        success: false,
        message: 'رمز وصول غير صحيح'
      });
    }

    // التحقق من أن معرف الفاتورة يطابق الرمز
    if (decoded.billId !== req.params.billId) {
      return res.status(401).json({
        success: false,
        message: 'رمز الوصول غير صحيح لهذه الفاتورة'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'رمز الوصول منتهي الصلاحية أو غير صحيح'
    });
  }
};