import express from "express";
import {
    searchDeliveryCustomers,
    listDeliveryCustomers,
    getCustomersDirectory,
    createDeliveryCustomer,
    updateDeliveryCustomer,
    deleteDeliveryCustomer,
} from "../controllers/deliveryCustomerController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.get("/search", searchDeliveryCustomers);
router.get("/", listDeliveryCustomers);
router.get("/directory", authorize("customers", "all"), getCustomersDirectory);
router.post("/", authorize("canAddCustomer", "all"), createDeliveryCustomer);
router.put("/:id", authorize("canEditCustomer", "all"), updateDeliveryCustomer);
router.delete("/:id", authorize("canDeleteCustomer", "all"), deleteDeliveryCustomer);

export default router;
