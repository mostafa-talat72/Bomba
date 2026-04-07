import express from "express";
import {
    getBills,
    getBill,
    createBill,
    updateBill,
    addPayment,
    addOrderToBill,
    removeOrderFromBill,
    addSessionToBill,
    getBillByQR,
    cancelBill,
    deleteBill,
    addPartialPayment,
    cleanupBillPayments,
    getBillItems,
    getSubscriptionStatus,
    createSubscriptionPayment,
    fawryWebhook,
    payForItems,
    paySessionPartial,
    getBillAggregatedItems,
    addPartialPaymentAggregated,
} from "../controllers/billingController.js";
import { protect, authorize, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// Public routes for customer access
router.get("/qr/:billId", getBillByQR);
router.get("/public/:id", getBill); // Route للعملاء بدون authentication

// All other routes require authentication
router.use(protect);

// Subscription routes (after protect middleware)
router.get("/subscription/status", getSubscriptionStatus);
router.post("/subscription/payment", createSubscriptionPayment);
router.post("/subscription/fawry-webhook", fawryWebhook);

router
    .route("/")
    .get(authorize("billing", "staff", "all"), getBills)
    .post(authorize("billing", "staff", "all"), createBill);

router
    .route("/:id")
    .get(authorize("billing", "all"), getBill)
    .put(authorize("billing", "all"), updateBill)
    .delete(authorize("billing", "all"), deleteBill);

router.post("/:id/payment", authorize("billing", "all"), addPayment);
router.put("/:id/payment", authorize("billing", "all"), addPayment);
router.post("/:id/orders", authorize("billing", "all"), addOrderToBill);
router.delete("/:id/orders/:orderId", authorize("billing", "all"), removeOrderFromBill);
router.post("/:id/sessions", authorize("billing", "all"), addSessionToBill);
// إلغاء الفاتورة - للمدير فقط
router.put("/:id/cancel", protect, adminOnly, cancelBill);
router.get("/:id/items", authorize("billing", "all"), getBillItems);
router.post(
    "/:id/partial-payment",
    authorize("billing", "all"),
    addPartialPayment
);
// Backend aggregated partial payment (NEW)
router.get("/:id/aggregated-items", authorize("billing", "all"), getBillAggregatedItems);
router.post("/:id/partial-payment-aggregated", authorize("billing", "all"), addPartialPaymentAggregated);
// تنظيف دفعات الأصناف المحذوفة
router.post("/:id/cleanup-payments", authorize("billing", "all"), cleanupBillPayments);
// دفع أصناف محددة من الفاتورة
router.post("/:id/pay-items", authorize("billing", "all"), payForItems);
// دفع جزئي لجلسة محددة
router.post("/:id/pay-session-partial", authorize("billing", "all"), paySessionPartial);
// تعديل دفعة جزئية لجلسة
router.put("/:billId/session-payments/:sessionId/:paymentIndex", authorize("billing", "all"), async (req, res) => {
  try {
    const { billId, sessionId, paymentIndex } = req.params;
    const { amount, method, reference } = req.body;
    
    // التحقق من الصلاحية
    if (!req.user.hasPermission('canEditPartialPayment') && !req.user.hasPermission('all')) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتعديل الدفعات الجزئية'
      });
    }
    
    // التحقق من البيانات
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'المبلغ غير صحيح'
      });
    }
    
    if (!method || !['cash', 'card', 'transfer'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'طريقة الدفع غير صحيحة'
      });
    }
    
    // الحصول على الفاتورة
    const Bill = (await import('../models/Bill.js')).default;
    const bill = await Bill.findById(billId);
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }
    
    // البحث عن دفعات الجلسة
    const sessionPayment = bill.sessionPayments?.find(
      sp => sp.sessionId.toString() === sessionId
    );
    
    if (!sessionPayment || !sessionPayment.payments || !sessionPayment.payments[paymentIndex]) {
      return res.status(404).json({
        success: false,
        message: 'الدفعة غير موجودة'
      });
    }
    
    // حفظ المبلغ القديم
    const oldAmount = sessionPayment.payments[paymentIndex].amount;
    const amountDifference = amount - oldAmount;
    
    // التحقق من أن المبلغ الجديد لا يتجاوز الحد المسموح
    const newRemaining = sessionPayment.remainingAmount - amountDifference;
    if (newRemaining < 0) {
      return res.status(400).json({
        success: false,
        message: 'المبلغ يتجاوز الحد المسموح'
      });
    }
    
    // تحديث الدفعة
    sessionPayment.payments[paymentIndex].amount = amount;
    sessionPayment.payments[paymentIndex].method = method;
    if (reference) {
      sessionPayment.payments[paymentIndex].reference = reference;
    }
    sessionPayment.payments[paymentIndex].editedAt = new Date();
    sessionPayment.payments[paymentIndex].editedBy = req.user._id;
    
    // إعادة حساب المبالغ
    sessionPayment.paidAmount = sessionPayment.payments.reduce((sum, p) => sum + p.amount, 0);
    sessionPayment.remainingAmount = sessionPayment.sessionCost - sessionPayment.paidAmount;
    
    // إعادة حساب إجمالي الفاتورة
    const totalSessionsPaid = bill.sessionPayments?.reduce((sum, sp) => sum + sp.paidAmount, 0) || 0;
    const totalItemsPaid = bill.itemPayments?.reduce((sum, ip) => sum + ip.paidAmount, 0) || 0;
    bill.paid = totalSessionsPaid + totalItemsPaid;
    bill.remaining = bill.total - bill.paid;
    
    // تحديث حالة الفاتورة
    if (bill.remaining <= 0) {
      bill.status = 'paid';
    } else if (bill.paid > 0) {
      bill.status = 'partial';
    } else {
      bill.status = 'unpaid';
    }
    
    // حفظ التغييرات
    await bill.save();
    
    res.json({
      success: true,
      message: 'تم تعديل الدفعة بنجاح',
      data: bill
    });
    
  } catch (error) {
    console.error('Error updating session payment:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تعديل الدفعة'
    });
  }
});

// تعديل دفعة جزئية للأصناف
router.put("/:billId/item-payments/:itemPaymentId/:paymentIndex", authorize("billing", "all"), async (req, res) => {
  try {
    const { billId, itemPaymentId, paymentIndex } = req.params;
    const { quantity, method, reference } = req.body;
    
    // التحقق من الصلاحية
    if (!req.user.hasPermission('canEditPartialPayment') && !req.user.hasPermission('all')) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتعديل الدفعات الجزئية'
      });
    }
    
    // التحقق من البيانات
    if (quantity === undefined || quantity === null || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'الكمية غير صحيحة'
      });
    }
    
    // التحقق من أن الكمية رقم صحيح
    if (!Number.isInteger(quantity)) {
      return res.status(400).json({
        success: false,
        message: 'يجب أن تكون الكمية رقماً صحيحاً'
      });
    }
    
    if (!method || !['cash', 'card', 'transfer'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'طريقة الدفع غير صحيحة'
      });
    }
    
    // الحصول على الفاتورة
    const Bill = (await import('../models/Bill.js')).default;
    const bill = await Bill.findById(billId);
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }
    
    // البحث عن itemPayment
    const itemPayment = bill.itemPayments.find(ip => 
      (ip._id && ip._id.toString() === itemPaymentId) || 
      (ip.id && ip.id.toString() === itemPaymentId)
    );
    
    if (!itemPayment) {
      return res.status(404).json({
        success: false,
        message: 'الصنف غير موجود'
      });
    }
    
    // التحقق من وجود الدفعة في paymentHistory
    if (!itemPayment.paymentHistory || !itemPayment.paymentHistory[paymentIndex]) {
      return res.status(404).json({
        success: false,
        message: 'الدفعة غير موجودة'
      });
    }
    
    // حفظ الكمية القديمة
    const oldPayment = itemPayment.paymentHistory[paymentIndex];
    const oldQuantity = oldPayment.quantity;
    
    // التحقق من أن الكمية الجديدة لا تتجاوز الكمية المدفوعة في هذه الدفعة
    if (quantity > oldQuantity) {
      return res.status(400).json({
        success: false,
        message: 'الكمية الجديدة تتجاوز الكمية المدفوعة في هذه الدفعة'
      });
    }
    
    // إذا كانت الكمية 0، احذف الدفعة من paymentHistory
    if (quantity === 0) {
      const oldAmount = oldPayment.amount;
      
      // حذف الدفعة من paymentHistory
      itemPayment.paymentHistory.splice(paymentIndex, 1);
      
      // إعادة حساب paidAmount و paidQuantity للصنف
      itemPayment.paidAmount = itemPayment.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
      itemPayment.paidQuantity = itemPayment.paymentHistory.reduce((sum, p) => sum + p.quantity, 0);
      
      // تحديث حالة الصنف
      itemPayment.isPaid = itemPayment.paidQuantity >= itemPayment.quantity;
      
      // إعادة حساب إجمالي الفاتورة
      bill.calculateRemainingAmount();
      
      // حفظ التغييرات
      await bill.save();
      
      // Populate bill data
      await bill.populate([
        { path: "table", select: "number name section" },
        { path: "orders", select: "orderNumber items status total" },
        { path: "sessions", select: "deviceName deviceNumber status totalCost" },
        { path: "createdBy", select: "name" },
        { path: "updatedBy", select: "name" }
      ]);
      
      return res.json({
        success: true,
        message: 'تم حذف الدفعة بنجاح',
        data: bill
      });
    }
    
    const quantityDifference = quantity - oldQuantity;
    
    // التحقق من أن الكمية الجديدة لا تتجاوز الكمية الكلية
    const newPaidQuantity = itemPayment.paidQuantity + quantityDifference;
    if (newPaidQuantity > itemPayment.quantity) {
      return res.status(400).json({
        success: false,
        message: 'الكمية تتجاوز الكمية المتاحة للصنف'
      });
    }
    
    // حساب المبلغ الجديد
    const pricePerUnit = itemPayment.pricePerUnit;
    const newAmount = quantity * pricePerUnit;
    const oldAmount = oldPayment.amount;
    const amountDifference = newAmount - oldAmount;
    
    // التحقق من أن المبلغ الجديد لا يتجاوز الحد المسموح
    const newRemaining = bill.remaining - amountDifference;
    if (newRemaining < 0) {
      return res.status(400).json({
        success: false,
        message: 'المبلغ يتجاوز الحد المسموح'
      });
    }
    
    // تحديث الدفعة في paymentHistory
    itemPayment.paymentHistory[paymentIndex].quantity = quantity;
    itemPayment.paymentHistory[paymentIndex].amount = newAmount;
    itemPayment.paymentHistory[paymentIndex].method = method;
    if (reference) {
      itemPayment.paymentHistory[paymentIndex].reference = reference;
    }
    itemPayment.paymentHistory[paymentIndex].editedAt = new Date();
    itemPayment.paymentHistory[paymentIndex].editedBy = req.user._id;
    
    // إعادة حساب paidAmount و paidQuantity للصنف
    itemPayment.paidAmount = itemPayment.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
    itemPayment.paidQuantity = itemPayment.paymentHistory.reduce((sum, p) => sum + p.quantity, 0);
    
    // تحديث حالة الصنف
    itemPayment.isPaid = itemPayment.paidQuantity >= itemPayment.quantity;
    
    // إعادة حساب إجمالي الفاتورة
    bill.calculateRemainingAmount();
    
    // حفظ التغييرات
    await bill.save();
    
    // Populate bill data
    await bill.populate([
      { path: "table", select: "number name section" },
      { path: "orders", select: "orderNumber items status total" },
      { path: "sessions", select: "deviceName deviceNumber status totalCost" },
      { path: "createdBy", select: "name" },
      { path: "updatedBy", select: "name" }
    ]);
    
    res.json({
      success: true,
      message: 'تم تعديل الدفعة بنجاح',
      data: bill
    });
    
  } catch (error) {
    console.error('Error updating item payment:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تعديل الدفعة'
    });
  }
});

export default router;
