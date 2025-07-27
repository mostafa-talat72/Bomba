import express from "express";
import {
    register,
    login,
    logout,
    getMe,
    refreshToken,
    updatePassword,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
} from "../controllers/authController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refreshToken);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Protected routes
router.get("/me", authenticateToken, getMe);
router.put("/update-password", authenticateToken, updatePassword);

export default router;
