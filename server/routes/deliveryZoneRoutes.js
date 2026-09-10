import express from "express";
import { getDeliveryZones, createDeliveryZone, deleteDeliveryZone } from "../controllers/deliveryZoneController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.get("/", getDeliveryZones);
router.post("/", authorize("settings", "all"), createDeliveryZone);
router.delete("/:id", authorize("settings", "all"), deleteDeliveryZone);

export default router;
