import express from "express";
import { getCurrentShift, openShift, closeShift, listShifts } from "../controllers/shiftController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(authorize("shifts", "billing", "all"));

router.get("/current", getCurrentShift);
router.post("/open", openShift);
router.post("/close", closeShift);
router.get("/", listShifts);

export default router;
