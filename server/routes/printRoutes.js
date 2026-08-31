import express from 'express';
import printController from '../controllers/printController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// جميع مسارات الطباعة تتطلب المصادقة
router.use(authenticateToken);

/**
 * @route   POST /api/print/bill
 * @desc    طباعة فاتورة مباشرة مع فتح درج الكاشير
 * @access  Private
 */
router.post('/bill', printController.printBill);

/**
 * @route   POST /api/print/order
 * @desc    طباعة طلب مباشرة بدون فتح درج الكاشير
 * @access  Private
 */
router.post('/order', printController.printOrder);

/**
 * @route   POST /api/print/consumption-report
 * @desc    طباعة تقرير الاستهلاك مباشرة بدون فتح درج الكاشير
 * @access  Private
 */
router.post('/consumption-report', printController.printConsumptionReport);

/**
 * @route   GET /api/print/detect
 * @desc    كشف الطابعات المتاحة
 * @access  Private
 */
router.get('/detect', printController.detectPrinters);

/**
 * @route   POST /api/print/test
 * @desc    اختبار اتصال طابعة
 * @access  Private
 */
router.post('/test', printController.testPrinter);

/**
 * @route   POST /api/print/device
 * @desc    حفظ إعدادات الطابعة للجهاز الحالي
 * @access  Private
 */
router.post('/device', printController.saveDevicePrinter);

/**
 * @route   GET /api/print/device
 * @desc    الحصول على إعدادات الطابعة للجهاز الحالي
 * @access  Private
 */
router.get('/device', printController.getDevicePrinter);

/**
 * @route   POST /api/print/auto-detect
 * @desc    اكتشاف تلقائي للطابعة وربطها بالمستخدم الحالي
 * @access  Private
 */
router.post('/auto-detect', printController.autoDetectPrinter);

/**
 * @route   POST /api/print/open-cash-drawer
 * @desc    فتح درج الكاشير فقط (بدون طباعة)
 * @access  Private
 */
router.post('/open-cash-drawer', printController.openCashDrawerOnly);

export default router;