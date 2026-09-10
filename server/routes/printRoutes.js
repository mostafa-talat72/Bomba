import express from 'express';
import printController from '../controllers/printController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireDevicePrintPermission } from '../middleware/deviceTracker.js';

const router = express.Router();

// جميع مسارات الطباعة تتطلب المصادقة
router.use(authenticateToken);

// أفعال الطباعة الفعلية تتطلب سماحية الجهاز (قائمة بيضاء)
const printGate = requireDevicePrintPermission;
router.post('/bill', printGate, (req,res)=>printController.printBill(req,res));
router.post('/order', printGate, (req,res)=>printController.printOrder(req,res));
router.post('/consumption-report', printGate, (req,res)=>printController.printConsumptionReport(req,res));
router.post('/test', printGate, (req,res)=>printController.testPrinter(req,res));
router.post('/open-cash-drawer', printGate, (req,res)=>printController.openCashDrawerOnly(req,res));
router.post('/cut-paper', printGate, (req,res)=>printController.cutPaperOnly(req,res));
router.post('/bill/auto-detect', printGate, (req,res)=>printController.autoDetectAndPrintBill(req,res));
router.post('/order/auto-detect', printGate, (req,res)=>printController.autoDetectAndPrintOrder(req,res));
router.post('/cash-drawer/auto-detect', printGate, (req,res)=>printController.autoDetectAndOpenCashDrawer(req,res));
// إعدادات/اكتشاف بدون بوابة (لا تطبع شيئاً)
router.get('/detect', (req,res)=>printController.detectPrinters(req,res));
router.post('/device', (req,res)=>printController.saveDevicePrinter(req,res));
router.get('/device', (req,res)=>printController.getDevicePrinter(req,res));
router.post('/auto-detect', (req,res)=>printController.autoDetectPrinter(req,res));

export default router;