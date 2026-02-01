import express from 'express';
import { getOrganizationPublicPage } from '../controllers/publicController.js';

const router = express.Router();

// Public organization page
router.get('/organization/:id', getOrganizationPublicPage);

export default router;