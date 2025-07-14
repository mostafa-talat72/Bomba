import express from "express";
import {
    register,
    login,
    refreshToken,
    logout,
    getMe,
    updatePassword,
} from "../controllers/authController.js";
import { protect, authorize } from "../middleware/auth.js";
import {
    validateUserRegistration,
    validateUserLogin,
    validateRequest,
} from "../middleware/validation.js";

const router = express.Router();

router.post(
    "/register",
    protect,
    authorize("users", "all"),
    validateUserRegistration,
    validateRequest,
    register
);
router.post("/login", validateUserLogin, validateRequest, login);
router.post("/refresh", refreshToken);
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);
router.put("/password", protect, updatePassword);

export default router;
