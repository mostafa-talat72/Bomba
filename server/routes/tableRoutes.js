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
router.use(authenticateToken);

// Table Sections routes (orders permission required)
router.get("/sections", authorize("orders", "all"), getAllTableSections);
router.get("/sections/:id", authorize("orders", "all"), getTableSectionById);
router.post(
    "/sections",
    authorize("orders", "all"),
    tableSectionValidation,
    validateRequest,
    createTableSection
);
router.put(
    "/sections/:id",
    authorize("orders", "all"),
    tableSectionValidation,
    validateRequest,
    updateTableSection
);
router.delete("/sections/:id", authorize("orders", "all"), deleteTableSection);

// Tables routes (orders permission required)
router.get("/tables", authorize("orders", "all"), getAllTables);
router.get("/tables/:id", authorize("orders", "all"), getTableById);
router.get("/tables/:id/status", authorize("orders", "all"), getTableStatus);
router.post(
    "/tables",
    authorize("orders", "all"),
    tableValidation,
    validateRequest,
    createTable
);
router.put(
    "/tables/:id",
    authorize("orders", "all"),
    tableValidation,
    validateRequest,
    updateTable
);
router.delete("/tables/:id", authorize("orders", "all"), deleteTable);

export default router;





