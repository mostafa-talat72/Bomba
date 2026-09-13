import express from "express";
import { searchDeliveryCustomers, listDeliveryCustomers } from "../controllers/deliveryCustomerController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.get("/search", searchDeliveryCustomers);
router.get("/", listDeliveryCustomers);

export default router;
