import express from 'express';
import {
    getCostCategories,
    getCostCategory,
    createCostCategory,
    updateCostCategory,
    deleteCostCategory,
} from '../controllers/costCategoryController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getCostCategories).post(createCostCategory);

router
    .route('/:id')
    .get(getCostCategory)
    .put(updateCostCategory)
    .delete(deleteCostCategory);

export default router;
