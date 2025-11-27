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
    getBillItems,
    getSubscriptionStatus,
    createSubscriptionPayment,
    fawryWebhook,
    payForItems,
} from "../controllers/billingController.js";
import { protect, authorize, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// Public routes for customer access
router.get("/qr/:billId", getBillByQR);
router.get("/public/:id", getBill); // Route للعملاء بدون authentication
router.get("/subscription/status", protect, getSubscriptionStatus);

// All other routes require authentication
router.use(protect);

router
    .route("/")
    .get(authorize("billing", "all"), getBills)
    .post(authorize("billing", "all"), createBill);

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
// دفع أصناف محددة من الفاتورة
router.post("/:id/pay-items", authorize("billing", "all"), payForItems);
router.post("/subscription/payment", protect, createSubscriptionPayment);
router.post("/subscription/fawry-webhook", fawryWebhook);

export default router;
