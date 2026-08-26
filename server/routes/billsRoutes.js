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
    redistributePayments,
} from "../controllers/billingController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public routes for customer access - SECURED
router.get("/qr/:billId", protect, getBillByQR); // Now requires authentication
// REMOVED: router.get("/public/:id", getBill); // Removed for security

// متاح للربط بجلسة بلايستيشن أو كمبيوتر
router.get("/available-for-session", protect, getAvailableBillsForSession);

// All other routes require authentication
router.use(protect);

router
    .route("/")
    .get(authorize("billing", "tables", "staff", "all"), getBills)
    .post(authorize("billing", "tables", "staff", "all"), createBill);

router
    .route("/:id")
    .get(authorize("billing", "tables", "staff", "all"), getBill)
    .put(authorize("billing", "tables", "staff", "all"), updateBill)
    .delete(authorize("billing", "tables", "staff", "all"), deleteBill);

router.post("/:id/payment", authorize("billing", "tables", "staff", "all"), addPayment);
router.put("/:id/payment", authorize("billing", "tables", "staff", "all"), addPayment);
router.post("/:id/pay-items", authorize("billing", "tables", "staff", "all"), payForItems);
router.post("/:id/pay-session-partial", authorize("billing", "tables", "staff", "all"), paySessionPartial);
router.post("/:id/redistribute-payments", authorize("billing", "tables", "staff", "all"), redistributePayments);
router.post("/:id/orders", authorize("billing", "tables", "staff", "all"), addOrderToBill);
router.post("/:id/sessions", authorize("billing", "tables", "staff", "all"), addSessionToBill);
router.put("/:id/cancel", authorize("billing", "tables", "staff", "all"), cancelBill);

export default router;
