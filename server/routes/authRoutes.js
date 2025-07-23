import express from "express";
import {
    register,
    login,
    refreshToken,
    logout,
    getMe,
    updatePassword,
    verifyEmail,
} from "../controllers/authController.js";
import { protect, authorize } from "../middleware/auth.js";
import {
    validateUserRegistration,
    validateUserLogin,
    validateRequest,
} from "../middleware/validation.js";

const router = express.Router();

// Registration
router.post("/register", register);
// Email verification
router.get("/verify-email", verifyEmail);
// Login
router.post("/login", login);
// Refresh token
router.post("/refresh", refreshToken);
// Logout
router.post("/logout", logout);
// Get current user
router.get("/me", getMe);

export default router;
