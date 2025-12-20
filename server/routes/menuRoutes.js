import express from "express";
import {
    getAllMenuItems,
    getMenuItemById,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleMenuItemAvailability,
    getMenuCategories,
    getPopularMenuItems,
    updateMenuItemsOrder,
    incrementOrderCount,
} from "../controllers/menuController.js";
import {
    getAllMenuSections,
    getMenuSectionById,
    createMenuSection,
    updateMenuSection,
    deleteMenuSection,
} from "../controllers/menuSectionController.js";
import {
    getAllMenuCategories,
    getMenuCategoryById,
    createMenuCategory,
    updateMenuCategory,
    deleteMenuCategory,
} from "../controllers/menuCategoryController.js";
import { authenticateToken, authorize } from "../middleware/auth.js";
import { protect } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";
import { body } from "express-validator";

const router = express.Router();

// Validation rules
const menuItemValidation = [
    body("name")
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage("اسم العنصر يجب أن يكون بين 2 و 100 حرف"),
    body("price").isFloat({ min: 0 }).withMessage("السعر يجب أن يكون رقم موجب"),
    body("category")
        .notEmpty()
        .withMessage("الفئة مطلوبة")
        .isMongoId()
        .withMessage("معرف الفئة غير صحيح"),
    body("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("الوصف يجب أن يكون أقل من 500 حرف"),
    body("preparationTime")
        .optional()
        .isInt({ min: 1, max: 60 })
        .withMessage("وقت التحضير يجب أن يكون بين 1 و 60 دقيقة"),
    body("calories")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("السعرات الحرارية يجب أن تكون رقم موجب"),
    body("allergens")
        .optional()
        .isArray()
        .withMessage("الحساسية يجب أن تكون مصفوفة"),
    body("isAvailable")
        .optional()
        .isBoolean()
        .withMessage("حالة التوفر يجب أن تكون true أو false"),
    body("isPopular")
        .optional()
        .isBoolean()
        .withMessage("حالة الشعبية يجب أن تكون true أو false"),
];

// Public routes (for customers) - NO AUTHENTICATION REQUIRED
router.get("/items", protect, getAllMenuItems);
router.get("/items/popular", getPopularMenuItems);
router.get("/categories", getMenuCategories);
router.get("/items/:id", getMenuItemById);

// Protected routes (for staff)
router.use(authenticateToken);

// Menu Sections routes (menu permission required)
router.get("/sections", authorize("menu", "all"), getAllMenuSections);
router.get("/sections/:id", authorize("menu", "all"), getMenuSectionById);
router.post("/sections", authorize("menu", "all"), createMenuSection);
router.put("/sections/:id", authorize("menu", "all"), updateMenuSection);
router.delete("/sections/:id", authorize("menu", "all"), deleteMenuSection);

// Menu Categories routes (menu permission required)
router.get("/categories-all", authorize("menu", "all"), getAllMenuCategories);
router.get("/categories/:id", authorize("menu", "all"), getMenuCategoryById);
router.post("/categories", authorize("menu", "all"), createMenuCategory);
router.put("/categories/:id", authorize("menu", "all"), updateMenuCategory);
router.delete("/categories/:id", authorize("menu", "all"), deleteMenuCategory);

// Menu management routes (menu permission required)
router.post(
    "/items",
    authorize("menu", "all"),
    menuItemValidation,
    validateRequest,
    createMenuItem
);
router.put(
    "/items/:id",
    authorize("menu", "all"),
    menuItemValidation,
    validateRequest,
    updateMenuItem
);
router.delete("/items/:id", authorize("menu", "all"), deleteMenuItem);
router.patch(
    "/items/:id/toggle",
    authorize("menu", "all"),
    toggleMenuItemAvailability
);
router.put("/items/order", authorize("menu", "all"), updateMenuItemsOrder);
router.post("/items/:id/increment-order", incrementOrderCount);

export default router;
