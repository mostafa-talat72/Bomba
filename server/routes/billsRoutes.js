import express from "express";
import {
    getBills,
    getBill,
    createBill,
    updateBill,
    addPayment,
    addOrderToBill,
    addSessionToBill,
    getBillByQR,
    cancelBill,
    deleteBill,
    getAvailableBillsForSession,
    payForItems,
    paySessionPartial,
} from "../controllers/billingController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public routes for customer access
router.get("/qr/:billId", getBillByQR);
router.get("/public/:id", getBill); // Route للعملاء بدون authentication

// متاح للربط بجلسة بلايستيشن أو كمبيوتر
router.get("/available-for-session", protect, getAvailableBillsForSession);

// All other routes require authentication
router.use(protect);

router
    .route("/")
    .get(authorize("billing", "staff", "all"), getBills)
    .post(authorize("billing", "staff", "all"), createBill);

router
    .route("/:id")
    .get(authorize("billing", "staff", "all"), getBill)
    .put(authorize("billing", "staff", "all"), updateBill)
    .delete(authorize("billing", "staff", "all"), deleteBill);

router.post("/:id/payment", authorize("billing", "staff", "all"), addPayment);
router.put("/:id/payment", authorize("billing", "staff", "all"), addPayment);
router.post("/:id/pay-items", authorize("billing", "staff", "all"), payForItems);
router.post("/:id/pay-session-partial", authorize("billing", "staff", "all"), paySessionPartial);
router.post("/:id/orders", authorize("billing", "staff", "all"), addOrderToBill);
router.post("/:id/sessions", authorize("billing", "staff", "all"), addSessionToBill);
router.put("/:id/cancel", authorize("billing", "staff", "all"), cancelBill);

export default router;
