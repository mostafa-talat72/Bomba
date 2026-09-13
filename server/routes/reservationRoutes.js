import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
    getReservations,
    createReservation,
    seatReservation,
    cancelReservation,
    markNoShow,
} from "../controllers/reservationController.js";

const router = express.Router();

router.use(protect);

router.get("/", authorize("cafe", "tables", "all"), getReservations);
router.post("/", authorize("cafe", "tables", "all"), createReservation);
router.post("/:id/seat", authorize("cafe", "tables", "all"), seatReservation);
router.post("/:id/cancel", authorize("cafe", "tables", "all"), cancelReservation);
router.post("/:id/no-show", authorize("cafe", "tables", "all"), markNoShow);

export default router;
