import express from "express";
import {
    getAllTableSections,
    getTableSectionById,
    createTableSection,
    updateTableSection,
    deleteTableSection,
} from "../controllers/tableSectionController.js";
import {
    getAllTables,
    getTableById,
    getTableStatus,
    createTable,
    updateTable,
    deleteTable,
} from "../controllers/tableController.js";
import { authenticateToken, authorize } from "../middleware/auth.js";
import { protect } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";
import { body } from "express-validator";

const router = express.Router();

// Validation rules
const tableSectionValidation = [
    body("name")
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage("اسم القسم يجب أن يكون بين 2 و 100 حرف"),
    body("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("الوصف يجب أن يكون أقل من 500 حرف"),
    body("sortOrder")
        .optional()
        .isInt({ min: 0 })
        .withMessage("ترتيب القسم يجب أن يكون رقم موجب"),
];

const tableValidation = [
    body("number")
        .trim()
        .notEmpty()
        .withMessage("رقم/اسم الطاولة مطلوب"),
    body("section")
        .notEmpty()
        .withMessage("القسم مطلوب")
        .isMongoId()
        .withMessage("معرف القسم غير صحيح"),
];

// Protected routes
router.use(protect);

// Table Sections routes (cafe, orders, staff permission required)
router.get("/sections", authorize("cafe", "orders", "staff", "all"), getAllTableSections);
router.get("/sections/:id", authorize("cafe", "orders", "staff", "all"), getTableSectionById);
router.post(
    "/sections",
    authorize("cafe", "orders", "staff", "all"),
    tableSectionValidation,
    validateRequest,
    createTableSection
);
router.put(
    "/sections/:id",
    authorize("cafe", "orders", "staff", "all"),
    tableSectionValidation,
    validateRequest,
    updateTableSection
);
router.delete("/sections/:id", authorize("cafe", "orders", "staff", "all"), deleteTableSection);

// Tables routes (cafe, orders, staff permission required)
router.get("/tables", authorize("cafe", "orders", "staff", "all"), getAllTables);
router.get("/tables/:id", authorize("cafe", "orders", "staff", "all"), getTableById);
router.get("/tables/:id/status", authorize("cafe", "orders", "staff", "all"), getTableStatus);
router.post(
    "/tables",
    authorize("cafe", "orders", "staff", "all"),
    tableValidation,
    validateRequest,
    createTable
);
router.put(
    "/tables/:id",
    authorize("cafe", "orders", "staff", "all"),
    tableValidation,
    validateRequest,
    updateTable
);
router.delete("/tables/:id", authorize("cafe", "orders", "staff", "all"), deleteTable);

export default router;





