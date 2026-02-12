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

export default router;
