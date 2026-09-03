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
router.post('/bill', (req,res)=>printController.printBill(req,res));
router.post('/order', (req,res)=>printController.printOrder(req,res));
router.post('/consumption-report', (req,res)=>printController.printConsumptionReport(req,res));
router.get('/detect', (req,res)=>printController.detectPrinters(req,res));
router.post('/test', (req,res)=>printController.testPrinter(req,res));
router.post('/device', (req,res)=>printController.saveDevicePrinter(req,res));
router.get('/device', (req,res)=>printController.getDevicePrinter(req,res));
router.post('/auto-detect', (req,res)=>printController.autoDetectPrinter(req,res));
router.post('/open-cash-drawer', (req,res)=>printController.openCashDrawerOnly(req,res));
router.post('/cut-paper', (req,res)=>printController.cutPaperOnly(req,res));
router.post('/bill/auto-detect', (req,res)=>printController.autoDetectAndPrintBill(req,res));
router.post('/order/auto-detect', (req,res)=>printController.autoDetectAndPrintOrder(req,res));
router.post('/cash-drawer/auto-detect', (req,res)=>printController.autoDetectAndOpenCashDrawer(req,res));

export default router;